import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { Loader2, Shield } from "lucide-react";

/**
 * Gateway Component - Enterprise-grade post-login routing
 * Uses AuthContext's isAdmin which is the single source of truth
 * No direct Firestore calls - relies on AuthContext
 */
export default function Gateway() {
  const { user, profile, loading, isAdmin } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [hasRouted, setHasRouted] = useState(false);

  useEffect(() => {
    // Wait for auth to finish loading
    if (loading) {
      return;
    }

    // Prevent multiple navigations
    if (hasRouted) {
      return;
    }

    try {
      // If no user, go to auth
      if (!user) {
        navigate("/auth", { replace: true });
        setHasRouted(true);
        return;
      }

      // Wait for profile to load
      if (!profile) {
        // Set a timeout to prevent infinite loading (5 seconds)
        const timeoutId = setTimeout(() => {
          console.warn("Gateway: Profile loading timeout, redirecting to dashboard");
          navigate("/dashboard", { replace: true });
          setHasRouted(true);
        }, 5000);

        return () => clearTimeout(timeoutId);
      }

      // Route based on isAdmin from AuthContext (single source of truth)
      if (isAdmin) {
        navigate("/admin", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
      
      setHasRouted(true);
    } catch (error) {
      console.error("Error in gateway routing:", error);
      // Fallback to dashboard on error
      navigate("/dashboard", { replace: true });
      setHasRouted(true);
    }
  }, [user, profile, loading, isAdmin, navigate, hasRouted]);

  // Show loading while routing
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
        <p className="text-muted-foreground">Routing to your dashboard...</p>
      </div>
    </div>
  );
}