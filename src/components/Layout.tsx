import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { 
  BookOpen, 
  Search, 
  LogOut, 
  Settings, 
  User as UserIcon,
  Menu,
  X,
  ChevronRight,
  Bell
} from "lucide-react";
import { useState, useEffect } from "react";
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

  // --- 1. DETECT SPECIAL PAGES ---
  // We hide the global header/footer on these pages because they have their own.
  const isLandingPage = location.pathname === "/";
  const isAuthPage = location.pathname === "/auth";
  const isStandalonePage = isLandingPage || isAuthPage;

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
    <div className="min-h-screen flex flex-col font-sans selection:bg-primary/30">
      
      {/* --- CONDITIONAL HEADER --- */}
      {!isStandalonePage && (
        <header 
          className={cn(
            "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b",
            scrolled 
              ? "bg-background/80 backdrop-blur-xl border-border/40 shadow-sm py-3" 
              : "bg-transparent border-transparent py-5"
          )}
        >
          <div className="container mx-auto px-4 flex items-center justify-between">
            
            {/* Logo */}
            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => navigate("/dashboard")}>
              <div className={cn(
                "p-2 rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3",
                scrolled ? "bg-primary/10 text-primary" : "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
              )}>
                <BookOpen className="h-5 w-5" />
              </div>
              <span className="font-bold text-lg tracking-tight">StudySync</span>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1 bg-background/50 backdrop-blur-md px-2 py-1 rounded-full border border-border/40 shadow-sm">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(link.href);
                  }}
                  className={cn(
                    "px-4 py-1.5 text-sm font-medium rounded-full transition-all hover:bg-muted/80",
                    location.pathname === link.href ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {link.label}
                </a>
              ))}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-2 md:gap-4">
              <div className="hidden lg:flex items-center relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input 
                  placeholder="Search..." 
                  className="pl-9 pr-4 py-1.5 w-48 bg-muted/40 border border-transparent rounded-full text-sm focus:bg-background focus:border-primary/50 focus:w-64 transition-all outline-none" 
                />
              </div>

              <ThemeToggle />

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="rounded-full relative">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full ring-2 ring-background" />
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Avatar className="h-9 w-9 cursor-pointer ring-2 ring-transparent hover:ring-primary/20 transition-all">
                      <AvatarImage src={user?.photoURL || ""} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-white font-bold">
                        {user?.email?.[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-xl p-2">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user?.displayName || "Student"}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/profile")} className="rounded-lg cursor-pointer">
                      <UserIcon className="mr-2 h-4 w-4" /> Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem className="rounded-lg cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" /> Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="text-red-600 focus:text-red-600 rounded-lg cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" /> Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Mobile Menu Toggle */}
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="absolute top-full left-0 right-0 bg-background/95 backdrop-blur-xl border-b border-border/50 p-4 md:hidden animate-in slide-in-from-top-2">
              <div className="flex flex-col gap-2">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(link.href);
                    }}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted font-medium"
                  >
                    {link.label}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </header>
      )}

      {/* --- CONTENT WRAPPER --- */}
      {/* We remove padding-top if there is no header, so Landing/Auth can go full screen */}
      <main className={cn("flex-1", !isStandalonePage && "pt-24")}>
        <Outlet />
      </main>

      {/* --- CONDITIONAL FOOTER --- */}
      {/* We hide the global footer on Landing/Auth because they have their own specific footers */}
      {!isStandalonePage && (
        <footer className="border-t border-border/40 py-12 bg-muted/20 mt-auto">
          <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
              <BookOpen className="h-5 w-5 text-primary" />
              <span className="font-bold">StudySync</span>
            </div>
            
            <div className="flex gap-8 text-sm text-muted-foreground">
              <a href="#" className="hover:text-primary transition-colors">Privacy</a>
              <a href="#" className="hover:text-primary transition-colors">Terms</a>
              <a href="#" className="hover:text-primary transition-colors">Twitter</a>
            </div>
            
            <p className="text-sm text-muted-foreground">© 2025 StudySync Inc.</p>
          </div>
        </footer>
      )}

    </div>
  );
}