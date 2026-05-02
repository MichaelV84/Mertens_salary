import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { fetchUsers, updateUserBlocked } from "../services/api";
import { useAuth } from "../services/auth-context";
import { formatSupabaseError } from "../services/errors";
import type { AppUser } from "../types";

const labels = {
  title: "משתמשים",
  loadError: "אי אפשר לטעון משתמשים",
  updateError: "אי אפשר לעדכן את מצב החסימה",
  block: "חסימה",
  unblock: "שחרור חסימה",
} as const;

export function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [error, setError] = useState("");
  const [submittingUserId, setSubmittingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    let isActive = true;
    setError("");

    fetchUsers()
      .then((loadedUsers) => {
        if (!isActive) {
          return;
        }

        setUsers(loadedUsers);
      })
      .catch((loadError) => {
        if (!isActive) {
          return;
        }

        setUsers([]);
        setError(formatSupabaseError(loadError, labels.loadError));
      });

    return () => {
      isActive = false;
    };
  }, [isAdmin]);

  async function toggleBlocked(user: AppUser) {
    const nextBlocked = !user.blocked;

    setSubmittingUserId(user.id);
    setError("");
    setUsers((current) =>
      current.map((item) => (item.id === user.id ? { ...item, blocked: nextBlocked } : item)),
    );

    try {
      await updateUserBlocked(user.id, nextBlocked);
    } catch (updateError) {
      setUsers((current) =>
        current.map((item) => (item.id === user.id ? { ...item, blocked: user.blocked } : item)),
      );
      setError(formatSupabaseError(updateError, labels.updateError));
    } finally {
      setSubmittingUserId(null);
    }
  }

  if (!loading && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="card">
      <h2>{labels.title}</h2>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="stack">
        {users.map((user) => (
          <div key={user.id} className="row space-between">
            <div>
              <strong>{user.email}</strong>
              <p className="muted">{user.created_at}</p>
            </div>
            <button
              className="ghost-button"
              disabled={submittingUserId === user.id}
              onClick={() => void toggleBlocked(user)}
            >
              {user.blocked ? labels.unblock : labels.block}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
