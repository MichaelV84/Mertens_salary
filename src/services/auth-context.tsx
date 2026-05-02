import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
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
const profileCacheStorageKey = "mertens-profile-cache";
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

function readCachedProfile(userId: string) {
  if (typeof window === "undefined") {
    return null as AppUser | null;
  }

  try {
    const rawValue = window.localStorage.getItem(profileCacheStorageKey);
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as { userId?: string; profile?: AppUser | null };
    if (parsedValue.userId !== userId) {
      return null;
    }

    return parsedValue.profile ?? null;
  } catch {
    return null;
  }
}

function writeCachedProfile(userId: string, profile: AppUser | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!profile) {
    window.localStorage.removeItem(profileCacheStorageKey);
    return;
  }

  window.localStorage.setItem(profileCacheStorageKey, JSON.stringify({ userId, profile }));
}

function clearCachedProfile() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(profileCacheStorageKey);
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

  let timeoutId = 0;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error("Timed out while loading account profile.")), profileLoadTimeoutMs);
    });

    return await measureAsync("auth:profile", () => Promise.race([fetchCurrentUserProfile(nextUser.id), timeoutPromise]));
  } catch (error) {
    throw new Error(formatSupabaseError(error, "Failed to load account profile."));
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
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
  const [profile, setProfile] = useState<AppUser | null>(() => {
    const bootstrapUser = bootstrapAuthState?.user;
    return bootstrapUser ? readCachedProfile(bootstrapUser.id) : null;
  });
  const [profileLoading, setProfileLoading] = useState(() => {
    const bootstrapUser = bootstrapAuthState?.user;
    return bootstrapUser ? !readCachedProfile(bootstrapUser.id) : false;
  });
  const [profileError, setProfileError] = useState("");
  const [session, setSession] = useState<Session | null>(() => bootstrapAuthState?.session ?? null);
  const [loading, setLoading] = useState(() => (supabase ? bootstrapAuthState === null : false));
  const [authFlow, setAuthFlow] = useState<AuthFlow>(() => (isRecoveryUrl() ? "recovery" : readStoredAuthFlow()));
  const userRef = useRef<User | null>(bootstrapAuthState?.user ?? null);
  const profileRef = useRef<AppUser | null>(null);

  useEffect(() => {
    writeStoredAuthFlow(authFlow);
  }, [authFlow]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

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
      const previousUserId = userRef.current?.id ?? null;

      bootstrapAuthState = {
        session: safeSession,
        user: nextUser,
      };

      userRef.current = nextUser;
      setSession(safeSession);
      setUser(nextUser);
      if (!nextUser) {
        profileRef.current = null;
        clearCachedProfile();
        setProfile(null);
        setProfileLoading(false);
        setProfileError("");
      } else if (previousUserId !== nextUser.id) {
        const cachedProfile = readCachedProfile(nextUser.id);
        profileRef.current = cachedProfile;
        setProfile(cachedProfile);
        setProfileLoading(!cachedProfile);
        setProfileError("");
      }
      setLoading(false);

      return {
        previousUserId,
        nextUserId: nextUser?.id ?? null,
      };
    }

    async function refreshProfile(nextUser: User | null, options?: { force?: boolean }) {
      if (!isActive) {
        return;
      }

      if (!nextUser) {
        profileRef.current = null;
        clearCachedProfile();
        setProfile(null);
        setProfileLoading(false);
        setProfileError("");
        return;
      }

      const hasCurrentProfile = userRef.current?.id === nextUser.id && Boolean(profileRef.current);
      if (!options?.force && hasCurrentProfile) {
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

        profileRef.current = nextProfile;
        writeCachedProfile(nextUser.id, nextProfile);
        setProfile(nextProfile);
      } catch (error) {
        if (!isActive) {
          return;
        }

        const hasStaleProfile = userRef.current?.id === nextUser.id && Boolean(profileRef.current);
        if (hasStaleProfile) {
          setProfileError("");
        } else {
          profileRef.current = null;
          clearCachedProfile();
          setProfile(null);
          setProfileError(formatSupabaseError(error, "Failed to load account profile."));
        }
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
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      handleAuthFlow(event);
      if (!isActive) {
        return;
      }
      const { previousUserId, nextUserId } = applyAuthState(nextSession);
      const isSameUser = previousUserId !== null && previousUserId === nextUserId;
      const shouldForceProfileRefresh =
        event === "USER_UPDATED" ||
        event === "PASSWORD_RECOVERY" ||
        (!isSameUser && event !== "INITIAL_SESSION");

      window.setTimeout(() => {
        if (!isActive) {
          return;
        }

        void refreshProfile(nextSession?.user ?? null, { force: shouldForceProfileRefresh });
      }, 0);
    });

    if (bootstrapAuthState) {
      const cachedProfile = bootstrapAuthState.user ? readCachedProfile(bootstrapAuthState.user.id) : null;
      setSession(bootstrapAuthState.session);
      setUser(bootstrapAuthState.user);
      userRef.current = bootstrapAuthState.user;
      profileRef.current = cachedProfile;
      setProfile(cachedProfile);
      setProfileLoading(Boolean(bootstrapAuthState.user && !cachedProfile));
      setLoading(false);
      void refreshProfile(bootstrapAuthState.user, { force: !cachedProfile });
    } else {
      void getBootstrapAuthState().then((initialState) => {
        if (!isActive) {
          return;
        }

        const cachedProfile = initialState.user ? readCachedProfile(initialState.user.id) : null;
        bootstrapAuthState = initialState;
        applyAuthState(initialState.session);
        profileRef.current = cachedProfile;
        setProfile(cachedProfile);
        setProfileLoading(Boolean(initialState.user && !cachedProfile));
        void refreshProfile(initialState.user, { force: !cachedProfile });
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

            userRef.current = data.session.user;
            profileRef.current = null;
            clearCachedProfile();
            setSession(data.session);
            setUser(data.session.user);
            setProfile(null);
            setProfileError("");
            setProfileLoading(true);
            setLoading(false);

            void loadProfileForUser(data.session.user)
              .then((nextProfile) => {
                profileRef.current = nextProfile;
                writeCachedProfile(data.session.user.id, nextProfile);
                setProfile(nextProfile);
                setProfileError("");
              })
              .catch((profileLoadError) => {
                profileRef.current = null;
                clearCachedProfile();
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
        userRef.current = null;
        profileRef.current = null;
        clearCachedProfile();
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
