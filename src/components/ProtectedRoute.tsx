import type { PropsWithChildren } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../services/auth-context";

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { user, authFlow, loading } = useAuth();

  if (authFlow === "recovery") {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
