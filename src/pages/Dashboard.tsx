import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { getEarnedBadges } from "@/lib/badges";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  CheckCircle2
} from "lucide-react";

// --- TYPES ---
type SubGoal = { id: string; completed: boolean };

type Goal = {
  id: string;
  title: string;
  subGoals: SubGoal[];
  createdAt?: Timestamp;
  deadline?: number;
};

type VideoActivity = {
  id: string;
  title: string;
  videoId: string;
  watchTime?: number;
  completed?: boolean;
  updatedAt?: Timestamp;
};

// --- UI COMPONENTS (God Mode) ---

// 1. SPOTLIGHT CARD: The "Buttermax" Glow Effect
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
        "relative overflow-hidden rounded-3xl border bg-background/50 backdrop-blur-md transition-all duration-300 group",
        onClick && "cursor-pointer hover:scale-[1.01] active:scale-[0.99]",
        className
      )}
    >
      {/* Desktop Spotlight */}
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 hidden md:block z-0"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(120, 119, 198, 0.15), transparent 40%)`,
        }}
      />
      {/* Mobile Subtle Glow */}
      <div className="absolute inset-0 md:hidden pointer-events-none bg-gradient-to-br from-primary/5 to-transparent z-0" />
      
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};

// 2. STAT CARD: For the top grid
const StatCard = ({ icon: Icon, label, value, trend, trendValue, color }: any) => {
  return (
    <SpotlightCard className="p-6 flex flex-col justify-between h-full min-h-[140px]">
      <div className="flex justify-between items-start">
        <div className={cn("p-2.5 rounded-xl bg-gradient-to-br", color, "text-white shadow-lg")}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <div className={cn("flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full", 
            trend === "up" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
          )}>
            {trend === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingUp className="h-3 w-3 rotate-180" />}
            {trendValue}
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl md:text-3xl font-bold tracking-tight mt-4 truncate">{value}</p>
        <p className="text-sm text-muted-foreground font-medium truncate">{label}</p>
      </div>
    </SpotlightCard>
  );
};

// --- MAIN DASHBOARD COMPONENT ---

export default function Dashboard() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [videos, setVideos] = useState<VideoActivity[]>([]);
  const [recentActivity, setRecentActivity] = useState<VideoActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("Welcome back");

  // -------- DATA FETCHING --------
  useEffect(() => {
    // Time-based greeting
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");

    if (!user) return;
    
    // Fetch Goals
    const qGoals = query(collection(db, "users", user.uid, "goals"));
    const unsubGoals = onSnapshot(qGoals, snap => {
      const data: Goal[] = snap.docs.map(d => {
        const raw = d.data() as any;
        return {
          id: d.id,
          title: raw.title ?? "Untitled Goal",
          subGoals: Array.isArray(raw.subGoals) ? raw.subGoals : [],
          createdAt: raw.createdAt,
          deadline: raw.deadline
        };
      });
      setGoals(data);
    });

    // Fetch Playlists/Videos
    const qPlaylists = query(collection(db, "users", user.uid, "playlists"));
    const unsubPlaylists = onSnapshot(qPlaylists, snap => {
      const vids: VideoActivity[] = [];
      snap.docs.forEach(d => {
        const raw = d.data() as any;
        if (Array.isArray(raw.lectures)) {
          raw.lectures.forEach((l: any) => {
            vids.push({
              id: l.id,
              title: l.title,
              videoId: l.videoId,
              watchTime: l.watchTime || 0,
              completed: l.completed || false,
              updatedAt: raw.updatedAt,
            });
          });
        }
      });
      setVideos(vids);
      
      // Sort for recent activity
      const sorted = vids
        .filter(v => v.updatedAt)
        .sort((a, b) => b.updatedAt!.toMillis() - a.updatedAt!.toMillis())
        .slice(0, 5);
      setRecentActivity(sorted);
      setLoading(false);
    });

    return () => {
      unsubGoals();
      unsubPlaylists();
    };
  }, [user]);

  // -------- COMPUTED STATS --------
  const { completedGoals, totalGoals, weeklyHours, streak, overdueCount, badgeCount, weeklyData, monthlyProgress } = useMemo(() => {
    let completed = 0;
    let overdue = 0;
    const now = Date.now();

    goals.forEach(g => {
      const isComplete = g.subGoals.length > 0 && g.subGoals.every(sg => sg.completed);
      if (isComplete) completed++;
      if (!isComplete && g.deadline && g.deadline < now) overdue++;
    });

    // Activity Stats
    const days = new Set(
      videos
        .filter(v => v.updatedAt)
        .map(v => v.updatedAt!.toDate().toDateString())
    );

    let streakCount = 0;
    const today = new Date();
    // Simple streak logic
    for (let i = 0; i < 365; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      if (days.has(d.toDateString())) streakCount++;
      else if (i > 0) break;
    }

    // Weekly Hours & Data
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const activeVideos = videos.filter(v => v.updatedAt && v.updatedAt.toDate() >= weekAgo);
    
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayVideos = videos.filter(v => {
        if (!v.updatedAt) return false;
        const vDate = v.updatedAt.toDate();
        return vDate.toDateString() === date.toDateString();
      });
      weeklyData.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        value: dayVideos.length,
        date: date.toDateString()
      });
    }
    
    // Monthly Progress
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthlyVideos = videos.filter(v => v.updatedAt && v.updatedAt.toDate() >= monthAgo);
    const monthlyProgress = Math.min(100, (monthlyVideos.length / 30) * 100);
    
    // Badges
    const totalMinutes = videos.reduce((acc, v) => acc + (v.watchTime || 0), 0);
    const watchedLectures = videos.filter(v => v.completed).length;
    const earnedBadges = getEarnedBadges({ watchedLectures, totalMinutes, completedGoals: completed });

    return {
      completedGoals: completed,
      totalGoals: goals.length,
      weeklyHours: activeVideos.length === 0 ? "0h" : `${(activeVideos.length * 0.5).toFixed(1)}h`,
      streak: streakCount,
      overdueCount: overdue,
      badgeCount: earnedBadges.length,
      weeklyData,
      monthlyProgress
    };
  }, [goals, videos]);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
           <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
           <p className="text-muted-foreground animate-pulse">Syncing your data...</p>
        </div>
      </div>
    );
  }

  // Quick Actions Configuration
  const quickActions = [
    { label: "Goals", icon: Target, href: "/goals", color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Playlists", icon: Play, href: "/playlists", color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Flashcards", icon: Brain, href: "/flashcards", color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Ranks", icon: Trophy, href: "/leaderboard", color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Chat", icon: MessageCircle, href: "/chat", color: "text-pink-500", bg: "bg-pink-500/10" },
    { label: "Stats", icon: TrendingUp, href: "/performance", color: "text-indigo-500", bg: "bg-indigo-500/10" },
  ];

  const maxWeeklyValue = Math.max(...weeklyData.map(d => d.value), 1);

  return (
    <div className={cn("container mx-auto px-4 pb-20 animate-in fade-in duration-700 space-y-8", 
      theme === "dark" ? "text-white" : "text-zinc-900"
    )}>
      
      {/* BACKGROUND BLOBS */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
         <div className="absolute top-[10%] right-[5%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
         <div className="absolute bottom-[10%] left-[5%] w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] delay-1000 animate-pulse" />
      </div>

      {/* HERO SECTION */}
      <section className="flex flex-col md:flex-row justify-between items-end gap-6 pt-4">
         <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              {greeting}, {user?.displayName?.split(" ")[0] || "Student"}
            </h1>
            <p className="text-muted-foreground text-lg">
              Let's make today productive. You have <span className="text-primary font-bold">{totalGoals - completedGoals} pending goals</span>.
            </p>
         </div>
         <div className="flex gap-3 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
            {quickActions.map((a) => (
              <button 
                key={a.label}
                onClick={() => navigate(a.href)}
                className={cn("p-3 rounded-2xl transition-all hover:scale-110 hover:-translate-y-1 shadow-sm shrink-0", a.bg, a.color)}
                title={a.label}
              >
                <a.icon className="h-6 w-6" />
              </button>
            ))}
         </div>
      </section>

      {/* ALERTS */}
      {overdueCount > 0 && (
        <Alert variant="destructive" className="border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400">
          <AlertDescription className="flex items-center gap-2 font-medium">
            <Zap className="h-4 w-4" />
            Attention Needed: You have {overdueCount} overdue tasks!
          </AlertDescription>
        </Alert>
      )}

      {/* STATS BENTO GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
         <StatCard 
            icon={Flame} 
            label="Current Streak" 
            value={`${streak} Days`} 
            trend="up" 
            trendValue="Keep it up!" 
            color="from-orange-500 to-red-500" 
         />
         <StatCard 
            icon={Target} 
            label="Goals Crushed" 
            value={`${completedGoals}/${totalGoals}`} 
            trend={completedGoals > 0 ? "up" : undefined} 
            trendValue="On Track" 
            color="from-emerald-500 to-green-500" 
         />
         <StatCard 
            icon={Clock} 
            label="Focus Hours" 
            value={weeklyHours} 
            trend="up" 
            trendValue="This Week" 
            color="from-blue-500 to-cyan-500" 
         />
         <StatCard 
            icon={Medal} 
            label="Badges Earned" 
            value={badgeCount} 
            color="from-yellow-400 to-orange-500" 
         />
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         
         {/* LEFT COLUMN (Charts & Activity) */}
         <div className="lg:col-span-2 space-y-6">
            
            {/* ACTIVITY CHART */}
            <SpotlightCard className="p-6 md:p-8">
               <div className="flex items-center justify-between mb-8">
                  <div>
                     <h3 className="text-xl font-bold flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-primary" />
                        Activity Log
                     </h3>
                     <p className="text-sm text-muted-foreground">Your focus intensity over the last 7 days</p>
                  </div>
                  <div className="text-right hidden sm:block">
                     <p className="text-2xl font-bold">{weeklyData.reduce((a,b) => a + b.value, 0)}</p>
                     <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Sessions</p>
                  </div>
               </div>
               
               <div className="h-48 flex items-end gap-2 md:gap-4">
                  {weeklyData.map((d, i) => (
                     <div key={i} className="flex-1 flex flex-col justify-end group cursor-default">
                        <div className="relative w-full rounded-t-lg bg-muted/30 overflow-hidden h-full flex items-end">
                           <div 
                             className="w-full bg-gradient-to-t from-primary/50 to-primary rounded-t-lg transition-all duration-1000 ease-out group-hover:opacity-80"
                             style={{ 
                                height: `${(d.value / maxWeeklyValue) * 100}%`,
                                minHeight: d.value > 0 ? '4px' : '0' 
                             }} 
                           />
                           {/* Tooltip */}
                           <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-20">
                              {d.value} Sessions
                           </div>
                        </div>
                        <p className="text-center text-[10px] md:text-xs font-medium text-muted-foreground mt-2 uppercase truncate">{d.day}</p>
                     </div>
                  ))}
               </div>
            </SpotlightCard>

            {/* RECENT ACTIVITY LIST */}
            <SpotlightCard className="p-0">
               <div className="p-6 border-b border-border/40 flex justify-between items-center bg-muted/5">
                  <h3 className="font-bold flex items-center gap-2">
                     <Play className="h-5 w-5 text-purple-500" /> Recent Sessions
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/playlists")} className="text-xs h-8 rounded-full">View All</Button>
               </div>
               <div className="divide-y divide-border/40">
                  {recentActivity.length === 0 ? (
                     <div className="p-12 text-center">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                           <Play className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                        <p className="text-muted-foreground">No recent activity. Start learning!</p>
                        <Button variant="outline" className="mt-4 rounded-full" onClick={() => navigate("/playlists")}>Go to Playlists</Button>
                     </div>
                  ) : (
                     recentActivity.map((v) => (
                        <div 
                           key={v.id} 
                           onClick={() => navigate(`/playlists?video=${v.videoId}`)}
                           className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors cursor-pointer group"
                        >
                           <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors shrink-0">
                              <Play className="h-4 w-4 text-muted-foreground group-hover:text-primary fill-current" />
                           </div>
                           <div className="flex-1 min-w-0">
                              <p className="font-medium truncate group-hover:text-primary transition-colors">{v.title}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                 <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {v.watchTime}m</span>
                                 <span className="w-1 h-1 rounded-full bg-border" />
                                 <span className={cn("font-medium", v.completed ? "text-emerald-500" : "text-amber-500")}>
                                    {v.completed ? "Completed" : "In Progress"}
                                 </span>
                              </div>
                           </div>
                           <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                        </div>
                     ))
                  )}
               </div>
            </SpotlightCard>
         </div>

         {/* RIGHT COLUMN (Goals & Consistency) */}
         <div className="space-y-6">
            
            {/* GOALS WIDGET */}
            <SpotlightCard className="p-6">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold flex items-center gap-2">
                     <Target className="h-5 w-5 text-emerald-500" /> Active Goals
                  </h3>
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => navigate("/goals")}>
                     <ArrowUpRight className="h-4 w-4" />
                  </Button>
               </div>

               <div className="space-y-5">
                  {goals.length === 0 && (
                     <div className="text-center py-8 text-muted-foreground text-sm">
                        No goals set yet. 
                        <br/>
                        <span className="text-primary cursor-pointer hover:underline" onClick={() => navigate("/goals")}>Create one now</span>
                     </div>
                  )}
                  {goals.slice(0, 3).map((g) => {
                     const total = g.subGoals.length;
                     const done = g.subGoals.filter(s => s.completed).length;
                     const progress = total === 0 ? 0 : Math.round((done / total) * 100);
                     const isOverdue = g.deadline && g.deadline < Date.now() && progress < 100;

                     return (
                        <div key={g.id} className="space-y-2 group cursor-pointer" onClick={() => navigate("/goals")}>
                           <div className="flex justify-between text-sm">
                              <span className={cn("font-medium truncate", isOverdue && "text-red-500")}>{g.title}</span>
                              <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{progress}%</span>
                           </div>
                           <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                              <div 
                                className={cn("h-full rounded-full transition-all duration-1000", isOverdue ? "bg-red-500" : "bg-emerald-500")} 
                                style={{ width: `${progress}%` }} 
                              />
                           </div>
                        </div>
                     );
                  })}
               </div>
               
               <Button variant="outline" className="w-full mt-6 rounded-xl hover:bg-emerald-500/5 hover:text-emerald-600 hover:border-emerald-200" onClick={() => navigate("/goals")}>
                  + Create New Goal
               </Button>
            </SpotlightCard>

            {/* MONTHLY CONSISTENCY WIDGET */}
            <SpotlightCard className="p-6 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
               <div className="flex items-start justify-between mb-4">
                  <div>
                     <h3 className="font-bold">Consistency</h3>
                     <p className="text-xs text-muted-foreground">Last 30 days</p>
                  </div>
                  <Calendar className="h-5 w-5 text-primary opacity-50" />
               </div>
               
               {/* Visualizer Bar */}
               <div className="flex items-end gap-1 h-20 mb-4 opacity-70">
                   {Array.from({ length: 15 }).map((_, i) => (
                      <div 
                        key={i} 
                        className={cn("flex-1 rounded-sm transition-all duration-500", i % 3 === 0 ? "bg-primary/40" : "bg-primary/20")} 
                        style={{ height: `${20 + Math.random() * 80}%` }} 
                      />
                   ))}
               </div>
               
               <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                     <span className="text-xs text-muted-foreground font-medium">MONTHLY SCORE</span>
                     <span className="text-2xl font-bold">{Math.round(monthlyProgress)}%</span>
                  </div>
                  {/* Mini Circular Progress */}
                  <div className="relative h-12 w-12 flex items-center justify-center">
                     <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                        <path className="text-muted/30" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                        <path className="text-primary transition-all duration-1000" strokeDasharray={`${monthlyProgress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                     </svg>
                     <Zap className="absolute h-4 w-4 text-primary" />
                  </div>
               </div>
            </SpotlightCard>

         </div>
      </div>
    </div>
  );
}