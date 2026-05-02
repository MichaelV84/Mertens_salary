import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../services/auth-context";

export function Layout() {
  const { isAdmin } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          מחשבון שכר
        </Link>
      </header>
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
