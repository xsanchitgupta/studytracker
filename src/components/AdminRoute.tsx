import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { Shield, Loader2 } from "lucide-react";

/**
 * AdminRoute - Enterprise-grade route protection
 * Uses AuthContext's isAdmin which is computed from real-time profile data
 * No bruteforce checks - relies on single source of truth (Firebase profile)
 */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading, isAdmin } = useAuth();
  const { theme } = useTheme();

  // Show loading while auth state is being determined
  if (loading) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center transition-colors duration-300",
        theme === "dark" 
          ? "bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-background to-background"
          : "bg-gradient-to-br from-background via-background to-muted/20"
      )}>
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className={cn("p-4 rounded-2xl",
              theme === "dark" ? "bg-primary/20" : "bg-primary/10"
            )}>
              <Shield className="h-12 w-12 text-primary animate-pulse" />
            </div>
          </div>
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // No user = redirect to auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // No profile yet = wait a bit more (shouldn't happen but safety check)
  if (!profile) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center transition-colors duration-300",
        theme === "dark" 
          ? "bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-background to-background"
          : "bg-gradient-to-br from-background via-background to-muted/20"
      )}>
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Check admin status from AuthContext (computed from profile.role)
  // This is the single source of truth
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // ✅ Admin verified - render children
  return <>{children}</>;
}