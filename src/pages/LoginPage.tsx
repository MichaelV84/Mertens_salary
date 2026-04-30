import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../services/auth-context";

type LoginMode = "login" | "register" | "forgot" | "reset";

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
      setMessage("הזן סיסמה חדשה לחשבון שלך");
    }
  }, [authFlow]);

  const copy = useMemo(() => {
    if (mode === "forgot") {
      return {
        title: "איפוס סיסמה",
        subtitle: "נשלח למייל שלך קישור קצר להגדרת סיסמה חדשה.",
        submit: "שלח קישור",
      };
    }

    if (mode === "reset") {
      return {
        title: "סיסמה חדשה",
        subtitle: "בחר סיסמה חדשה כדי להיכנס שוב לחשבון.",
        submit: "שמור סיסמה",
      };
    }

    if (mode === "register") {
      return {
        title: "מחשבון שכר",
        subtitle: "צור חשבון כדי לנהל את נתוני השכר שלך.",
        submit: "הרשמה",
      };
    }

    return {
      title: "מחשבון שכר",
      subtitle: "התחבר כדי לנהל את נתוני השכר שלך.",
      submit: "כניסה",
    };
  }, [mode]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (mode === "forgot") {
      const result = await resetPassword(email);
      setMessage(result.error ?? "שלחנו קישור לאיפוס הסיסמה למייל שלך");
      return;
    }

    if (mode === "reset") {
      const result = await updatePassword(password);
      setMessage(result.error ?? "הסיסמה עודכנה בהצלחה");
      if (!result.error) {
        setPassword("");
        clearAuthFlow();
        navigate("/", { replace: true });
      }
      return;
    }

    const action = mode === "login" ? signIn : signUp;
    const result = await action(email, password);
    setMessage(result.error ?? (mode === "login" ? "ברוך הבא" : "בדוק את המייל כדי לאשר את החשבון"));
  }

  const isPasswordMode = mode === "login" || mode === "register" || mode === "reset";

  return (
    <div className="auth-shell">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <div className="auth-header">
          <h1 className="auth-title">{copy.title}</h1>
          <p className="auth-subtitle">{copy.subtitle}</p>
        </div>

        <div className="field">
          <label>אימייל</label>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="name@example.com"
          />
        </div>

        {isPasswordMode ? (
          <div className="field">
            <label>{mode === "reset" ? "סיסמה חדשה" : "סיסמה"}</label>
            <div className="password-field">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder={mode === "reset" ? "סיסמה חדשה" : "סיסמה"}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "הסתר סיסמה" : "הצג סיסמה"}
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>
          </div>
        ) : null}

        {message ? <p className="auth-message">{message}</p> : null}

        <div className="auth-actions">
          <button type="submit">{copy.submit}</button>

          <div className="auth-secondary-actions">
            {mode === "login" ? (
              <>
                <button type="button" className="auth-link-button" onClick={() => setMode("forgot")}>
                  שכחת סיסמה?
                </button>
                <button type="button" className="auth-link-button" onClick={() => setMode("register")}>
                  אין לך חשבון?
                </button>
              </>
            ) : null}

            {mode === "register" ? (
              <button type="button" className="auth-link-button" onClick={() => setMode("login")}>
                כבר יש לך חשבון?
              </button>
            ) : null}

            {mode === "forgot" ? (
              <button type="button" className="auth-link-button" onClick={() => setMode("login")}>
                חזרה לכניסה
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
                חזרה לכניסה
              </button>
            ) : null}
          </div>
        </div>
      </form>
    </div>
  );
}
