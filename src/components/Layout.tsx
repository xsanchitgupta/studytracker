import { useState, useEffect } from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { 
  BookOpen, Search, LogOut, Settings, User as UserIcon,
  Menu, X, ChevronRight, Bell, Command, Sparkles
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // --- 1. CONFIGURATION ---
  const isStandalonePage = ["/", "/auth", "/chat"].includes(location.pathname);
  
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => setMobileMenuOpen(false), [location.pathname]);

  const navLinks = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Goals", href: "/goals" },
    { label: "Playlists", href: "/playlists" },
    { label: "Leaderboard", href: "/leaderboard" },
  ];

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-primary/30 bg-background text-foreground transition-colors duration-500">
      
      {/* --- FLOATING HUD HEADER --- */}
      {!isStandalonePage && (
        <header 
          className={cn(
            "fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out border-b border-transparent",
            scrolled 
              ? "bg-background/70 backdrop-blur-2xl border-border/40 py-3 shadow-sm supports-[backdrop-filter]:bg-background/60" 
              : "bg-transparent py-5"
          )}
        >
          <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
            
            {/* 1. BRAND IDENTITY */}
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate("/dashboard")}>
              <div className={cn(
                "relative p-2 rounded-xl overflow-hidden transition-all duration-500 group-hover:scale-110",
                scrolled ? "bg-primary/10 text-primary" : "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
              )}>
                <BookOpen className="h-5 w-5 relative z-10" />
                <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg tracking-tight leading-none">StudySync</span>
                {/* VERSION TAG: Removed opacity-0 to keep it visible */}
                <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mt-0.5">OS v2.4</span>
              </div>
            </div>

            {/* 2. NAVIGATION PILL */}
            <nav className="hidden md:flex items-center gap-1 bg-muted/40 backdrop-blur-md p-1.5 rounded-full border border-white/5 shadow-inner">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.href;
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => { e.preventDefault(); navigate(link.href); }}
                    className={cn(
                      "relative px-5 py-2 text-sm font-medium rounded-full transition-all duration-300",
                      isActive 
                        ? "text-primary-foreground bg-background shadow-md" 
                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                    )}
                  >
                    {isActive && (
                      <span className="absolute inset-0 bg-primary/10 rounded-full blur-md -z-10" />
                    )}
                    {link.label}
                  </a>
                );
              })}
            </nav>

            {/* 3. ACTION CLUSTER */}
            <div className="flex items-center gap-3 md:gap-5">
              
              {/* Search Trigger */}
              <div className="hidden lg:flex items-center group relative cursor-pointer hover:scale-105 transition-transform">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-50 transition-opacity" />
                <div className="relative flex items-center gap-2 px-3 py-1.5 bg-background/50 border border-input rounded-full text-sm text-muted-foreground shadow-sm group-hover:border-primary/50 transition-colors">
                  <Search className="h-3.5 w-3.5" />
                  <span className="opacity-50 text-xs">Search...</span>
                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-muted rounded-md text-[10px] font-mono border border-border">
                    <Command className="h-3 w-3" /> K
                  </div>
                </div>
              </div>

              <div className="w-px h-6 bg-border/50 hidden md:block" />

              <ThemeToggle />

              {/* Notifications */}
              <Button variant="ghost" size="icon" className="rounded-full relative hover:bg-primary/10 transition-colors group">
                <Bell className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="absolute top-2.5 right-2.5 h-2 w-2 bg-red-500 rounded-full border-2 border-background animate-pulse" />
              </Button>
              
              {/* Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Avatar className="h-9 w-9 cursor-pointer ring-2 ring-transparent hover:ring-primary/20 transition-all active:scale-95">
                    <AvatarImage src={user?.photoURL || ""} className="object-cover" />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-white font-bold text-xs">
                      {user?.email?.[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-border/50 backdrop-blur-xl bg-background/95 shadow-xl">
                  <DropdownMenuLabel className="font-normal px-2 py-3">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-bold leading-none">{user?.displayName || "Scholar"}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border/50" />
                  <DropdownMenuItem onClick={() => navigate("/profile")} className="rounded-xl cursor-pointer py-2.5 focus:bg-primary/10 focus:text-primary">
                    <UserIcon className="mr-2 h-4 w-4" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem className="rounded-xl cursor-pointer py-2.5 focus:bg-primary/10 focus:text-primary">
                    <Settings className="mr-2 h-4 w-4" /> Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border/50" />
                  <DropdownMenuItem onClick={logout} className="text-red-500 focus:text-red-600 focus:bg-red-500/10 rounded-xl cursor-pointer py-2.5">
                    <LogOut className="mr-2 h-4 w-4" /> Terminate Session
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Mobile Toggle */}
              <Button variant="ghost" size="icon" className="md:hidden rounded-full" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          {/* 4. MOBILE MENU OVERLAY */}
          <div className={cn(
            "absolute top-full left-0 right-0 bg-background/95 backdrop-blur-2xl border-b border-border/50 p-6 md:hidden transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] origin-top",
            mobileMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
          )}>
            <div className="flex flex-col gap-2">
              {navLinks.map((link, i) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => { e.preventDefault(); navigate(link.href); }}
                  className="flex items-center justify-between p-4 rounded-2xl hover:bg-muted/50 font-medium text-lg active:scale-[0.98] transition-all"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <span className="flex items-center gap-3">
                    <div className={cn("w-1.5 h-1.5 rounded-full", location.pathname === link.href ? "bg-primary" : "bg-muted-foreground/30")} />
                    {link.label}
                  </span>
                  <ChevronRight className="h-5 w-5 text-muted-foreground/50" />
                </a>
              ))}
            </div>
          </div>
        </header>
      )}

      {/* --- CONTENT INJECTION --- */}
      <main className={cn("flex-1 relative z-0", !isStandalonePage && "pt-24")}>
        <div className="absolute inset-0 -z-10 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02]" />
        <Outlet />
      </main>

      {/* --- FOOTER --- */}
      {!isStandalonePage && (
        <footer className="border-t border-border/40 py-16 bg-muted/5 mt-auto">
          <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity cursor-default">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              <span className="font-bold tracking-tight text-sm">StudySync OS</span>
            </div>
            
            <div className="flex gap-8 text-xs font-medium text-muted-foreground uppercase tracking-widest">
              <a href="#" className="hover:text-primary transition-colors">Privacy Protocol</a>
              <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-primary transition-colors">Support Uplink</a>
            </div>
            
            <p className="text-xs text-muted-foreground/50 font-mono">v2.4.0 • Build 8921</p>
          </div>
        </footer>
      )}

    </div>
  );
}