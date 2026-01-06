import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Trophy,
  Play,
  ArrowRight,
  CheckCircle2,
  Layout,
  Target,
  Users,
  Search,
  Code2,
  Cpu,
  GraduationCap,
  ChevronDown,
  Quote,
  Star,
  Sun,
  Moon
} from "lucide-react";

// --- CUSTOM STYLES & ANIMATIONS ---
const customStyles = `
  /* Dark Mode Glass */
  .dark .glass-pill {
    background: rgba(18, 18, 18, 0.8);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }
  /* Light Mode Glass */
  .glass-pill {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(0, 0, 0, 0.05);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
  }

  /* Spotlights */
  .dark .hero-spotlight {
    background: radial-gradient(circle at 50% -20%, rgba(120, 50, 255, 0.15) 0%, rgba(0, 0, 0, 0) 50%);
  }
  .hero-spotlight {
    background: radial-gradient(circle at 50% -20%, rgba(120, 50, 255, 0.05) 0%, rgba(255, 255, 255, 0) 50%);
  }

  /* Grid Backgrounds */
  .dark .grid-bg {
    background-size: 50px 50px;
    background-image: linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                      linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    mask-image: linear-gradient(to bottom, black 40%, transparent 100%);
  }
  .grid-bg {
    background-size: 50px 50px;
    background-image: linear-gradient(to right, rgba(0, 0, 0, 0.03) 1px, transparent 1px),
                      linear-gradient(to bottom, rgba(0, 0, 0, 0.03) 1px, transparent 1px);
    mask-image: linear-gradient(to bottom, black 40%, transparent 100%);
  }

  @keyframes scroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  .animate-scroll {
    animation: scroll 40s linear infinite;
  }
`;

// --- COMPONENTS ---

const ThemeToggle = ({ theme, toggleTheme }: { theme: string, toggleTheme: () => void }) => (
    <button 
        onClick={toggleTheme}
        className="p-2 rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400"
        aria-label="Toggle theme"
    >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
);

const PillNavbar = ({ theme, toggleTheme }: { theme: string, toggleTheme: () => void }) => {
    const navigate = useNavigate();
    return (
        <div className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 animate-in fade-in slide-in-from-top-4 duration-1000">
            <nav className="glass-pill w-full max-w-4xl rounded-full pl-6 pr-2 py-2 flex items-center justify-between transition-all duration-300">
                {/* Logo */}
                <div 
                    className="flex items-center gap-3 cursor-pointer group" 
                    onClick={() => navigate('/')}
                >
                    <div className="bg-purple-500/10 p-2 rounded-lg border border-purple-500/20 group-hover:bg-purple-500/20 transition-colors">
                        <BookOpen className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="font-bold text-zinc-900 dark:text-white tracking-tight hidden sm:block">StudySync</span>
                </div>

                {/* Links */}
                <div className="hidden md:flex items-center gap-2">
                    {['Features', 'Leaderboard', 'Pricing'].map((item) => (
                        <a 
                            key={item} 
                            href={`#${item.toLowerCase()}`}
                            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all hover:bg-black/5 dark:hover:bg-white/5 rounded-full"
                        >
                            {item}
                        </a>
                    ))}
                </div>

                {/* Right Side */}
                <div className="flex items-center gap-3">
                    <div className="w-px h-6 bg-black/5 dark:bg-white/10 hidden sm:block" />
                    
                    <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
                    
                    <Button 
                        onClick={() => navigate('/auth')} 
                        className="rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-medium px-6 h-10 shadow-[0_0_20px_rgba(124,58,237,0.3)] transition-all hover:scale-105"
                    >
                        Get Started
                    </Button>
                </div>
            </nav>
        </div>
    )
}

const NeonCard = ({ children, className = "", delay = "0" }: { children: React.ReactNode, className?: string, delay?: string }) => {
  return (
    <div className={`relative group isolate animate-in fade-in slide-in-from-bottom-8 duration-700 ${delay}`}>
        <div className="absolute -inset-[1px] bg-gradient-to-r from-purple-600 via-fuchsia-600 to-purple-600 rounded-2xl opacity-0 group-hover:opacity-50 blur-sm transition duration-500" />
        <div className={cn("relative h-full bg-white dark:bg-[#0a0a0a] rounded-xl border border-black/5 dark:border-white/10 p-6 transition-all duration-300 group-hover:bg-zinc-50 dark:group-hover:bg-[#0f0f0f] shadow-sm dark:shadow-none", className)}>
            {children}
        </div>
    </div>
  );
};

// 3D App Preview
const AppPreview = () => (
  <div className="relative mx-auto max-w-6xl mt-24 perspective-[2000px] group px-4">
    {/* The Purple Floor Glow */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[60%] bg-purple-600/15 blur-[100px] rounded-full -z-10" />
    
    <div className="relative rounded-xl bg-white dark:bg-[#09090b] border border-black/10 dark:border-white/10 shadow-2xl transform rotate-x-[12deg] transition-all duration-1000 ease-out hover:rotate-x-0 hover:scale-[1.01] overflow-hidden">
      {/* Window Controls */}
      <div className="h-10 border-b border-black/5 dark:border-white/5 bg-zinc-50/50 dark:bg-white/5 flex items-center px-4 justify-between">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
          <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded bg-black/5 dark:bg-black/20 border border-black/5 dark:border-white/5 text-[10px] text-zinc-500">
            <Search className="w-3 h-3" /> studysync.app/dashboard
        </div>
      </div>
      
      {/* Dashboard UI */}
      <div className="flex h-[550px] md:h-[650px] bg-zinc-50 dark:bg-[#050505]">
        {/* Sidebar */}
        <div className="w-20 md:w-64 border-r border-black/5 dark:border-white/5 bg-white dark:bg-[#0a0a0a] p-5 flex flex-col gap-6">
           <div className="flex items-center gap-3 px-2 mb-4 opacity-50">
               <div className="h-2 w-20 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
           </div>
           {[1,2,3,4].map(i => (
             <div key={i} className={`h-10 w-full rounded-lg flex items-center px-3 gap-3 ${i===1 ? 'bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400' : 'text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400'}`}>
                <div className="w-5 h-5 rounded bg-current opacity-20" />
                <div className="hidden md:block h-2 w-24 rounded-full bg-current opacity-20" />
             </div>
           ))}
           <div className="mt-auto rounded-xl bg-gradient-to-br from-purple-500/10 to-transparent p-4 border border-purple-500/10 hidden md:block">
               <div className="h-2 w-20 bg-purple-500/40 rounded-full mb-2" />
               <div className="h-1 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full"><div className="w-3/4 h-full bg-purple-500" /></div>
           </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 p-8 overflow-hidden bg-zinc-50 dark:bg-[#050505]">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">My Dashboard</h2>
                    <div className="h-2 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                </div>
                <div className="w-10 h-10 rounded-full bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center border border-purple-500/20 dark:border-purple-500/30">
                    <span className="text-purple-600 dark:text-purple-400 font-bold">AT</span>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-6 h-full pb-10">
                {/* Chart */}
                <div className="col-span-3 md:col-span-2 rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-white/[0.02] p-6 relative group overflow-hidden shadow-sm dark:shadow-none">
                    <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex justify-between mb-8">
                        <div className="h-4 w-32 bg-zinc-100 dark:bg-zinc-800 rounded" />
                        <div className="h-8 w-24 bg-purple-600 rounded-lg shadow-lg shadow-purple-900/20" />
                    </div>
                    <div className="flex items-end justify-between h-64 gap-3">
                        {[35, 60, 45, 80, 55, 90, 70, 40, 65, 85].map((h, i) => (
                            <div key={i} className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-sm hover:bg-purple-500 transition-all duration-300 origin-bottom hover:scale-y-105" style={{ height: `${h}%` }} />
                        ))}
                    </div>
                </div>
                {/* Side Widgets */}
                <div className="col-span-3 md:col-span-1 space-y-6">
                    <div className="h-40 rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-white/[0.02] p-6 flex flex-col items-center justify-center relative overflow-hidden shadow-sm dark:shadow-none">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 dark:bg-purple-500/20 blur-[40px] rounded-full" />
                        <span className="text-5xl font-bold text-zinc-900 dark:text-white mb-2">14</span>
                        <span className="text-sm text-zinc-500 uppercase tracking-widest">Day Streak</span>
                    </div>
                    <div className="h-40 rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-white/[0.02] p-6 flex flex-col justify-center shadow-sm dark:shadow-none">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            <span className="font-bold text-zinc-900 dark:text-white">Live Session</span>
                        </div>
                        <div className="flex -space-x-2">
                            {[1,2,3,4].map(i => <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-black bg-zinc-200 dark:bg-zinc-700" />)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  </div>
);

const Testimonials = () => {
    const reviews = [
        { name: "Ansh Tiwari", role: "CS Undergrad", text: "This app literally saved my GPA. The focus mode is insane." },
        { name: "Sarah Jenkins", role: "Med Student", text: "I've tried every study app. This is the only one that stuck." },
        { name: "David Chen", role: "Engineering", text: "The leaderboard actually makes me want to study more. It's addictive." },
        { name: "Priya Patel", role: "Law", text: "Clean, fast, and no distractions. Exactly what I needed." },
        { name: "Marcus Johnson", role: "Business", text: "The analytics helped me realize I was studying at the wrong times." },
    ];
    
    return (
        <div className="w-full py-20 overflow-hidden relative border-y border-black/5 dark:border-white/5 bg-zinc-50/50 dark:bg-black/50 backdrop-blur-sm">
            <div className="absolute inset-y-0 left-0 w-20 md:w-60 bg-gradient-to-r from-white dark:from-black to-transparent z-10" />
            <div className="absolute inset-y-0 right-0 w-20 md:w-60 bg-gradient-to-l from-white dark:from-black to-transparent z-10" />
            
            <div className="flex animate-scroll hover:[animation-play-state:paused] w-max gap-8 px-8">
                {[...reviews, ...reviews].map((review, i) => (
                    <div key={i} className="w-[350px] rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#0a0a0a] p-6 flex flex-col gap-4 hover:border-purple-500/30 transition-colors shadow-sm dark:shadow-none">
                        <div className="flex gap-1 text-purple-500">
                            {[1,2,3,4,5].map(s => <Star key={s} className="w-4 h-4 fill-current" />)}
                        </div>
                        <p className="text-zinc-600 dark:text-zinc-300 text-sm leading-relaxed">"{review.text}"</p>
                        <div className="flex items-center gap-3 mt-auto pt-4 border-t border-black/5 dark:border-white/5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center font-bold text-xs text-white">{review.name[0]}</div>
                            <div>
                                <div className="text-sm font-bold text-zinc-900 dark:text-white">{review.name}</div>
                                <div className="text-xs text-zinc-500">{review.role}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

const FAQItem = ({ q, a }: { q: string, a: string }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="border-b border-black/5 dark:border-white/10 last:border-0">
            <button 
                className="w-full py-6 flex items-center justify-between text-left hover:text-purple-600 dark:hover:text-purple-400 transition-colors group"
                onClick={() => setOpen(!open)}
            >
                <span className="text-lg font-medium text-zinc-800 dark:text-zinc-200 group-hover:translate-x-2 transition-transform">{q}</span>
                <ChevronDown className={cn("w-5 h-5 text-zinc-400 dark:text-zinc-500 transition-transform duration-300", open ? "rotate-180" : "")} />
            </button>
            <div className={cn("overflow-hidden transition-all duration-500 ease-in-out", open ? "max-h-40 pb-6 opacity-100" : "max-h-0 opacity-0")}>
                <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed pr-10">{a}</p>
            </div>
        </div>
    )
}

// --- MAIN PAGE ---

const Landing = () => {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    setMounted(true);
    // Initialize theme based on preference or default to dark
    const root = window.document.documentElement;
    root.classList.add("dark");
  }, []);

  const toggleTheme = () => {
    const root = window.document.documentElement;
    if (theme === "dark") {
        root.classList.remove("dark");
        setTheme("light");
    } else {
        root.classList.add("dark");
        setTheme("dark");
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-white dark:bg-black text-zinc-950 dark:text-white font-sans selection:bg-purple-500/30 overflow-x-hidden transition-colors duration-300">
      <style>{customStyles}</style>
      
      {/* Background Layers */}
      <div className="fixed inset-0 z-0 grid-bg pointer-events-none" />
      <div className="fixed top-0 left-0 right-0 h-[80vh] hero-spotlight pointer-events-none z-0" />

      <PillNavbar theme={theme} toggleTheme={toggleTheme} />

      <main className="relative z-10">
        
        {/* HERO SECTION */}
        <section className="pt-40 pb-32 px-4 text-center relative">
            
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/20 bg-purple-500/5 dark:bg-purple-900/10 backdrop-blur-md mb-12 hover:border-purple-500/40 transition-all cursor-default animate-in fade-in zoom-in duration-700">
                <GraduationCap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="text-xs text-purple-900 dark:text-purple-100 font-medium">Made by students of <span className="font-bold">GLBITM</span></span>
            </div>

            {/* Main Title - Massive & Stacked */}
            <div className="relative z-10 mb-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                <h1 className="text-6xl sm:text-8xl md:text-9xl font-black tracking-tighter leading-[0.85] text-zinc-200 dark:text-white mix-blend-overlay opacity-50 select-none absolute top-1 left-0 right-0 blur-sm transform scale-105 hidden dark:block">
                    STUDY<br/>SYNC
                </h1>
                <h1 className="text-6xl sm:text-8xl md:text-9xl font-black tracking-tighter leading-[0.85] text-transparent bg-clip-text bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-500 dark:from-white dark:via-white dark:to-zinc-500 relative">
                    STUDY<br/>SYNC
                </h1>
            </div>
            
            {/* Subtext */}
            <p className="text-zinc-500 dark:text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                The operating system for high achievers. 
                <br className="hidden md:block"/>
                Manage your academic life with <span className="text-zinc-900 dark:text-white font-medium">military precision</span>.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-24 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
                <Button 
                    size="lg" 
                    onClick={() => navigate('/auth')}
                    className="h-14 px-8 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 font-bold text-lg transition-all hover:scale-105 shadow-xl dark:shadow-[0_0_50px_-15px_rgba(255,255,255,0.5)] w-full sm:w-auto"
                >
                    Launch App <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer group">
                    <div className="w-12 h-12 rounded-full border border-black/5 dark:border-white/10 bg-black/5 dark:bg-white/5 flex items-center justify-center group-hover:bg-black/10 dark:group-hover:bg-white/10 transition-colors">
                        <Play className="w-5 h-5 fill-current ml-1" />
                    </div>
                    <span className="font-medium">Watch workflow</span>
                </div>
            </div>

            <AppPreview />
        </section>

        {/* STATS STRIP */}
        <div className="border-y border-black/5 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/30 py-16 backdrop-blur-sm">
             <div className="container mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                 {[
                    { l: "Students", v: "10k+" },
                    { l: "Universities", v: "120+" },
                    { l: "Study Hours", v: "1.5M" },
                    { l: "Tasks Crushed", v: "5M+" },
                 ].map((s, i) => (
                    <div key={i} className="space-y-2">
                        <div className="text-3xl md:text-5xl font-bold text-zinc-900 dark:text-white tracking-tighter">{s.v}</div>
                        <div className="text-xs text-zinc-500 uppercase tracking-widest font-mono">{s.l}</div>
                    </div>
                 ))}
             </div>
        </div>

        {/* TESTIMONIALS */}
        <section className="py-32">
            <div className="container mx-auto px-4 text-center mb-12">
                 <h2 className="text-3xl font-bold mb-4 text-zinc-900 dark:text-white">Read what the top 1% say.</h2>
                 <p className="text-zinc-500">Join thousands of students upgrading their workflow.</p>
            </div>
            <Testimonials />
        </section>

        {/* FEATURES GRID */}
        <section id="features" className="container mx-auto px-4 py-20">
            <div className="text-center mb-20">
                <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight text-zinc-900 dark:text-white">The Full Stack.</h2>
                <p className="text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto text-lg">Everything you need to go from chaotic to academic weapon.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <NeonCard delay="delay-0">
                    <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6 border border-black/5 dark:border-white/5">
                        <Code2 className="w-6 h-6 text-purple-600 dark:text-purple-500" />
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-zinc-900 dark:text-white">Distraction Free</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">Embed lectures directly. No sidebar recommendations. No comments section. Just content.</p>
                </NeonCard>
                <NeonCard delay="delay-100">
                    <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6 border border-black/5 dark:border-white/5">
                        <Trophy className="w-6 h-6 text-yellow-600 dark:text-yellow-500" />
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-zinc-900 dark:text-white">Global Rank</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">Compete against students in your specific major worldwide. Prove you are the best.</p>
                </NeonCard>
                <NeonCard delay="delay-200">
                    <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6 border border-black/5 dark:border-white/5">
                        <Cpu className="w-6 h-6 text-cyan-600 dark:text-cyan-500" />
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-zinc-900 dark:text-white">Data Analytics</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">We visualize your study habits. See your velocity and burnout risk before it happens.</p>
                </NeonCard>
                <NeonCard delay="delay-300">
                    <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6 border border-black/5 dark:border-white/5">
                        <Target className="w-6 h-6 text-red-600 dark:text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-zinc-900 dark:text-white">Quest System</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">Turn boring assignments into XP-gaining quests. Level up your profile.</p>
                </NeonCard>
                <NeonCard delay="delay-400">
                    <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6 border border-black/5 dark:border-white/5">
                        <Users className="w-6 h-6 text-green-600 dark:text-green-500" />
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-zinc-900 dark:text-white">Study Pods</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">Real-time study rooms with friends. See who is active and hold each other accountable.</p>
                </NeonCard>
                <NeonCard delay="delay-500">
                    <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6 border border-black/5 dark:border-white/5">
                        <Layout className="w-6 h-6 text-pink-600 dark:text-pink-500" />
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-zinc-900 dark:text-white">Command Center</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">Your entire academic life in one dashboard. Calendar, notes, and tasks unified.</p>
                </NeonCard>
            </div>
        </section>

        {/* FAQ SECTION */}
        <section id="faq" className="container mx-auto px-4 py-32 max-w-3xl">
            <h2 className="text-3xl font-bold mb-10 text-center text-zinc-900 dark:text-white">Frequently Asked Questions</h2>
            <div className="space-y-4">
                <FAQItem q="Is StudySync free for students?" a="Yes. The core features including task management, basic analytics, and playlists are 100% free for students with a valid .edu email." />
                <FAQItem q="How does the leaderboard work?" a="You earn XP for completing tasks, maintaining streaks, and logging study hours. We normalize this data to rank you against peers in similar majors." />
                <FAQItem q="Can I import from other tools?" a="We are working on Notion and Google Calendar integrations. They are coming in v2.1 next month." />
                <FAQItem q="Is my data private?" a="Absolutely. We do not sell your data. Your study habits are yours alone, unless you choose to share them on the public leaderboard." />
            </div>
        </section>

        {/* FINAL CTA */}
        <section className="py-32 px-4 text-center relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/5 dark:bg-purple-600/10 blur-[120px] rounded-full -z-10 pointer-events-none" />
            
            <div className="max-w-3xl mx-auto">
                <h2 className="text-5xl md:text-7xl font-bold tracking-tighter mb-8 text-zinc-900 dark:text-white">
                    Ready to ascend?
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-lg mb-12 max-w-xl mx-auto">
                    Join the platform built for students who treat their education like a high-stakes sport.
                </p>
                <Button 
                    size="lg" 
                    onClick={() => navigate('/auth')}
                    className="h-16 px-12 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 font-bold text-xl shadow-xl dark:shadow-[0_0_60px_-15px_rgba(255,255,255,0.5)] transition-transform hover:scale-105"
                >
                    Get Started Free
                </Button>
            </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-black/5 dark:border-white/10 bg-zinc-50 dark:bg-[#050505] py-16 text-sm">
          <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-10">
              <div className="col-span-1 md:col-span-2">
                  <div className="flex items-center gap-2 mb-4">
                      <div className="bg-purple-500/20 p-1 rounded">
                        <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <span className="font-bold text-lg text-zinc-900 dark:text-white">StudySync</span>
                  </div>
                  <p className="text-zinc-500 max-w-xs mb-6">
                      The high-performance study OS designed by students, for students.
                  </p>
                  <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-500 border border-black/5 dark:border-white/5 rounded-full px-3 py-1 w-fit">
                      <GraduationCap className="w-4 h-4" />
                      <span>Built at <span className="text-zinc-900 dark:text-zinc-400 font-bold">GLBITM</span></span>
                  </div>
              </div>
              
              <div>
                  <h4 className="font-bold text-zinc-900 dark:text-white mb-6">Product</h4>
                  <ul className="space-y-3 text-zinc-500">
                      <li><a href="#" className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors">Features</a></li>
                      <li><a href="#" className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors">Leaderboard</a></li>
                      <li><a href="#" className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors">Pricing</a></li>
                  </ul>
              </div>
              
              <div>
                  <h4 className="font-bold text-zinc-900 dark:text-white mb-6">Legal</h4>
                  <ul className="space-y-3 text-zinc-500">
                      <li><a href="#" className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors">Privacy Policy</a></li>
                      <li><a href="#" className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors">Terms of Service</a></li>
                      <li><a href="#" className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors">Twitter / X</a></li>
                  </ul>
              </div>
          </div>
          <div className="container mx-auto px-4 mt-16 pt-8 border-t border-black/5 dark:border-white/5 text-center text-zinc-500 dark:text-zinc-700">
              © 2026 StudySync Inc. All rights reserved.
          </div>
      </footer>
    </div>
  );
};

export default Landing;