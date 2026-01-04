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
  Brain,
  Globe,
  Users,
  ChevronRight,
  GraduationCap,
  Layout,
  Cpu,
  CheckCircle2,
  Lock,
  MessageCircle
} from "lucide-react";

// --- COMPONENTS ---

// 1. SPOTLIGHT CARD
const SpotlightCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleFocus = () => {
    setOpacity(1);
  };

  const handleBlur = () => {
    setOpacity(0);
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleFocus}
      onMouseLeave={handleBlur}
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-background/50 backdrop-blur-md transition-all duration-300",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(120, 119, 198, 0.15), transparent 40%)`,
        }}
      />
      <div className="relative h-full">{children}</div>
    </div>
  );
};

// 2. INFINITE MARQUEE
const Marquee = ({ items }: { items: string[] }) => {
  return (
    <div className="relative flex w-full overflow-hidden border-y border-border/40 bg-background/50 py-10 backdrop-blur-sm">
      <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-background to-transparent z-10" />
      <div className="flex animate-marquee whitespace-nowrap">
        {items.concat(items).map((item, i) => (
          <div key={i} className="mx-8 flex items-center gap-2 text-xl font-bold text-muted-foreground/50 grayscale transition-all hover:scale-110 hover:grayscale-0 hover:text-foreground">
             <GraduationCap className="h-6 w-6" /> {item}
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

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className={cn("min-h-screen selection:bg-primary/30 font-sans",
      theme === "dark" ? "bg-black text-white" : "bg-white text-zinc-950"
    )}>

      {/* DYNAMIC BACKGROUND GRID */}
      <div className="fixed inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]">
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/20 opacity-20 blur-[100px]" />
      </div>

      {/* FLOATING NAVBAR */}
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-4">
        <nav className={cn(
          "flex items-center gap-4 rounded-full border px-6 py-3 shadow-lg backdrop-blur-xl transition-all duration-300",
          theme === "dark" ? "bg-zinc-900/60 border-white/10" : "bg-white/70 border-zinc-200"
        )}>
          <div className="flex items-center gap-2 pr-6 border-r border-border/50 cursor-pointer" onClick={() => navigate("/")}>
            <div className="bg-primary/20 p-1.5 rounded-lg text-primary">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="font-bold tracking-tight">StudySync</span>
          </div>
          
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-primary transition-colors">Features</a>
            <a href="#leaderboard" className="hover:text-primary transition-colors">Leaderboard</a>
            <a href="#pricing" className="hover:text-primary transition-colors">Pricing</a>
          </div>

          <div className="pl-2 flex items-center gap-2">
            <ThemeToggle />
            <Button size="sm" onClick={() => navigate("/auth")} className="rounded-full px-5 shadow-lg shadow-primary/20">
              Get Started
            </Button>
          </div>
        </nav>
      </div>

      {/* HERO SECTION */}
      <main className="container mx-auto px-4 pt-32 pb-20 text-center">
        
        {/* Badge */}
        <div className="mb-8 flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-700">
           <div className={cn(
             "group flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium transition-all hover:bg-muted/80 cursor-pointer",
             theme === "dark" ? "bg-zinc-900/80 border-white/10" : "bg-white border-zinc-200"
           )}>
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">v2.0: AI Flashcards & Chat</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
           </div>
        </div>

        {/* Headline */}
        <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight md:text-7xl lg:text-8xl animate-in fade-in slide-in-from-bottom-8 duration-1000">
          The Operating System for <br />
          <span className="relative whitespace-nowrap text-primary">
            <span className="relative z-10 bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">High Achievers.</span>
            <span className="absolute -bottom-2 left-0 -z-10 h-[20%] w-full -rotate-1 bg-primary/20 blur-xl" />
          </span>
        </h1>

        {/* Subheadline */}
        <p className="mx-auto mt-8 max-w-2xl text-lg text-muted-foreground md:text-xl leading-relaxed animate-in fade-in slide-in-from-bottom-12 duration-1000">
          Stop struggling with scattered notes and YouTube distractions. 
          StudySync organizes your lectures, tracks your goals, and ranks your progress globally.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row animate-in fade-in slide-in-from-bottom-16 duration-1000">
          <Button 
            size="lg" 
            onClick={() => navigate("/auth")} 
            className="h-14 min-w-[200px] rounded-full px-8 text-base font-semibold shadow-xl shadow-primary/25 transition-all hover:scale-105 hover:shadow-primary/40"
          >
            Start Studying Now
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          
          <Button 
            variant="outline" 
            size="lg" 
            className="h-14 min-w-[200px] rounded-full border-2 bg-transparent px-8 text-base hover:bg-muted/50 transition-all hover:scale-105"
          >
            <Play className="mr-2 h-4 w-4" />
            Watch Demo
          </Button>
        </div>

        {/* Hero Image / Dashboard Preview */}
        <div className="mt-20 relative mx-auto max-w-5xl animate-in fade-in zoom-in duration-1000 delay-300">
            <div className={cn(
              "relative rounded-2xl border p-2 shadow-2xl overflow-hidden",
              theme === "dark" ? "bg-zinc-900/50 border-white/10" : "bg-white/50 border-zinc-200"
            )}>
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-20" />
              
              {/* Abstract Dashboard UI */}
              <div className="aspect-video rounded-xl bg-zinc-950 border border-white/5 relative flex flex-col">
                  {/* Fake Browser Top */}
                  <div className="h-12 border-b border-white/5 bg-white/5 flex items-center px-4 gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/50" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                      <div className="w-3 h-3 rounded-full bg-green-500/50" />
                    </div>
                    <div className="mx-auto w-1/3 h-6 bg-white/5 rounded-full" />
                  </div>
                  
                  {/* Fake Content */}
                  <div className="flex-1 p-8 flex gap-8">
                     {/* Sidebar */}
                     <div className="w-48 h-full hidden md:flex flex-col gap-3 opacity-50">
                        <div className="h-8 bg-white/10 rounded-lg w-full" />
                        <div className="h-8 bg-white/5 rounded-lg w-full" />
                        <div className="h-8 bg-white/5 rounded-lg w-full" />
                     </div>
                     
                     {/* Main Area */}
                     <div className="flex-1 space-y-4">
                        <div className="flex gap-4">
                           <div className="h-32 flex-1 bg-gradient-to-br from-primary/20 to-purple-500/10 rounded-2xl border border-primary/20 p-4 relative overflow-hidden">
                              <div className="absolute top-4 left-4 w-8 h-8 rounded-full bg-primary/20" />
                              <div className="absolute bottom-4 left-4 h-4 w-24 bg-primary/20 rounded" />
                           </div>
                           <div className="h-32 flex-1 bg-white/5 rounded-2xl border border-white/5 p-4" />
                           <div className="h-32 flex-1 bg-white/5 rounded-2xl border border-white/5 p-4" />
                        </div>
                        <div className="h-64 bg-white/5 rounded-2xl border border-white/5 w-full flex items-center justify-center">
                            <div className="text-center">
                                <TrendingUp className="h-12 w-12 text-muted-foreground/20 mx-auto mb-2" />
                                <p className="text-muted-foreground/30 font-mono text-sm">Real-time Performance Metrics</p>
                            </div>
                        </div>
                     </div>
                  </div>
              </div>
            </div>
            
            {/* Decorative Glows */}
            <div className="absolute -top-20 -right-20 -z-10 h-[300px] w-[300px] rounded-full bg-purple-500/20 blur-[100px]" />
            <div className="absolute -bottom-20 -left-20 -z-10 h-[300px] w-[300px] rounded-full bg-blue-500/20 blur-[100px]" />
        </div>
      </main>

      {/* MARQUEE SECTION */}
      <Marquee items={["Engineering", "Medical", "Arts", "Law", "Computer Science", "Business", "Economics", "Psychology"]} />

      {/* BENTO GRID FEATURES */}
      <section id="features" className="container mx-auto px-4 py-32">
        <div className="mb-20 text-center">
          <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
            Built for serious students. <br />
            <span className="text-muted-foreground">Powered by your data.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Feature 1: Large (Playlists) */}
          <SpotlightCard className="md:col-span-2 row-span-2 min-h-[400px] group">
             <div className="p-10 h-full flex flex-col justify-between relative z-10">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 text-primary">
                    <Play className="h-6 w-6" />
                  </div>
                  <h3 className="text-3xl font-bold mb-4">Focus-First Playlists</h3>
                  <p className="text-muted-foreground text-lg max-w-md">
                    Import YouTube lectures into a distraction-free zone. 
                    Take timestamped notes, mark completion, and track your watch time automatically.
                  </p>
                </div>
                
                {/* Visual */}
                <div className="mt-8 relative h-40 w-full bg-background/40 rounded-xl border border-border/50 overflow-hidden flex flex-col p-4 gap-2 shadow-inner">
                   {/* Fake Video List */}
                   {[1, 2].map((i) => (
                     <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-background/80 border border-border/20">
                        <div className="h-8 w-12 bg-muted rounded flex items-center justify-center">
                          <Play className="h-3 w-3 opacity-50" />
                        </div>
                        <div className="flex-1 space-y-1">
                           <div className="h-2 w-3/4 bg-muted-foreground/20 rounded" />
                           <div className="h-1.5 w-1/2 bg-muted-foreground/10 rounded" />
                        </div>
                        {i === 1 && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                     </div>
                   ))}
                </div>
             </div>
          </SpotlightCard>

          {/* Feature 2: Tall (Goals) */}
          <SpotlightCard className="min-h-[300px]">
             <div className="p-8 h-full flex flex-col">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 text-purple-500">
                  <Target className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold mb-2">Smart Goal Tracking</h3>
                <p className="text-muted-foreground text-sm flex-1">
                  Break down massive exams into daily sub-goals. Set deadlines and let our algorithm nag you to finish them.
                </p>
                <div className="mt-4 space-y-2">
                   <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="w-4 h-4 rounded border flex items-center justify-center bg-green-500 border-green-500">
                         <CheckCircle2 className="h-3 w-3 text-white" />
                      </div>
                      <span className="line-through">Calculus Chapter 1</span>
                   </div>
                   <div className="flex items-center gap-2 text-xs text-foreground font-medium">
                      <div className="w-4 h-4 rounded border border-primary" />
                      <span>Physics Lab Report</span>
                   </div>
                </div>
             </div>
          </SpotlightCard>

          {/* Feature 3: Tall (Performance) */}
          <SpotlightCard className="min-h-[300px]">
             <div className="p-8 h-full flex flex-col">
                <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center mb-4 text-pink-500">
                  <Cpu className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold mb-2">Performance Analytics</h3>
                <p className="text-muted-foreground text-sm">
                  We visualize your consistency. Maintain your streak and watch your study hours graph go up and to the right.
                </p>
                <div className="mt-6 flex items-center gap-2 text-xs font-mono text-muted-foreground">
                   <Zap className="h-4 w-4 text-yellow-500" />
                   <span>12 Day Streak Active</span>
                </div>
             </div>
          </SpotlightCard>

          {/* Feature 4: Wide (Leaderboard) */}
          <SpotlightCard className="md:col-span-3 min-h-[250px] flex items-center">
             <div className="p-8 w-full flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex-1">
                   <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <Trophy className="h-5 w-5" />
                      </div>
                      <h3 className="text-2xl font-bold">Global Leaderboards</h3>
                   </div>
                   <p className="text-muted-foreground">
                      Learning is lonely. We made it a sport. Compete with peers based on study hours and tasks completed. 
                      Earn badges like "Early Bird" and "Night Owl."
                   </p>
                </div>
                <div className="flex gap-4">
                   <div className="px-6 py-4 rounded-2xl bg-background/50 border border-border/50 text-center shadow-lg">
                      <div className="text-2xl font-bold">#1</div>
                      <div className="text-xs text-muted-foreground uppercase">Rank</div>
                   </div>
                   <div className="px-6 py-4 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 text-center shadow-lg">
                      <div className="text-2xl font-bold text-yellow-500">Gold</div>
                      <div className="text-xs text-yellow-600/80 uppercase">League</div>
                   </div>
                </div>
             </div>
          </SpotlightCard>
        </div>
      </section>

      {/* METRICS SECTION */}
      <section className="py-24 border-y border-border/40 bg-muted/20 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
             {[
               { icon: Users, label: "Active Students", value: "10k+" },
               { icon: Layout, label: "Flashcards Generated", value: "2M+" },
               { icon: MessageCircle, label: "Peer Messages", value: "500k" },
               { icon: Lock, label: "Private & Encrypted", value: "100%" }
             ].map((stat, i) => (
               <div key={i} className="flex flex-col items-center justify-center text-center group cursor-default">
                  <div className="mb-4 p-3 rounded-2xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                    <stat.icon className="h-6 w-6" />
                  </div>
                  <h4 className="text-4xl font-bold tracking-tighter mb-1">{stat.value}</h4>
                  <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
               </div>
             ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="container mx-auto px-4 py-32 text-center relative">
        <div className="mx-auto max-w-3xl">
           <div className="inline-flex items-center justify-center p-1 rounded-full bg-gradient-to-r from-primary via-purple-500 to-pink-500 mb-8">
              <div className="px-6 py-2 bg-background rounded-full">
                 <span className="text-sm font-bold bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                   Ready to upgrade your GPA?
                 </span>
              </div>
           </div>
           
           <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-8">
             Join the revolution <br/> in academic performance.
           </h2>
           
           <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" onClick={() => navigate("/auth")} className="h-14 px-8 rounded-full text-lg shadow-2xl shadow-primary/30 hover:shadow-primary/50 transition-all hover:-translate-y-1">
                Get Started for Free
              </Button>
           </div>
           
           <p className="mt-8 text-sm text-muted-foreground">
             No credit card required · Free tier available · Cancel anytime
           </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/40 py-12 bg-background/50 backdrop-blur-lg">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
           <div className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
              <BookOpen className="h-5 w-5 text-primary" />
              <span className="font-bold">StudySync</span>
           </div>
           
           <div className="flex gap-8 text-sm text-muted-foreground">
              <a href="#" className="hover:text-primary transition-colors">Privacy</a>
              <a href="#" className="hover:text-primary transition-colors">Terms</a>
              <a href="#" className="hover:text-primary transition-colors">Twitter</a>
              <a href="#" className="hover:text-primary transition-colors">Discord</a>
           </div>
           
           <p className="text-sm text-muted-foreground">© 2025 StudySync Inc.</p>
        </div>
      </footer>
      
      {/* GLOBAL STYLES FOR ANIMATIONS */}
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