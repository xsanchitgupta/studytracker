import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ReactNode } from "react";

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();

  // 🔹 WAIT until Firebase resolves auth state
  if (loading) {
    return <div className="p-6 text-center">Loading admin panel...</div>;
  }

  // 🔹 AFTER loading, then check
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Check role from profile (stored in Firebase)
  if (!profile || profile.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  // ✅ ADMIN ALLOWED
  return <>{children}</>;
}