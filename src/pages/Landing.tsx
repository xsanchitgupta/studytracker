import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import {
  BookOpen, Target, Trophy, Play, TrendingUp, ArrowRight, Zap,
  Cpu, CheckCircle2, Menu, X, ChevronRight, Sparkles, ShieldCheck,
  Activity, Layers, Brain, Clock, Award, GraduationCap, Medal,
  MessageSquare, LayoutDashboard, BarChart3, ListVideo
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// --- REUSABLE PERFORMANCE COMPONENTS ---

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
        "relative overflow-hidden rounded-[2rem] md:rounded-[2.5rem] border border-border/50 bg-background/50 backdrop-blur-md transition-all duration-500 hover:border-primary/40 hover:shadow-[0_0_50px_-12px_rgba(var(--primary-rgb),0.2)]",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 hidden md:block"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(var(--primary-rgb), 0.1), transparent 40%)`,
        }}
      />
      <div className="absolute inset-0 md:hidden pointer-events-none bg-gradient-to-b from-primary/5 to-transparent" />
      <div className="relative h-full z-10">{children}</div>
    </div>
  );
};

const TiltCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (window.innerWidth < 768) return; // Disable tilt on mobile for performance
    if (!cardRef.current) return;
    const card = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - card.left - card.width / 2) / (card.width / 2) * 8;
    const y = (e.clientY - card.top - card.height / 2) / (card.height / 2) * -8;
    setRotate({ x: y, y: x });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={onMouseMove}
      onMouseLeave={() => setRotate({ x: 0, y: 0 })}
      style={{
        transform: `perspective(1000px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) scale3d(1.01, 1.01, 1.01)`,
        willChange: "transform",
      }}
      className={cn("relative overflow-hidden rounded-[2rem] md:rounded-[2.5rem] border border-white/10 bg-background/40 backdrop-blur-3xl shadow-2xl transition-transform duration-200 ease-out group", className)}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};

// --- MAIN LANDING PAGE ---

const Landing = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  return (
    <div className={cn("min-h-screen selection:bg-primary/30 font-sans overflow-x-hidden antialiased",
      theme === "dark" ? "bg-[#030303] text-white" : "bg-zinc-50 text-zinc-950"
    )}>

      {/* OPTIMIZED LAYERED BACKGROUND */}
      <div className="fixed inset-0 -z-10 h-full w-full pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] h-[100vw] w-[100vw] rounded-full bg-primary/5 blur-[120px] opacity-50" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[80vw] w-[80vw] rounded-full bg-purple-600/5 blur-[100px] opacity-50" />
        <div className="h-full w-full opacity-[0.03] dark:opacity-[0.07]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
      </div>

      {/* ADAPTIVE NAVBAR */}
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-3 px-3 md:pt-6 md:px-6">
        <nav className={cn(
          "flex items-center justify-between gap-4 rounded-full border px-4 py-2.5 md:px-8 md:py-4 shadow-2xl backdrop-blur-2xl transition-all duration-500 w-full max-w-6xl",
          theme === "dark" ? "bg-black/60 border-white/10" : "bg-white/60 border-zinc-200"
        )}>
          <div className="flex items-center gap-2.5 cursor-pointer group" onClick={() => navigate("/")}>
            <div className="bg-primary p-2 rounded-xl text-primary-foreground shadow-[0_0_20px_rgba(var(--primary-rgb),0.4)] transition-transform group-hover:scale-105 active:scale-95">
              <Zap className="h-4 w-4 md:h-5 md:w-5 fill-current" />
            </div>
            <span className="font-black tracking-tighter text-lg md:text-xl uppercase italic leading-none">StudySync</span>
          </div>
          
          <div className="hidden lg:flex items-center gap-10 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
            {['dashboard', 'performance', 'leaderboard'].map((id) => (
              <a key={id} href={`#${id}`} className="hover:text-primary transition-all hover:tracking-[0.4em]">{id}</a>
            ))}
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <ThemeToggle />
            <Button onClick={() => navigate("/auth")} className="rounded-full px-5 md:px-8 h-10 md:h-12 font-black uppercase tracking-widest bg-primary hover:bg-primary/90 text-white shadow-lg text-[10px] md:text-xs">
              Initialize
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)} className="lg:hidden rounded-full h-10 w-10">
               <Menu className="h-5 w-5" />
            </Button>
          </div>
        </nav>
      </div>

      {/* MOBILE MENU (Fullscreen Overlay) */}
      <div className={cn(
        "fixed inset-0 z-[60] bg-background/98 backdrop-blur-3xl transition-all duration-500 lg:hidden flex flex-col p-8",
        mobileMenuOpen ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
      )}>
        <div className="flex justify-between items-center mb-16">
          <span className="font-black tracking-tighter text-2xl uppercase italic text-primary">StudySync</span>
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)} className="rounded-full border"><X /></Button>
        </div>
        <div className="flex flex-col gap-8 text-4xl font-black uppercase italic tracking-tighter">
          {['dashboard', 'performance', 'leaderboard'].map((id) => (
            <a key={id} href={`#${id}`} onClick={() => setMobileMenuOpen(false)} className="border-b border-border/10 pb-4">{id}</a>
          ))}
        </div>
        <Button size="lg" className="mt-auto w-full rounded-2xl h-20 text-xl font-black uppercase tracking-widest italic" onClick={() => navigate('/auth')}>Start Protocol</Button>
      </div>

      {/* HERO SECTION (Fluid Typography) */}
      <main className="container mx-auto px-6 pt-40 pb-20 md:pt-64 md:pb-32 text-center relative">
        <h1 className="mx-auto max-w-[1400px] text-[clamp(2.5rem,12vw,12rem)] font-black tracking-tighter leading-[0.85] uppercase italic transition-all">
          Elevate <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-b from-primary via-primary to-purple-800 drop-shadow-[0_0_30px_rgba(var(--primary-rgb),0.2)]">Learning.</span>
        </h1>
        <p className="mx-auto mt-8 md:mt-16 max-w-3xl text-[clamp(1rem,2.5vw,1.5rem)] text-muted-foreground font-medium leading-relaxed px-4">
          The high-performance OS for modern scholars. Organize lectures, track cognitive milestones, and dominate global rankings with real-time biometric analytics.
        </p>

        <div className="mt-10 md:mt-16 flex flex-col items-center justify-center gap-4 sm:flex-row px-4">
          <Button size="lg" onClick={() => navigate("/auth")} className="h-16 md:h-20 w-full sm:w-[400px] rounded-2xl px-12 text-lg md:text-xl font-black uppercase tracking-[0.4em] italic shadow-[0_20px_50px_rgba(var(--primary-rgb),0.3)] hover:scale-[1.02] transition-all text-white">
            Enter Dashboard
          </Button>
        </div>

        {/* HERO PREVIEW (Responsive aspect ratio) */}
        <div className="mt-24 md:mt-40 relative mx-auto max-w-6xl animate-in zoom-in duration-1000 delay-300 px-2 md:px-0">
            <div className="absolute -inset-4 md:-inset-10 bg-primary/10 rounded-[3rem] md:rounded-[5rem] blur-[80px] md:blur-[120px] opacity-30 pointer-events-none" />
            <TiltCard className="border-white/5 p-2 md:p-3 shadow-2xl">
                <div className="aspect-[16/10] md:aspect-[21/9] rounded-[1.5rem] md:rounded-[2rem] bg-[#050505] relative flex items-center justify-center overflow-hidden border border-white/5">
                    <div className="flex flex-col items-center gap-6 md:gap-10 z-10">
                        <Activity className="h-12 w-12 md:h-20 md:w-20 text-primary animate-pulse" />
                        <div className="space-y-4 flex flex-col items-center">
                          <div className="h-1 md:h-2 w-48 md:w-80 bg-white/5 rounded-full overflow-hidden border border-white/10">
                             <div className="h-full bg-primary w-[82%] animate-slide-right shadow-[0_0_15px_rgba(var(--primary-rgb),1)]" />
                          </div>
                          <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.5em] text-primary/80">Neural Link Synced</p>
                        </div>
                    </div>
                </div>
            </TiltCard>
        </div>
      </main>

      {/* BENTO GRID (Mobile stacking logic) */}
      <section id="dashboard" className="container mx-auto px-4 py-20 md:py-32">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 md:gap-6">
          
          <TiltCard className="md:col-span-4 p-8 md:p-12 min-h-[400px] md:min-h-[500px] flex flex-col justify-between">
              <div>
                <Badge className="bg-primary/20 text-primary mb-4 md:mb-6 font-black uppercase tracking-widest text-[9px] md:text-[10px]">Command Center</Badge>
                <h3 className="text-4xl md:text-6xl font-black tracking-tighter mb-4 md:mb-6 italic uppercase leading-none">The Unified <br /> Dashboard</h3>
                <p className="text-muted-foreground text-base md:text-xl leading-relaxed max-w-lg">
                  A high-density overview of your academic life. Monitor active streaks, upcoming goals, and lecture progress in one unified frame.
                </p>
              </div>
              <LayoutDashboard className="h-10 w-10 md:h-14 md:w-14 text-primary/20" />
          </TiltCard>

          <SpotlightCard className="md:col-span-2 p-8 md:p-12 min-h-[400px] md:min-h-[500px] bg-gradient-to-br from-blue-500/5 to-transparent">
              <Badge className="bg-blue-500/20 text-blue-400 mb-6 font-black uppercase tracking-widest text-[10px]">Neural Intelligence</Badge>
              <h3 className="text-4xl md:text-5xl font-black tracking-tighter mb-6 italic uppercase leading-none">Smart <br /> Chat</h3>
              <p className="text-muted-foreground text-sm md:text-lg mb-8">
                Summarize lectures, clarify concepts, and generate flashcards from your existing notes using our integrated AI engine.
              </p>
              <MessageSquare className="h-16 w-16 text-blue-500/10" />
          </SpotlightCard>

          <TiltCard id="performance" className="md:col-span-3 p-8 md:p-12 min-h-[500px] border-emerald-500/10 bg-emerald-500/[0.02]">
              <Badge className="bg-emerald-500/20 text-emerald-400 mb-6 font-black uppercase tracking-widest text-[10px]">Cognitive Metrics</Badge>
              <h3 className="text-4xl md:text-6xl font-black tracking-tighter mb-6 italic uppercase leading-none text-emerald-500">Study <br /> Velocity</h3>
              <p className="text-muted-foreground text-sm md:text-xl mb-10 leading-relaxed">
                Monitor session intensity and retention mastery through live subject distribution heatmaps.
              </p>
              <div className="flex items-end gap-1.5 h-24 md:h-32">
                  {[40, 70, 45, 90, 65, 80, 100].map((h, i) => (
                    <div key={i} className="flex-1 bg-emerald-500/20 rounded-t-md md:rounded-t-lg transition-all hover:bg-emerald-500" style={{ height: `${h}%` }} />
                  ))}
              </div>
          </TiltCard>

          <SpotlightCard className="md:col-span-3 p-8 md:p-12 min-h-[500px] bg-gradient-to-br from-purple-500/5 to-transparent">
              <Badge className="bg-purple-500/20 text-purple-400 mb-6 font-black uppercase tracking-widest text-[10px]">Milestone Protocol</Badge>
              <h3 className="text-4xl md:text-6xl font-black tracking-tighter mb-6 italic uppercase leading-none">Smart <br /> Goals</h3>
              <p className="text-muted-foreground text-sm md:text-xl mb-10">
                Automated sub-goal decomposition for complex exams. Track completion history with visual milestones.
              </p>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-black/40 border border-white/5">
                <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-widest opacity-40 italic text-purple-400">Processing Sub-Goals...</span>
              </div>
          </SpotlightCard>

          <TiltCard className="md:col-span-6 p-8 md:p-12 min-h-[400px] flex flex-col md:flex-row items-center gap-8 md:gap-12">
              <div className="flex-1 text-center md:text-left">
                <Badge className="bg-orange-500/20 text-orange-400 mb-6 font-black uppercase tracking-widest text-[10px]">Immersion Control</Badge>
                <h3 className="text-4xl md:text-6xl font-black tracking-tighter mb-6 italic uppercase leading-none">Focus <br /> Playlists</h3>
                <p className="text-muted-foreground text-sm md:text-xl leading-relaxed">
                  Specialized lecture environments with integrated timestamped notes and automatic session logging.
                </p>
              </div>
              <ListVideo className="h-24 w-24 md:h-40 md:w-40 text-orange-500/10" />
          </TiltCard>

          <SpotlightCard id="leaderboard" className="md:col-span-6 p-8 md:p-16 min-h-[450px] flex flex-col md:flex-row items-center gap-12 bg-[#050505] border-yellow-500/10">
              <div className="flex-1 text-center md:text-left">
                 <h3 className="text-5xl md:text-8xl font-black tracking-tighter italic uppercase mb-6 leading-none">Hall of <span className="text-yellow-500">Fame</span></h3>
                 <p className="text-muted-foreground text-sm md:text-xl mb-10 leading-relaxed">
                   Rankings updated in real-time based on cognitive output and streak consistency.
                 </p>
                 <Button variant="outline" className="rounded-full border-2 h-14 md:h-16 px-8 md:px-12 font-black uppercase tracking-widest italic hover:bg-white hover:text-black transition-all" onClick={() => navigate('/leaderboard')}>
                    View Global Rankings
                 </Button>
              </div>
              <Trophy className="h-32 w-32 md:h-48 md:w-48 text-yellow-500/20 drop-shadow-[0_0_30px_rgba(234,179,8,0.2)]" />
          </SpotlightCard>
        </div>
      </section>

      {/* CALL TO ACTION */}
      <section className="container mx-auto px-4 py-32 md:py-64">
          <div className="rounded-[2.5rem] md:rounded-[4rem] bg-gradient-to-b from-primary to-purple-900 p-12 md:p-32 relative overflow-hidden text-center group border border-white/20 shadow-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1),transparent_70%)] opacity-50" />
              <h2 className="text-5xl md:text-[clamp(4rem,10vw,10rem)] font-black tracking-tighter italic uppercase text-white mb-10 md:mb-16 relative z-10 leading-[0.85]">
                Initiate <br /> Protocol
              </h2>
              <Button onClick={() => navigate("/auth")} size="lg" className="rounded-full bg-white text-black h-16 md:h-24 px-10 md:px-16 text-lg md:text-2xl font-black uppercase tracking-[0.4em] hover:scale-110 transition-all relative z-10">
                 Connect Now
              </Button>
          </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-16 md:py-24 bg-black">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center md:items-end gap-12 text-center md:text-left">
            <div className="space-y-6">
                <div className="flex items-center gap-3 justify-center md:justify-start">
                  <Layers className="h-6 w-6 md:h-8 md:w-8 text-primary fill-current" />
                  <span className="font-black tracking-tighter text-3xl md:text-4xl uppercase italic">StudySync</span>
                </div>
                <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.5em] text-white/20 leading-relaxed">
                  Advanced Cognitive OS <br /> Global Scholar Network <br /> v2.0 Production Build
                </p>
            </div>
            <div className="text-center md:text-right">
               <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary mb-2 italic">Precision Learning</p>
               <p className="text-3xl md:text-5xl font-black italic text-white/5 tracking-tighter uppercase leading-none">Victory Favors <br className="md:hidden" /> the Disciplined</p>
            </div>
        </div>
      </footer>
      
      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
        .animate-float { animation: float 6.s ease-in-out infinite; }
        @keyframes slide-right { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .animate-slide-right { animation: slide-right 3s linear infinite; }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-marquee { animation: marquee 30s linear infinite; }
      `}</style>
    </div>
  );
};

export default Landing;