import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchUsers, updateUserBlocked } from "../services/api";
import { useAuth } from "../services/auth-context";
import type { AppUser } from "../types";

export function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    fetchUsers()
      .then(setUsers)
      .catch(() => {
        setUsers([]);
        setError("אי אפשר לטעון משתמשים");
      });
  }, [isAdmin]);

  async function toggleBlocked(user: AppUser) {
    await updateUserBlocked(user.id, !user.blocked);
    setUsers((current) =>
      current.map((item) => (item.id === user.id ? { ...item, blocked: !item.blocked } : item)),
    );
  }

  if (!loading && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="card">
      <h2>משתמשים</h2>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="stack">
        {users.map((user) => (
          <div key={user.id} className="row space-between">
            <div>
              <strong>{user.email}</strong>
              <p className="muted">{user.created_at}</p>
            </div>
            <button className="ghost-button" onClick={() => void toggleBlocked(user)}>
              {user.blocked ? "שחרור חסימה" : "חסימה"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
