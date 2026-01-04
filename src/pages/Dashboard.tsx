import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { getEarnedBadges } from "@/lib/badges";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Target,
  Trophy,
  MessageCircle,
  Play,
  TrendingUp,
  Clock,
  Flame,
  Medal,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Zap,
  ChevronRight,
  Brain,
  CheckCircle2,
  LayoutDashboard,
  MessageSquare,
  ListVideo,
  Activity,
  Sparkles
} from "lucide-react";

// --- TYPES ---
type SubGoal = { id: string; completed: boolean };
type Goal = { id: string; title: string; subGoals: SubGoal[]; createdAt?: Timestamp; deadline?: number };
type VideoActivity = { id: string; title: string; videoId: string; watchTime?: number; completed?: boolean; updatedAt?: Timestamp };

// --- UI COMPONENTS ---

const SpotlightCard = ({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => {
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
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-[2.5rem] border bg-background/50 backdrop-blur-md transition-all duration-300 group",
        onClick && "cursor-pointer hover:scale-[1.01] active:scale-[0.99]",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 hidden md:block z-0"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(120, 119, 198, 0.15), transparent 40%)`,
        }}
      />
      <div className="absolute inset-0 md:hidden pointer-events-none bg-gradient-to-br from-primary/5 to-transparent z-0" />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, trend, trendValue, color }: any) => {
  return (
    <SpotlightCard className="p-6 flex flex-col justify-between h-full min-h-[140px] rounded-3xl">
      <div className="flex justify-between items-start">
        <div className={cn("p-2.5 rounded-xl bg-gradient-to-br shadow-lg text-white", color)}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <div className={cn("flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-tighter", 
            trend === "up" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
          )}>
            {trend === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingUp className="h-3 w-3 rotate-180" />}
            {trendValue}
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl md:text-3xl font-black tracking-tighter mt-4 truncate uppercase italic">{value}</p>
        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] truncate">{label}</p>
      </div>
    </SpotlightCard>
  );
};

// --- MAIN DASHBOARD ---

export default function Dashboard() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [videos, setVideos] = useState<VideoActivity[]>([]);
  const [recentActivity, setRecentActivity] = useState<VideoActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("Welcome back");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");

    if (!user) return;
    
    const unsubGoals = onSnapshot(query(collection(db, "users", user.uid, "goals")), snap => {
      setGoals(snap.docs.map(d => ({ id: d.id, ...d.data() } as Goal)));
    });

    const unsubPlaylists = onSnapshot(query(collection(db, "users", user.uid, "playlists")), snap => {
      const vids: VideoActivity[] = [];
      snap.docs.forEach(d => {
        const raw = d.data() as any;
        if (Array.isArray(raw.lectures)) {
          raw.lectures.forEach((l: any) => vids.push({ ...l, updatedAt: raw.updatedAt }));
        }
      });
      setVideos(vids);
      setRecentActivity(vids.filter(v => v.updatedAt).sort((a, b) => b.updatedAt!.toMillis() - a.updatedAt!.toMillis()).slice(0, 5));
      setLoading(false);
    });

    return () => { unsubGoals(); unsubPlaylists(); };
  }, [user]);

  const stats = useMemo(() => {
    let completed = 0; let overdue = 0; const now = Date.now();
    goals.forEach(g => {
      const isComplete = g.subGoals?.length > 0 && g.subGoals.every(sg => sg.completed);
      if (isComplete) completed++;
      if (!isComplete && g.deadline && g.deadline < now) overdue++;
    });

    const days = new Set(videos.filter(v => v.updatedAt).map(v => v.updatedAt!.toDate().toDateString()));
    let streakCount = 0; const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(); d.setDate(today.getDate() - i);
      if (days.has(d.toDateString())) streakCount++; else if (i > 0) break;
    }

    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const activeVids = videos.filter(v => v.updatedAt && v.updatedAt.toDate() >= weekAgo);
    
    const weeklyData = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return { 
        day: d.toLocaleDateString('en-US', { weekday: 'short' }), 
        value: videos.filter(v => v.updatedAt?.toDate().toDateString() === d.toDateString()).length 
      };
    });

    const totalMinutes = videos.reduce((acc, v) => acc + (v.watchTime || 0), 0);
    const watchedLectures = videos.filter(v => v.completed).length;
    const badgeCount = getEarnedBadges({ watchedLectures, totalMinutes, completedGoals: completed }).length;

    return { 
      completed, 
      total: goals.length, 
      overdue, 
      streak: streakCount, 
      weeklyHours: `${(activeVids.length * 0.5).toFixed(1)}h`, 
      badgeCount, 
      weeklyData, 
      monthlyProgress: Math.min(100, (activeVids.length / 30) * 100) 
    };
  }, [goals, videos]);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <Zap className="h-10 w-10 text-primary animate-pulse" />
      <p className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse uppercase">Syncing Intelligence Network</p>
    </div>
  );

  return (
    <div className={cn("container mx-auto px-4 pb-20 space-y-10 animate-in fade-in duration-700", 
      theme === "dark" ? "text-white" : "text-zinc-900"
    )}>
      
      {/* BACKGROUND ELEMENTS */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[10%] right-[5%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[10%] left-[5%] w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] animate-pulse" />
      </div>

      {/* HERO SECTION */}
      <section className="flex flex-col md:flex-row justify-between items-end gap-6 pt-10">
        <div className="space-y-2">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter italic uppercase">
            {greeting}, <br />
            <span className="text-primary drop-shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]">
              {user?.displayName?.split(" ")[0] || "Student"}
            </span>
          </h1>
          <p className="text-muted-foreground text-lg font-medium">
            Deploying protocols. You have <span className="text-primary font-bold">{stats.total - stats.completed} milestones</span> pending.
          </p>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
          {[
            { label: "Goals", icon: Target, href: "/goals", color: "text-emerald-500", bg: "bg-emerald-500/10" },
            { label: "Playlists", icon: Play, href: "/playlists", color: "text-purple-500", bg: "bg-purple-500/10" },
            { label: "Flashcards", icon: Brain, href: "/flashcards", color: "text-amber-500", bg: "bg-amber-500/10" },
            { label: "ranks", icon: Trophy, href: "/leaderboard", color: "text-blue-500", bg: "bg-blue-500/10" },
          ].map((a) => (
            <button key={a.label} onClick={() => navigate(a.href)} className={cn("p-4 rounded-2xl transition-all hover:scale-110 active:scale-90 shadow-2xl shrink-0", a.bg, a.color)}>
              <a.icon className="h-6 w-6" />
            </button>
          ))}
        </div>
      </section>

      {/* ALERTS */}
      {stats.overdue > 0 && (
        <Alert variant="destructive" className="border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400 rounded-3xl p-6">
          <AlertDescription className="flex items-center gap-3 font-black uppercase italic tracking-tighter">
            <Zap className="h-5 w-5 fill-current" /> Warning: {stats.overdue} Milestones are past critical deadline!
          </AlertDescription>
        </Alert>
      )}

      {/* STATS BENTO GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard icon={Flame} label="Bio-Streak" value={`${stats.streak} Days`} trend="up" trendValue="Peak" color="from-orange-500 to-red-500" />
        <StatCard icon={Target} label="Milestones" value={`${stats.completed}/${stats.total}`} trend={stats.completed > 0 ? "up" : undefined} trendValue="Active" color="from-emerald-500 to-green-500" />
        <StatCard icon={Clock} label="Velocity" value={stats.weeklyHours} trend="up" trendValue="+12%" color="from-blue-500 to-cyan-500" />
        <StatCard icon={Medal} label="Reputation" value={stats.badgeCount} color="from-yellow-400 to-orange-500" />
      </div>

      {/* MAIN CONTENT BENTO GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: ARCHITECTURE & PERFORMANCE */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* STUDY VELOCITY (PERFORMANCE) */}
          <SpotlightCard className="p-8 md:p-10">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                  <BarChart3 className="h-6 w-6 text-primary" /> Study Velocity
                </h3>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Intensity over last 7 sessions</p>
              </div>
              <Badge variant="outline" className="rounded-full border-primary/20 text-primary font-black uppercase italic px-4 py-1">Neural sync live</Badge>
            </div>
            
            <div className="h-48 flex items-end gap-3 md:gap-5">
              {stats.weeklyData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end group">
                  <div className="relative w-full rounded-2xl bg-muted/20 overflow-hidden h-full flex items-end">
                    <div 
                      className="w-full bg-gradient-to-t from-primary/40 to-primary rounded-2xl transition-all duration-1000 ease-out group-hover:scale-y-110"
                      style={{ height: `${(d.value / Math.max(...stats.weeklyData.map(v => v.value), 1)) * 100}%`, minHeight: d.value > 0 ? '12px' : '4px' }} 
                    />
                  </div>
                  <p className="text-center text-[10px] font-black text-muted-foreground mt-3 uppercase tracking-widest">{d.day}</p>
                </div>
              ))}
            </div>
          </SpotlightCard>

          {/* PLAYLISTS & DASHBOARD PREVIEW */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <SpotlightCard className="p-0 border-purple-500/10">
              <div className="p-6 border-b border-border/40 flex justify-between items-center bg-purple-500/5">
                <h3 className="font-black italic uppercase tracking-tighter flex items-center gap-2">
                  <ListVideo className="h-5 w-5 text-purple-500" /> Focus Playlists
                </h3>
                <Button variant="ghost" size="sm" onClick={() => navigate("/playlists")} className="text-[10px] font-black uppercase italic h-8 rounded-xl">Expand</Button>
              </div>
              <div className="divide-y divide-border/40">
                {recentActivity.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground text-xs font-bold italic uppercase tracking-widest">No Recent Streams</div>
                ) : (
                  recentActivity.map((v) => (
                    <div key={v.id} onClick={() => navigate(`/playlists?video=${v.videoId}`)} className="p-4 flex items-center gap-4 hover:bg-purple-500/5 transition-colors cursor-pointer group">
                      <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center group-hover:bg-purple-500/10 shrink-0">
                        <Play className="h-4 w-4 text-muted-foreground group-hover:text-purple-500 fill-current" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs truncate italic uppercase tracking-tighter">{v.title}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">{v.watchTime}m session logged</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </SpotlightCard>

            <SpotlightCard className="p-8 bg-primary text-primary-foreground border-none shadow-[0_20px_50px_rgba(var(--primary-rgb),0.3)] flex flex-col justify-between min-h-[300px]">
              <div>
                <Badge className="bg-white/20 text-white border-none uppercase font-black text-[10px] tracking-widest mb-4">Neural Command</Badge>
                <h3 className="text-3xl font-black italic uppercase tracking-tighter leading-none mb-4">
                  Unified <br /> Assistant
                </h3>
                <p className="text-xs font-bold leading-relaxed opacity-80 uppercase tracking-wide">
                  Intelligence Engine is active. Summarize lectures, generate flashcards, or clarify concepts via Smart Chat.
                </p>
              </div>
              <Button variant="secondary" className="w-full rounded-2xl font-black uppercase italic shadow-2xl h-12" onClick={() => navigate('/chat')}>
                Initialize chat <MessageSquare className="ml-2 h-4 w-4" />
              </Button>
            </SpotlightCard>
          </div>
        </div>

        {/* RIGHT COLUMN: GOALS & RANKING */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* ACTIVE MILESTONES (GOALS) */}
          <SpotlightCard className="p-8 border-emerald-500/10">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-black italic uppercase tracking-tighter text-xl flex items-center gap-2">
                <Target className="h-6 w-6 text-emerald-500" /> Milestones
              </h3>
              <ArrowUpRight className="h-5 w-5 text-muted-foreground opacity-30" />
            </div>
            <div className="space-y-6">
              {goals.length === 0 ? (
                <div className="text-center py-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Zero Active Targets</div>
              ) : (
                goals.slice(0, 4).map((g) => {
                  const done = g.subGoals.filter(s => s.completed).length;
                  const prog = g.subGoals.length === 0 ? 0 : Math.round((done / g.subGoals.length) * 100);
                  return (
                    <div key={g.id} className="space-y-2 group cursor-pointer" onClick={() => navigate("/goals")}>
                      <div className="flex justify-between text-[11px] font-black uppercase tracking-tighter">
                        <span className="truncate pr-4 italic">{g.title}</span>
                        <span className="text-primary">{prog}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${prog}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
              <Button variant="outline" className="w-full rounded-2xl font-black uppercase italic h-12 mt-4 hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/20" onClick={() => navigate("/goals")}>
                View Protocols
              </Button>
            </div>
          </SpotlightCard>

          {/* LEADERBOARD & HALL OF FAME PREVIEW */}
          <SpotlightCard className="p-8 bg-[#050505] border-yellow-500/10 relative overflow-hidden group">
            <div className="absolute top-[-20%] right-[-20%] w-40 h-40 bg-yellow-500/10 rounded-full blur-3xl group-hover:bg-yellow-500/20 transition-all duration-700" />
            <Trophy className="h-12 w-12 text-yellow-500 mb-6 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
            <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-2">Hall of Fame</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-8 leading-relaxed">
              Ascend the global ranks. You are currently in the <span className="text-yellow-500">Top 12%</span> of scholars this week.
            </p>
            <Button className="w-full rounded-2xl bg-yellow-500 text-black font-black uppercase italic h-12 shadow-[0_10px_30px_rgba(234,179,8,0.3)] hover:scale-105 transition-transform" onClick={() => navigate('/leaderboard')}>
              View rankings
            </Button>
          </SpotlightCard>

          {/* PERFORMANCE QUICK LINK */}
          <SpotlightCard className="p-6 flex items-center justify-between group cursor-pointer" onClick={() => navigate('/performance')}>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500"><Activity className="h-5 w-5" /></div>
              <span className="font-black italic uppercase tracking-tighter">Full Analytics</span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
          </SpotlightCard>

        </div>
      </div>
      
      {/* GLOBAL FOOTER SYNC STATUS */}
      <footer className="pt-10 border-t border-border/10 flex justify-between items-center opacity-30 px-2">
         <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.4em]">
            <Sparkles className="h-3 w-3" />
            Collective Intelligence v2.0
         </div>
         <div className="text-[8px] font-black uppercase tracking-[0.4em]">
            Precision Learning Required
         </div>
      </footer>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .animate-float { animation: float 6s ease-in-out infinite; }
      `}</style>
    </div>
  );
}