import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Target,
  Trophy,
  Play,
  TrendingUp,
  ArrowRight,
  Zap,
  Cpu,
  CheckCircle2,
  Menu,
  X,
  ChevronRight,
  GraduationCap
} from "lucide-react";

// --- COMPONENTS ---

// 1. ADAPTIVE SPOTLIGHT CARD
// Detects touch devices to show a static glow instead of mouse-following
const SpotlightCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-background/50 backdrop-blur-md transition-all duration-300",
        className
      )}
    >
      {/* Mouse Spotlight (Desktop) */}
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 hidden md:block"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(120, 119, 198, 0.15), transparent 40%)`,
        }}
      />
      
      {/* Static Glow (Mobile) - subtle permanent highlight */}
      <div 
        className="absolute inset-0 md:hidden pointer-events-none"
        style={{
            background: `radial-gradient(circle at 50% 0%, rgba(120, 119, 198, 0.1), transparent 70%)`
        }}
      />
      
      <div className="relative h-full">{children}</div>
    </div>
  );
};

// 2. MOBILE-OPTIMIZED MARQUEE
const Marquee = ({ items }: { items: string[] }) => {
  return (
    <div className="relative flex w-full overflow-hidden border-y border-border/40 bg-background/50 py-6 md:py-10 backdrop-blur-sm">
      <div className="absolute inset-y-0 left-0 w-12 md:w-20 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="absolute inset-y-0 right-0 w-12 md:w-20 bg-gradient-to-l from-background to-transparent z-10" />
      <div className="flex animate-marquee whitespace-nowrap">
        {items.concat(items).map((item, i) => (
          <div key={i} className="mx-4 md:mx-8 flex items-center gap-2 text-sm md:text-xl font-bold text-muted-foreground/50 grayscale transition-all hover:scale-110 hover:grayscale-0 hover:text-foreground">
             <GraduationCap className="h-4 w-4 md:h-6 md:w-6" /> {item}
          </div>
        ))}
      </div>
    </div>
  );
};

// --- MAIN PAGE ---

const Landing = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [mobileMenuOpen]);

  if (!mounted) return null;

  return (
    <div className={cn("min-h-screen selection:bg-primary/30 font-sans overflow-x-hidden",
      theme === "dark" ? "bg-black text-white" : "bg-white text-zinc-950"
    )}>

      {/* BACKGROUND GRID */}
      <div className="fixed inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:14px_14px] md:bg-[size:24px_24px]">
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[200px] w-[200px] md:h-[310px] md:w-[310px] rounded-full bg-primary/20 opacity-20 blur-[80px]" />
      </div>

      {/* NAVBAR */}
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-2 px-2 md:pt-4 md:px-4">
        <nav className={cn(
          "flex items-center justify-between gap-4 rounded-full border px-4 py-2.5 md:px-6 md:py-3 shadow-lg backdrop-blur-xl transition-all duration-300 w-full max-w-5xl",
          theme === "dark" ? "bg-zinc-900/80 border-white/10" : "bg-white/80 border-zinc-200"
        )}>
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <div className="bg-primary/20 p-1.5 rounded-lg text-primary">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="font-bold tracking-tight text-lg">StudySync</span>
          </div>
          
          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-primary transition-colors">Features</a>
            <a href="#leaderboard" className="hover:text-primary transition-colors">Leaderboard</a>
            <a href="#pricing" className="hover:text-primary transition-colors">Pricing</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            <Button size="sm" onClick={() => navigate("/auth")} className="rounded-full px-5 shadow-lg shadow-primary/20">
              Get Started
            </Button>
          </div>

          {/* Mobile Toggles */}
          <div className="flex md:hidden items-center gap-2">
             <ThemeToggle />
             <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)} className="rounded-full">
                <Menu className="h-5 w-5" />
             </Button>
          </div>
        </nav>
      </div>

      {/* MOBILE FULLSCREEN MENU */}
      <div className={cn(
        "fixed inset-0 z-[60] bg-background/95 backdrop-blur-2xl transition-all duration-300 flex flex-col p-6",
        mobileMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full pointer-events-none"
      )}>
         <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-2">
               <div className="bg-primary/20 p-1.5 rounded-lg text-primary">
                  <BookOpen className="h-5 w-5" />
               </div>
               <span className="font-bold text-xl">StudySync</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)} className="rounded-full">
               <X className="h-6 w-6" />
            </Button>
         </div>

         <div className="flex flex-col gap-6 text-2xl font-medium">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-between py-2 border-b border-border/10">
               Features <ChevronRight className="h-5 w-5 opacity-30" />
            </a>
            <a href="#leaderboard" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-between py-2 border-b border-border/10">
               Leaderboard <ChevronRight className="h-5 w-5 opacity-30" />
            </a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-between py-2 border-b border-border/10">
               Pricing <ChevronRight className="h-5 w-5 opacity-30" />
            </a>
         </div>

         <div className="mt-auto space-y-4">
            <Button size="lg" className="w-full rounded-full h-12 text-lg" onClick={() => { setMobileMenuOpen(false); navigate("/auth"); }}>
               Get Started Now
            </Button>
            <p className="text-center text-sm text-muted-foreground">v2.0 • Mobile Optimized</p>
         </div>
      </div>

      {/* HERO SECTION */}
      <main className="container mx-auto px-4 pt-28 pb-12 md:pt-32 md:pb-20 text-center">
        
        {/* Badge */}
        <div className="mb-6 md:mb-8 flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-700">
           <div className={cn(
             "group flex items-center gap-2 rounded-full border px-3 py-1 md:px-4 md:py-1.5 text-[10px] md:text-xs font-medium transition-all hover:bg-muted/80 cursor-pointer",
             theme === "dark" ? "bg-zinc-900/80 border-white/10" : "bg-white border-zinc-200"
           )}>
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">v2.0: AI Flashcards & Chat</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
           </div>
        </div>

        {/* Headline */}
        <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight md:text-7xl lg:text-8xl animate-in fade-in slide-in-from-bottom-8 duration-1000 leading-[1.1]">
          The OS for <br />
          <span className="relative whitespace-nowrap text-primary">
            <span className="relative z-10 bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">High Achievers.</span>
            <span className="absolute -bottom-1 md:-bottom-2 left-0 -z-10 h-[20%] w-full -rotate-1 bg-primary/20 blur-xl" />
          </span>
        </h1>

        {/* Subheadline */}
        <p className="mx-auto mt-6 md:mt-8 max-w-2xl text-base md:text-xl text-muted-foreground leading-relaxed animate-in fade-in slide-in-from-bottom-12 duration-1000 px-4">
          Stop struggling with scattered notes. 
          StudySync organizes your lectures, tracks your goals, and ranks your progress globally.
        </p>

        {/* CTA Buttons */}
        <div className="mt-8 md:mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row animate-in fade-in slide-in-from-bottom-16 duration-1000 px-4">
          <Button 
            size="lg" 
            onClick={() => navigate("/auth")} 
            className="h-12 w-full sm:w-auto rounded-full px-8 text-base font-semibold shadow-xl shadow-primary/25 transition-all active:scale-95"
          >
            Start Studying Now
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          
          <Button 
            variant="outline" 
            size="lg" 
            className="h-12 w-full sm:w-auto rounded-full border-2 bg-transparent px-8 text-base active:scale-95"
          >
            <Play className="mr-2 h-4 w-4" />
            Watch Demo
          </Button>
        </div>

        {/* Hero Image / Dashboard Preview */}
        <div className="mt-12 md:mt-20 relative mx-auto max-w-5xl animate-in fade-in zoom-in duration-1000 delay-300 px-2 md:px-0">
            <div className={cn(
              "relative rounded-xl md:rounded-2xl border p-1 md:p-2 shadow-2xl overflow-hidden",
              theme === "dark" ? "bg-zinc-900/50 border-white/10" : "bg-white/50 border-zinc-200"
            )}>
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-20" />
              
              <div className="aspect-video rounded-lg md:rounded-xl bg-zinc-950 border border-white/5 relative flex flex-col">
                  {/* Fake Browser Top */}
                  <div className="h-8 md:h-12 border-b border-white/5 bg-white/5 flex items-center px-3 md:px-4 gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-red-500/50" />
                      <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-yellow-500/50" />
                      <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-green-500/50" />
                    </div>
                    <div className="mx-auto w-1/3 h-4 md:h-6 bg-white/5 rounded-full" />
                  </div>
                  
                  {/* Fake Content */}
                  <div className="flex-1 p-3 md:p-8 flex gap-4 md:gap-8">
                     <div className="w-32 md:w-48 h-full hidden md:flex flex-col gap-3 opacity-50">
                        <div className="h-8 bg-white/10 rounded-lg w-full" />
                        <div className="h-8 bg-white/5 rounded-lg w-full" />
                        <div className="h-8 bg-white/5 rounded-lg w-full" />
                     </div>
                     
                     <div className="flex-1 space-y-2 md:space-y-4">
                        <div className="flex gap-2 md:gap-4">
                           <div className="h-20 md:h-32 flex-1 bg-gradient-to-br from-primary/20 to-purple-500/10 rounded-lg md:rounded-2xl border border-primary/20 p-2 md:p-4 relative overflow-hidden">
                              <div className="absolute top-2 left-2 md:top-4 md:left-4 w-6 h-6 md:w-8 md:h-8 rounded-full bg-primary/20" />
                           </div>
                           <div className="h-20 md:h-32 flex-1 bg-white/5 rounded-lg md:rounded-2xl border border-white/5 hidden sm:block" />
                        </div>
                        <div className="h-32 md:h-64 bg-white/5 rounded-lg md:rounded-2xl border border-white/5 w-full flex items-center justify-center">
                            <div className="text-center px-2">
                                <TrendingUp className="h-8 w-8 md:h-12 md:w-12 text-muted-foreground/20 mx-auto mb-2" />
                                <p className="text-muted-foreground/30 font-mono text-xs md:text-sm">Real-time Performance Metrics</p>
                            </div>
                        </div>
                     </div>
                  </div>
              </div>
            </div>
        </div>
      </main>

      {/* MARQUEE */}
      <Marquee items={["Engineering", "Medical", "Arts", "Law", "CS", "Business", "Psychology"]} />

      {/* FEATURES - MOBILE OPTIMIZED LAYOUT */}
      <section id="features" className="container mx-auto px-4 py-16 md:py-32">
        <div className="mb-12 md:mb-20 text-center">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Built for students. <br />
            <span className="text-muted-foreground">Powered by data.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {/* Feature 1: Playlists - Reduced height on mobile */}
          <SpotlightCard className="md:col-span-2 row-span-1 md:row-span-2 min-h-[350px] md:min-h-[400px] group">
             <div className="p-6 md:p-10 h-full flex flex-col justify-between relative z-10">
                <div>
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 md:mb-6 text-primary">
                    <Play className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold mb-2 md:mb-4">Focus-First Playlists</h3>
                  <p className="text-muted-foreground text-base md:text-lg max-w-md">
                    Import YouTube lectures into a distraction-free zone. 
                    Take timestamped notes and track your watch time.
                  </p>
                </div>
                
                {/* Visual */}
                <div className="mt-6 md:mt-8 relative h-32 md:h-40 w-full bg-background/40 rounded-xl border border-border/50 overflow-hidden flex flex-col p-3 md:p-4 gap-2 shadow-inner">
                   {[1, 2].map((i) => (
                     <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-background/80 border border-border/20">
                        <div className="h-6 w-10 md:h-8 md:w-12 bg-muted rounded flex items-center justify-center">
                          <Play className="h-2 w-2 md:h-3 md:w-3 opacity-50" />
                        </div>
                        <div className="flex-1 space-y-1">
                           <div className="h-1.5 md:h-2 w-3/4 bg-muted-foreground/20 rounded" />
                        </div>
                        {i === 1 && <CheckCircle2 className="h-3 w-3 md:h-4 md:w-4 text-green-500" />}
                     </div>
                   ))}
                </div>
             </div>
          </SpotlightCard>

          {/* Feature 2: Goals */}
          <SpotlightCard className="min-h-[250px] md:min-h-[300px]">
             <div className="p-6 md:p-8 h-full flex flex-col">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 text-purple-500">
                  <Target className="h-4 w-4 md:h-5 md:w-5" />
                </div>
                <h3 className="text-lg md:text-xl font-bold mb-2">Smart Goals</h3>
                <p className="text-muted-foreground text-sm flex-1">
                  Break down massive exams into daily sub-goals.
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs text-foreground font-medium bg-background/50 p-2 rounded-lg border border-border/30">
                   <div className="w-3 h-3 rounded border border-primary" />
                   <span>Physics Report Due</span>
                </div>
             </div>
          </SpotlightCard>

          {/* Feature 3: Performance */}
          <SpotlightCard className="min-h-[250px] md:min-h-[300px]">
             <div className="p-6 md:p-8 h-full flex flex-col">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-pink-500/10 flex items-center justify-center mb-4 text-pink-500">
                  <Cpu className="h-4 w-4 md:h-5 md:w-5" />
                </div>
                <h3 className="text-lg md:text-xl font-bold mb-2">Analytics</h3>
                <p className="text-muted-foreground text-sm">
                  Maintain your streak and watch your study hours graph go up.
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs font-mono text-muted-foreground">
                   <Zap className="h-4 w-4 text-yellow-500" />
                   <span>12 Day Streak</span>
                </div>
             </div>
          </SpotlightCard>

          {/* Feature 4: Leaderboard */}
          <SpotlightCard className="md:col-span-3 min-h-[200px] md:min-h-[250px] flex items-center">
             <div className="p-6 md:p-8 w-full flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8">
                <div className="flex-1 text-center md:text-left">
                   <div className="flex items-center justify-center md:justify-start gap-3 mb-2 md:mb-4">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <Trophy className="h-4 w-4 md:h-5 md:w-5" />
                      </div>
                      <h3 className="text-xl md:text-2xl font-bold">Global Leaderboards</h3>
                   </div>
                   <p className="text-muted-foreground text-sm md:text-base">
                      Compete with peers based on study hours and tasks completed.
                   </p>
                </div>
                <div className="flex gap-3 md:gap-4 w-full md:w-auto justify-center">
                   <div className="px-4 py-2 md:px-6 md:py-4 rounded-xl md:rounded-2xl bg-background/50 border border-border/50 text-center shadow-lg">
                      <div className="text-xl md:text-2xl font-bold">#1</div>
                      <div className="text-[10px] md:text-xs text-muted-foreground uppercase">Rank</div>
                   </div>
                   <div className="px-4 py-2 md:px-6 md:py-4 rounded-xl md:rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 text-center shadow-lg">
                      <div className="text-xl md:text-2xl font-bold text-yellow-500">Gold</div>
                      <div className="text-[10px] md:text-xs text-yellow-600/80 uppercase">League</div>
                   </div>
                </div>
             </div>
          </SpotlightCard>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/40 py-8 md:py-12 bg-background/50 backdrop-blur-lg">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
           <div className="flex items-center gap-2 opacity-80">
              <BookOpen className="h-5 w-5 text-primary" />
              <span className="font-bold">StudySync</span>
           </div>
           
           <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-primary transition-colors">Privacy</a>
              <a href="#" className="hover:text-primary transition-colors">Terms</a>
              <a href="#" className="hover:text-primary transition-colors">Twitter</a>
           </div>
           
           <p className="text-xs text-muted-foreground">© 2025 StudySync Inc.</p>
        </div>
      </footer>
      
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default Landing;