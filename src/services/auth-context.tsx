import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import type { AppUser } from "../types";
import { fetchCurrentUserProfile } from "./api";
import { formatSupabaseError, measureAsync } from "./errors";
import { supabase } from "./supabase";

type AuthFlow = "recovery" | null;

interface AuthContextValue {
  user: User | null;
  profile: AppUser | null;
  profileLoading: boolean;
  profileError: string;
  profileMissing: boolean;
  isAdmin: boolean;
  session: Session | null;
  loading: boolean;
  authFlow: AuthFlow;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
  clearAuthFlow: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const missingSupabaseError = "חסרים משתני סביבה של Supabase";
const authFlowStorageKey = "mertens-auth-flow";
const forcedSignedOutStorageKey = "mertens-forced-signed-out";
const profileLoadTimeoutMs = 6000;

interface BootstrapAuthState {
  session: Session | null;
  user: User | null;
}

let bootstrapAuthState: BootstrapAuthState | null = null;
let bootstrapAuthPromise: Promise<BootstrapAuthState> | null = null;

function getAppUrl(path = "") {
  if (typeof window === "undefined") {
    return path;
  }

  return new URL(`${import.meta.env.BASE_URL}${path}`.replace(/^\//, ""), `${window.location.origin}/`).toString();
}

function readStoredAuthFlow(): AuthFlow {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem(authFlowStorageKey) === "recovery" ? "recovery" : null;
}

function writeStoredAuthFlow(authFlow: AuthFlow) {
  if (typeof window === "undefined") {
    return;
  }

  if (authFlow) {
    window.sessionStorage.setItem(authFlowStorageKey, authFlow);
    return;
  }

  window.sessionStorage.removeItem(authFlowStorageKey);
}

function readForcedSignedOut() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.sessionStorage.getItem(forcedSignedOutStorageKey) === "1";
}

function writeForcedSignedOut(value: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  if (value) {
    window.sessionStorage.setItem(forcedSignedOutStorageKey, "1");
    return;
  }

  window.sessionStorage.removeItem(forcedSignedOutStorageKey);
}

function clearStoredSupabaseSession() {
  if (typeof window === "undefined") {
    return;
  }

  const storages = [window.localStorage, window.sessionStorage];

  for (const storage of storages) {
    const keysToRemove: string[] = [];

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key) {
        continue;
      }

      if (key === authFlowStorageKey || key.startsWith("sb-")) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => storage.removeItem(key));
  }
}

function isRecoveryUrl() {
  if (typeof window === "undefined") {
    return false;
  }

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(window.location.search);
  return hashParams.get("type") === "recovery" || searchParams.get("type") === "recovery";
}

async function loadProfileForUser(nextUser: User | null) {
  if (!nextUser) {
    return null;
  }

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error("Timed out while loading account profile.")), profileLoadTimeoutMs);
    });

    return await measureAsync("auth:profile", () => Promise.race([fetchCurrentUserProfile(nextUser.id), timeoutPromise]));
  } catch (error) {
    throw new Error(formatSupabaseError(error, "Failed to load account profile."));
  }
}

async function getBootstrapAuthState() {
  if (!supabase) {
    return {
      session: null,
      user: null,
    } satisfies BootstrapAuthState;
  }

  if (bootstrapAuthState) {
    return bootstrapAuthState;
  }

  if (readForcedSignedOut() && !isRecoveryUrl()) {
    bootstrapAuthState = {
      session: null,
      user: null,
    };
    return bootstrapAuthState;
  }

  if (!bootstrapAuthPromise) {
    bootstrapAuthPromise = supabase.auth
      .getSession()
      .then(({ data }) => {
        const shouldIgnoreSession = readForcedSignedOut() && !isRecoveryUrl();
        const session = shouldIgnoreSession ? null : data.session;
        const user = shouldIgnoreSession ? null : session?.user ?? null;
        bootstrapAuthState = { session, user };
        return bootstrapAuthState;
      })
      .finally(() => {
        bootstrapAuthPromise = null;
      });
  }

  return bootstrapAuthPromise;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(() => bootstrapAuthState?.user ?? null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [profileLoading, setProfileLoading] = useState(() => Boolean(bootstrapAuthState?.user));
  const [profileError, setProfileError] = useState("");
  const [session, setSession] = useState<Session | null>(() => bootstrapAuthState?.session ?? null);
  const [loading, setLoading] = useState(() => (supabase ? bootstrapAuthState === null : false));
  const [authFlow, setAuthFlow] = useState<AuthFlow>(() => (isRecoveryUrl() ? "recovery" : readStoredAuthFlow()));

  useEffect(() => {
    writeStoredAuthFlow(authFlow);
  }, [authFlow]);

  useEffect(() => {
    function handleAuthFlow(event: AuthChangeEvent) {
      if (event === "PASSWORD_RECOVERY" || isRecoveryUrl()) {
        setAuthFlow("recovery");
      }
    }

    function applyAuthState(nextSession: Session | null) {
      const shouldIgnoreSession = readForcedSignedOut() && !isRecoveryUrl();
      const safeSession = shouldIgnoreSession ? null : nextSession;
      const nextUser = safeSession?.user ?? null;

      bootstrapAuthState = {
        session: safeSession,
        user: nextUser,
      };

      setSession(safeSession);
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setProfileLoading(false);
        setProfileError("");
      }
      setLoading(false);
    }

    async function refreshProfile(nextUser: User | null) {
      if (!isActive) {
        return;
      }

      if (!nextUser) {
        setProfile(null);
        setProfileLoading(false);
        setProfileError("");
        return;
      }

      setProfileLoading(true);
      setProfileError("");

      try {
        const nextProfile = await loadProfileForUser(nextUser);
        if (!isActive) {
          return;
        }

        setProfile(nextProfile);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setProfile(null);
        setProfileError(formatSupabaseError(error, "Failed to load account profile."));
      }

      if (!isActive) {
        return;
      }

      setProfileLoading(false);
    }

    if (!supabase) {
      setLoading(false);
      return;
    }

    let isActive = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      handleAuthFlow(event);
      if (!isActive) {
        return;
      }
      applyAuthState(nextSession);
      await refreshProfile(nextSession?.user ?? null);
    });

    if (bootstrapAuthState) {
      setSession(bootstrapAuthState.session);
      setUser(bootstrapAuthState.user);
      setLoading(false);
      void refreshProfile(bootstrapAuthState.user);
    } else {
      void getBootstrapAuthState().then((initialState) => {
        if (!isActive) {
          return;
        }

        bootstrapAuthState = initialState;
        applyAuthState(initialState.session);
        void refreshProfile(initialState.user);
      });
    }

    if (isRecoveryUrl()) {
      setAuthFlow("recovery");
    }

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      profileLoading,
      profileError,
      profileMissing: Boolean(user && !profileLoading && !profile && !profileError),
      isAdmin: Boolean(profile?.is_admin),
      session,
      loading,
      authFlow,
      async signIn(email, password) {
        if (!supabase) {
          return { error: missingSupabaseError };
        }

        setLoading(true);

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error) {
          writeForcedSignedOut(false);
          if (data.session) {
            bootstrapAuthState = {
              session: data.session,
              user: data.session.user,
            };

            setSession(data.session);
            setUser(data.session.user);
            setProfile(null);
            setProfileError("");
            setProfileLoading(true);
            setLoading(false);

            void loadProfileForUser(data.session.user)
              .then((nextProfile) => {
                setProfile(nextProfile);
                setProfileError("");
              })
              .catch((profileLoadError) => {
                setProfile(null);
                setProfileError(formatSupabaseError(profileLoadError, "Failed to load account profile."));
              })
              .finally(() => {
                setProfileLoading(false);
              });
          }
        } else {
          setLoading(false);
        }
        return error ? { error: error.message } : {};
      },
      async signUp(email, password) {
        if (!supabase) {
          return { error: missingSupabaseError };
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getAppUrl("login"),
          },
        });
        if (!error) {
          writeForcedSignedOut(false);
        }
        return error ? { error: error.message } : {};
      },
      async resetPassword(email) {
        if (!supabase) {
          return { error: missingSupabaseError };
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: getAppUrl("login"),
        });
        return error ? { error: error.message } : {};
      },
      async updatePassword(password) {
        if (!supabase) {
          return { error: missingSupabaseError };
        }

        const { error } = await supabase.auth.updateUser({ password });
        if (!error) {
          writeForcedSignedOut(false);
          setAuthFlow(null);
        }
        return error ? { error: error.message } : {};
      },
      clearAuthFlow() {
        setAuthFlow(null);
      },
      async signOut() {
        writeForcedSignedOut(true);
        bootstrapAuthState = {
          session: null,
          user: null,
        };

        setAuthFlow(null);
        setSession(null);
        setUser(null);
        setProfile(null);
        setProfileLoading(false);
        setProfileError("");
        setLoading(false);
        clearStoredSupabaseSession();

        if (!supabase) {
          if (typeof window !== "undefined") {
            window.location.replace(getAppUrl("login"));
          }
          return;
        }

        try {
          await supabase.auth.signOut({ scope: "local" });
        } finally {
          clearStoredSupabaseSession();
          if (typeof window !== "undefined") {
            window.location.replace(getAppUrl("login"));
          }
        }
      },
    }),
    [authFlow, loading, profile, profileError, profileLoading, session, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
