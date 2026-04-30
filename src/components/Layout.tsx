import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../services/auth-context";

export function Layout() {
  const { isAdmin, profileError, profileLoading, profileMissing, user } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          מחשבון שכר
        </Link>
      </header>
      {user && profileLoading ? <div className="card status-banner">Loading account profile...</div> : null}
      {user && profileError ? <div className="card status-banner warning-banner">{profileError}</div> : null}
      {user && profileMissing ? (
        <div className="card status-banner warning-banner">
          Signed in as {user.email}, but the app profile was not found. Saved data and admin access may belong to a different account.
        </div>
      ) : null}
      <nav className="tabs">
        <NavLink to="/">חודש</NavLink>
        <NavLink to="/settings">הגדרות</NavLink>
        {isAdmin ? <NavLink to="/admin">ניהול</NavLink> : null}
      </nav>
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}
