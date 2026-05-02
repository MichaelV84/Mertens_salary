import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../services/auth-context";

type LoginMode = "login" | "register" | "forgot" | "reset";

const copy = {
  email: "\u05d0\u05d9\u05d9\u05de\u05d9\u05d9\u05dc",
  password: "\u05e1\u05d9\u05e1\u05de\u05d4",
  newPassword: "\u05e1\u05d9\u05e1\u05de\u05d4 \u05d7\u05d3\u05e9\u05d4",
  showPassword: "\u05d4\u05e6\u05d2 \u05e1\u05d9\u05e1\u05de\u05d4",
  hidePassword: "\u05d4\u05e1\u05ea\u05e8 \u05e1\u05d9\u05e1\u05de\u05d4",
  backToLogin: "\u05d7\u05d6\u05e8\u05d4 \u05dc\u05db\u05e0\u05d9\u05e1\u05d4",
  forgotPassword: "\u05e9\u05db\u05d7\u05ea \u05e1\u05d9\u05e1\u05de\u05d4?",
  noAccount: "\u05d0\u05d9\u05df \u05dc\u05da \u05d7\u05e9\u05d1\u05d5\u05df?",
  haveAccount: "\u05db\u05d1\u05e8 \u05d9\u05e9 \u05dc\u05da \u05d7\u05e9\u05d1\u05d5\u05df?",
  loginTitle: "\u05de\u05d7\u05e9\u05d1\u05d5\u05df \u05e9\u05db\u05e8",
  loginSubtitle: "\u05d4\u05ea\u05d7\u05d1\u05e8 \u05db\u05d3\u05d9 \u05dc\u05e0\u05d4\u05dc \u05d0\u05ea \u05e0\u05ea\u05d5\u05e0\u05d9 \u05d4\u05e9\u05db\u05e8 \u05e9\u05dc\u05da.",
  loginSubmit: "\u05db\u05e0\u05d9\u05e1\u05d4",
  registerTitle: "\u05de\u05d7\u05e9\u05d1\u05d5\u05df \u05e9\u05db\u05e8",
  registerSubtitle: "\u05e6\u05d5\u05e8 \u05d7\u05e9\u05d1\u05d5\u05df \u05db\u05d3\u05d9 \u05dc\u05e0\u05d4\u05dc \u05d0\u05ea \u05e0\u05ea\u05d5\u05e0\u05d9 \u05d4\u05e9\u05db\u05e8 \u05e9\u05dc\u05da.",
  registerSubmit: "\u05d4\u05e8\u05e9\u05de\u05d4",
  forgotTitle: "\u05d0\u05d9\u05e4\u05d5\u05e1 \u05e1\u05d9\u05e1\u05de\u05d4",
  forgotSubtitle: "\u05e0\u05e9\u05dc\u05d7 \u05dc\u05de\u05d9\u05d9\u05dc \u05e9\u05dc\u05da \u05e7\u05d9\u05e9\u05d5\u05e8 \u05e7\u05e6\u05e8 \u05dc\u05d4\u05d2\u05d3\u05e8\u05ea \u05e1\u05d9\u05e1\u05de\u05d4 \u05d7\u05d3\u05e9\u05d4.",
  forgotSubmit: "\u05e9\u05dc\u05d7 \u05e7\u05d9\u05e9\u05d5\u05e8",
  resetTitle: "\u05e1\u05d9\u05e1\u05de\u05d4 \u05d7\u05d3\u05e9\u05d4",
  resetSubtitle: "\u05d1\u05d7\u05e8 \u05e1\u05d9\u05e1\u05de\u05d4 \u05d7\u05d3\u05e9\u05d4 \u05db\u05d3\u05d9 \u05dc\u05d4\u05d9\u05db\u05e0\u05e1 \u05e9\u05d5\u05d1 \u05dc\u05d7\u05e9\u05d1\u05d5\u05df.",
  resetSubmit: "\u05e9\u05de\u05d5\u05e8 \u05e1\u05d9\u05e1\u05de\u05d4",
  resetPrompt: "\u05d4\u05d6\u05df \u05e1\u05d9\u05e1\u05de\u05d4 \u05d7\u05d3\u05e9\u05d4 \u05dc\u05d7\u05e9\u05d1\u05d5\u05df \u05e9\u05dc\u05da",
  resetSuccess: "\u05d4\u05e1\u05d9\u05e1\u05de\u05d4 \u05e2\u05d5\u05d3\u05db\u05e0\u05d4 \u05d1\u05d4\u05e6\u05dc\u05d7\u05d4",
  forgotSuccess: "\u05e9\u05dc\u05d7\u05e0\u05d5 \u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05d0\u05d9\u05e4\u05d5\u05e1 \u05d4\u05e1\u05d9\u05e1\u05de\u05d4 \u05dc\u05de\u05d9\u05d9\u05dc \u05e9\u05dc\u05da",
  registerSuccess: "\u05d1\u05d3\u05d5\u05e7 \u05d0\u05ea \u05d4\u05de\u05d9\u05d9\u05dc \u05db\u05d3\u05d9 \u05dc\u05d0\u05e9\u05e8 \u05d0\u05ea \u05d4\u05d7\u05e9\u05d1\u05d5\u05df",
} as const;

function getRecoveryMode() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return hashParams.get("type") === "recovery";
}

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signUp, resetPassword, updatePassword, authFlow, clearAuthFlow } = useAuth();
  const [mode, setMode] = useState<LoginMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function getLoginPath() {
    return `${import.meta.env.BASE_URL}login`.replace(/\/{2,}/g, "/");
  }

  useEffect(() => {
    if (getRecoveryMode() || authFlow === "recovery") {
      setMode("reset");
      setMessage(copy.resetPrompt);
    }
  }, [authFlow]);

  const modeCopy = useMemo(() => {
    if (mode === "forgot") {
      return {
        title: copy.forgotTitle,
        subtitle: copy.forgotSubtitle,
        submit: copy.forgotSubmit,
      };
    }

    if (mode === "reset") {
      return {
        title: copy.resetTitle,
        subtitle: copy.resetSubtitle,
        submit: copy.resetSubmit,
      };
    }

    if (mode === "register") {
      return {
        title: copy.registerTitle,
        subtitle: copy.registerSubtitle,
        submit: copy.registerSubmit,
      };
    }

    return {
      title: copy.loginTitle,
      subtitle: copy.loginSubtitle,
      submit: copy.loginSubmit,
    };
  }, [mode]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (mode === "forgot") {
      const result = await resetPassword(email);
      setMessage(result.error ?? copy.forgotSuccess);
      return;
    }

    if (mode === "reset") {
      const result = await updatePassword(password);
      setMessage(result.error ?? copy.resetSuccess);
      if (!result.error) {
        setPassword("");
        clearAuthFlow();
        navigate("/", { replace: true });
      }
      return;
    }

    if (mode === "login") {
      const result = await signIn(email, password);
      if (!result.error) {
        navigate("/", { replace: true });
        return;
      }

      setMessage(result.error);
      return;
    }

    const result = await signUp(email, password);
    setMessage(result.error ?? copy.registerSuccess);
  }

  const isPasswordMode = mode === "login" || mode === "register" || mode === "reset";

  return (
    <div className="auth-shell">
      <form className="card auth-card" onSubmit={(event) => void handleSubmit(event)}>
        <div className="auth-header">
          <h1 className="auth-title">{modeCopy.title}</h1>
          <p className="auth-subtitle">{modeCopy.subtitle}</p>
        </div>

        <div className="field">
          <label>{copy.email}</label>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="name@example.com"
          />
        </div>

        {isPasswordMode ? (
          <div className="field">
            <label>{mode === "reset" ? copy.newPassword : copy.password}</label>
            <div className="password-field">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder={mode === "reset" ? copy.newPassword : copy.password}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? copy.hidePassword : copy.showPassword}
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>
          </div>
        ) : null}

        {message ? <p className="auth-message">{message}</p> : null}

        <div className="auth-actions">
          <button type="submit">{modeCopy.submit}</button>

          <div className="auth-secondary-actions">
            {mode === "login" ? (
              <>
                <button type="button" className="auth-link-button" onClick={() => setMode("forgot")}>
                  {copy.forgotPassword}
                </button>
                <button type="button" className="auth-link-button" onClick={() => setMode("register")}>
                  {copy.noAccount}
                </button>
              </>
            ) : null}

            {mode === "register" ? (
              <button type="button" className="auth-link-button" onClick={() => setMode("login")}>
                {copy.haveAccount}
              </button>
            ) : null}

            {mode === "forgot" ? (
              <button type="button" className="auth-link-button" onClick={() => setMode("login")}>
                {copy.backToLogin}
              </button>
            ) : null}

            {mode === "reset" ? (
              <button
                type="button"
                className="auth-link-button"
                onClick={() => {
                  clearAuthFlow();
                  setMode("login");
                  window.history.replaceState({}, document.title, getLoginPath());
                }}
              >
                {copy.backToLogin}
              </button>
            ) : null}
          </div>
        </div>
      </form>
    </div>
  );
}
