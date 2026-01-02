import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ReactNode } from "react";

const ADMIN_EMAIL = "admin@studytrack.edu";

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  // 🔹 WAIT until Firebase resolves auth state
  if (loading) {
    return <div className="p-6 text-center">Loading admin panel...</div>;
  }

  // 🔹 AFTER loading, then check
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (user.email !== ADMIN_EMAIL) {
    return <Navigate to="/dashboard" replace />;
  }

  // ✅ ADMIN ALLOWED
  return <>{children}</>;
}
