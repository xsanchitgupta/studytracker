import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { getEarnedBadges } from "@/lib/badges";
import { useTheme } from "@/contexts/ThemeContext";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

import {
  BookOpen,
  Target,
  Trophy,
  MessageCircle,
  Play,
  TrendingUp,
  Clock,
  LogOut,
  Settings,
  Bell,
  Flame,
  Star,
  Brain,
  AlertCircle,
  Medal,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Zap
} from "lucide-react";

type SubGoal = { id: string; completed: boolean };

type Goal = {
  id: string;
  title: string;
  subGoals: SubGoal[];
  createdAt?: Timestamp;
  deadline?: number; // New field from Enhanced Goals
};

type VideoActivity = {
  id: string;
  title: string;
  videoId: string;
  watchTime?: number;
  completed?: boolean;
  updatedAt?: Timestamp;
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [videos, setVideos] = useState<VideoActivity[]>([]);
  const [recentActivity, setRecentActivity] = useState<VideoActivity[]>([]);
  const [loading, setLoading] = useState(true);

  // -------- FETCH DATA --------
  useEffect(() => {
    if (!user) return;
    
    let isMounted = true;
    
    // Fetch Goals
    const qGoals = query(collection(db, "users", user.uid, "goals"));
    const unsubGoals = onSnapshot(
      qGoals, 
      (snap) => {
        if (!isMounted) return;
        try {
          const data: Goal[] = snap.docs.map(d => {
            try {
              const raw = d.data() as any;
              return {
                id: d.id,
                title: raw.title ?? "Untitled Goal",
                subGoals: Array.isArray(raw.subGoals) ? raw.subGoals : [],
                createdAt: raw.createdAt,
                deadline: raw.deadline
              };
            } catch (err) {
              console.error("Error parsing goal:", err);
              return null;
            }
          }).filter((g): g is Goal => g !== null);
          
          if (isMounted) {
            setGoals(data);
          }
        } catch (error) {
          console.error("Error processing goals:", error);
        }
      },
      (error) => {
        console.error("Goals listener error:", error);
        if (isMounted) {
          setLoading(false);
        }
      }
    );

    // Fetch Playlists/Videos
    const qPlaylists = query(collection(db, "users", user.uid, "playlists"));
    const unsubPlaylists = onSnapshot(
      qPlaylists, 
      (snap) => {
        if (!isMounted) return;
        try {
          const vids: VideoActivity[] = [];
          snap.docs.forEach(d => {
            try {
              const raw = d.data() as any;
              if (Array.isArray(raw.lectures)) {
                raw.lectures.forEach((l: any) => {
                  vids.push({
                    id: l.id,
                    title: l.title,
                    videoId: l.videoId,
                    watchTime: l.watchTime || 0,
                    completed: l.completed || false,
                    updatedAt: raw.updatedAt, // Approximate last access from playlist
                  });
                });
              }
            } catch (err) {
              console.error("Error parsing playlist:", err);
            }
          });
          
          if (isMounted) {
            setVideos(vids);
            
            // Sort for recent activity (simplified)
            const sorted = vids
              .filter(v => v.updatedAt)
              .sort((a, b) => b.updatedAt!.toMillis() - a.updatedAt!.toMillis())
              .slice(0, 5);
            setRecentActivity(sorted);
            setLoading(false);
          }
        } catch (error) {
          console.error("Error processing playlists:", error);
          if (isMounted) {
            setLoading(false);
          }
        }
      },
      (error) => {
        console.error("Playlists listener error:", error);
        if (isMounted) {
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      unsubGoals();
      unsubPlaylists();
    };
  }, [user]);

  // -------- COMPUTED STATS --------
  const { completedGoals, totalGoals, weeklyHours, streak, overdueCount, badgeCount, weeklyData, monthlyProgress } = useMemo(() => {
    // Goals Stats
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
    // Simple streak logic: check consecutive days backwards
    for (let i = 0; ; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      if (days.has(d.toDateString())) streakCount++;
      else if (i > 0) break; // Allow gap if checking today and no activity *yet*
    }

    // Weekly Hours
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const activeVideos = videos.filter(v => v.updatedAt && v.updatedAt.toDate() >= weekAgo);
    
    // Weekly data for chart (last 7 days)
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
    
    // Monthly progress (last 30 days)
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthlyVideos = videos.filter(v => v.updatedAt && v.updatedAt.toDate() >= monthAgo);
    const monthlyProgress = Math.min(100, (monthlyVideos.length / 30) * 100);
    
    // Badge Calculation
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
    return <div className="min-h-screen flex items-center justify-center">Loading dashboard...</div>;
  }

  // Updated Actions with new routes
  const quickActions = [
    { label: "Study Goals", icon: Target, href: "/goals", color: "bg-gradient-to-br from-green-500 to-emerald-600" },
    { label: "Playlists", icon: Play, href: "/playlists", color: "bg-gradient-to-br from-purple-500 to-violet-600" },
    { label: "Flashcards", icon: Brain, href: "/flashcards", color: "bg-gradient-to-br from-blue-500 to-cyan-600" },
    { label: "Leaderboard", icon: Trophy, href: "/leaderboard", color: "bg-gradient-to-br from-yellow-500 to-orange-600" },
    { label: "Chat", icon: MessageCircle, href: "/chat", color: "bg-gradient-to-br from-pink-500 to-rose-600" },
    { label: "Performance", icon: TrendingUp, href: "/performance", color: "bg-gradient-to-br from-indigo-500 to-purple-600" },
  ];

  const maxWeeklyValue = Math.max(...weeklyData.map(d => d.value), 1);

  return (
    <div className={cn("min-h-screen transition-colors duration-300",
      theme === "dark" 
        ? "bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-background to-background"
        : "bg-gradient-to-br from-background via-background to-muted/20"
    )}>
      <header className={cn("sticky top-0 z-50 border-b backdrop-blur-xl transition-all duration-300",
        theme === "dark" ? "bg-background/80 border-white/5" : "bg-background/60 border-border shadow-sm"
      )}>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-xl transition-all duration-300",
              theme === "dark" ? "bg-primary/20" : "bg-primary/10"
            )}>
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">StudySync</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate("/chat")}>
              <MessageCircle className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full"><Bell className="h-5 w-5" /></Button>
            <ThemeToggle />
            <Avatar onClick={() => navigate("/profile")} className="cursor-pointer ring-2 ring-primary/20 hover:ring-primary/40 transition-all">
              <AvatarImage src={user?.photoURL || ""} />
              <AvatarFallback className="bg-primary text-primary-foreground font-bold">{user?.email?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-500">
        {/* WELCOME SECTION */}
        <section className={cn("relative overflow-hidden rounded-3xl p-8 backdrop-blur-xl border transition-all duration-300 animate-in slide-in-from-top-4",
          theme === "dark" 
            ? "bg-gradient-to-br from-primary/10 via-background/80 to-background border-white/10 shadow-2xl" 
            : "bg-gradient-to-br from-primary/5 via-background to-background border-border shadow-lg"
        )}>
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-2">
                <h1 className={cn("text-4xl md:text-5xl font-extrabold tracking-tight",
                  theme === "dark" ? "text-white" : "text-foreground"
                )}>
                  Welcome back, <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{user?.displayName || "Student"}</span>!
                </h1>
                <p className="text-muted-foreground text-lg">Ready to crush your goals today? 🚀</p>
              </div>
              <Button variant="outline" className="rounded-full" onClick={async () => { await logout(); navigate("/auth"); }}>
                <LogOut className="h-4 w-4 mr-2" /> Logout
              </Button>
            </div>
          </div>
          <div className={cn("absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-20 animate-pulse",
            theme === "dark" ? "bg-primary" : "bg-primary/30"
          )} />
        </section>

        {/* ALERTS */}
        {overdueCount > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Attention Needed</AlertTitle>
            <AlertDescription>
              You have {overdueCount} overdue goal{overdueCount > 1 ? 's' : ''}. Check your <span className="underline cursor-pointer font-bold" onClick={() => navigate('/goals')}>Study Goals</span>.
            </AlertDescription>
          </Alert>
        )}

        {/* STATS GRID */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <Stat icon={Flame} label="Study Streak" value={`${streak} days`} trend="up" color="from-orange-500 to-red-500" />
          <Stat icon={Target} label="Goals Completed" value={`${completedGoals}/${totalGoals}`} trend={completedGoals > 0 ? "up" : undefined} color="from-green-500 to-emerald-500" />
          <Stat icon={Medal} label="Badges Earned" value={`${badgeCount}`} trend="up" color="from-yellow-500 to-amber-500" />
          <Stat icon={Clock} label="Est. Hours (Week)" value={weeklyHours} trend="up" color="from-blue-500 to-cyan-500" />
        </section>

        {/* CHARTS SECTION */}
        <section className="grid lg:grid-cols-2 gap-6">
          {/* Weekly Activity Chart */}
          <Card className={cn("rounded-3xl border backdrop-blur-xl transition-all duration-300 hover:shadow-xl animate-in slide-in-from-left-4",
            theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border shadow-lg"
          )}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Weekly Activity
                </CardTitle>
                <CardDescription>Your study activity over the last 7 days</CardDescription>
              </div>
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-end justify-between h-48 gap-2">
                  {weeklyData.map((day, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                      <div className="relative w-full flex items-end justify-center h-full">
                        <div 
                          className={cn("w-full rounded-t-lg transition-all duration-500 hover:opacity-80 cursor-pointer group-hover:scale-105",
                            theme === "dark" ? "bg-gradient-to-t from-primary/60 to-primary" : "bg-gradient-to-t from-primary/40 to-primary"
                          )}
                          style={{ height: `${(day.value / maxWeeklyValue) * 100}%`, minHeight: day.value > 0 ? '8px' : '0' }}
                        />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{day.day}</span>
                      <span className="text-xs font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">{day.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Progress */}
          <Card className={cn("rounded-3xl border backdrop-blur-xl transition-all duration-300 hover:shadow-xl animate-in slide-in-from-right-4",
            theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border shadow-lg"
          )}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Monthly Progress
              </CardTitle>
              <CardDescription>Your consistency over the last 30 days</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-bold text-primary">{Math.round(monthlyProgress)}%</span>
                </div>
                <div className="relative h-4 rounded-full overflow-hidden bg-muted">
                  <div 
                    className={cn("h-full rounded-full transition-all duration-1000 ease-out",
                      theme === "dark" ? "bg-gradient-to-r from-primary to-accent" : "bg-gradient-to-r from-primary to-accent"
                    )}
                    style={{ width: `${monthlyProgress}%` }}
                  />
                </div>
              </div>
              <div className={cn("p-4 rounded-xl border",
                theme === "dark" ? "bg-primary/10 border-primary/20" : "bg-primary/5 border-primary/10"
              )}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Keep it up!</p>
                    <p className="text-xs text-muted-foreground">You're making great progress</p>
                  </div>
                  <Zap className="h-8 w-8 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* QUICK ACTIONS */}
        <section className="animate-in slide-in-from-bottom-4">
          <h2 className={cn("text-2xl font-bold mb-6 flex items-center gap-2",
            theme === "dark" ? "text-white" : "text-foreground"
          )}>
            Quick Actions
            <ArrowUpRight className="h-5 w-5 text-primary" />
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {quickActions.map((a, i) => (
              <div
                key={a.label}
                onClick={() => a.href !== "#" && navigate(a.href)}
                className={cn(
                  `${a.color} rounded-3xl h-32 md:h-40 p-4 md:p-6 cursor-pointer text-white flex flex-col justify-between shadow-lg hover:scale-[1.05] transition-all duration-300 hover:shadow-2xl group animate-in fade-in`,
                  `slide-in-from-bottom-${(i % 6) + 1}`
                )}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <a.icon className="h-6 w-6 md:h-8 md:w-8 group-hover:scale-110 transition-transform duration-300" />
                <div>
                  <p className="font-semibold text-sm md:text-base">{a.label}</p>
                  <p className="text-[10px] md:text-xs opacity-80 flex items-center gap-1">
                    {a.href === "#" ? "Coming soon" : "Open"} 
                    {a.href !== "#" && <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ACTIVITY & GOALS */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className={cn("rounded-3xl border backdrop-blur-xl transition-all duration-300 hover:shadow-xl animate-in slide-in-from-left-4",
            theme === "dark" ? "bg-background/40 border-white/10 shadow-lg" : "bg-background/60 border-border shadow-lg"
          )}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Upcoming Tasks
                </CardTitle>
                <CardDescription>{goals.length} active goal{goals.length !== 1 ? 's' : ''}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {goals.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Target className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-sm text-muted-foreground">No goals yet</p>
                  <Button variant="outline" className="mt-4 rounded-full" onClick={() => navigate("/goals")}>
                    Create your first goal
                  </Button>
                </div>
              )}
              {goals.slice(0, 4).map((g, i) => {
                const total = g.subGoals.length;
                const done = g.subGoals.filter(s => s.completed).length;
                const progress = total === 0 ? 0 : Math.round((done / total) * 100);
                const isOverdue = g.deadline && g.deadline < Date.now() && progress < 100;
                
                return (
                  <div key={g.id} className={cn("space-y-2 p-3 rounded-xl border transition-all duration-300 hover:scale-[1.02]",
                    theme === "dark" ? "bg-white/5 border-white/10" : "bg-muted/30 border-border",
                    `animate-in fade-in slide-in-from-left-${i + 1}`
                  )} style={{ animationDelay: `${i * 100}ms` }}>
                    <div className="flex justify-between text-sm">
                      <span className={cn("font-medium", isOverdue ? "text-destructive" : "text-foreground")}>
                        {g.title} {isOverdue && <span className="text-xs">(Overdue)</span>}
                      </span>
                      <span className="font-bold text-primary">{progress}%</span>
                    </div>
                    <Progress value={progress} className={cn("h-2", isOverdue ? "bg-destructive/20" : "")} />
                  </div>
                );
              })}
              {goals.length > 4 && (
                <Button variant="outline" className="w-full rounded-full" onClick={() => navigate("/goals")}>
                  View all {goals.length} goals
                  <ArrowUpRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className={cn("rounded-3xl border backdrop-blur-xl transition-all duration-300 hover:shadow-xl animate-in slide-in-from-right-4",
            theme === "dark" ? "bg-background/40 border-white/10 shadow-lg" : "bg-background/60 border-border shadow-lg"
          )}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5 text-primary" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Your latest study sessions</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivity.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Play className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                  <Button variant="outline" className="mt-4 rounded-full" onClick={() => navigate("/playlists")}>
                    Start studying
                  </Button>
                </div>
              )}
              {recentActivity.map((v, i) => (
                <div
                  key={v.id}
                  onClick={() => navigate(`/playlists?video=${v.videoId}`)}
                  className={cn("flex items-center gap-3 cursor-pointer p-3 rounded-xl border transition-all duration-300 hover:scale-[1.02] group",
                    theme === "dark" ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-muted/30 border-border hover:bg-muted/50",
                    `animate-in fade-in slide-in-from-right-${i + 1}`
                  )}
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className={cn("p-2 rounded-full transition-all duration-300 group-hover:scale-110",
                    theme === "dark" ? "bg-primary/20" : "bg-primary/10"
                  )}>
                    <Play className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-foreground">{v.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.watchTime ? `Watched ${v.watchTime} min` : "Opened"} • {v.completed ? "Completed" : "In Progress"}
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value, trend, color = "from-primary to-accent" }: { 
  icon: any; 
  label: string; 
  value: string; 
  trend?: "up" | "down";
  color?: string;
}) {
  const { theme } = useTheme();
  
  return (
    <Card className={cn("rounded-3xl border backdrop-blur-xl transition-all duration-300 hover:shadow-xl hover:scale-[1.02] group overflow-hidden",
      theme === "dark" ? "bg-background/40 border-white/10 shadow-lg" : "bg-background/60 border-border shadow-lg"
    )}>
      <CardContent className="p-6 flex items-center gap-4 relative">
        <div className={cn(`p-4 rounded-2xl bg-gradient-to-br ${color} shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`)}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground truncate mb-1">{label}</p>
          <div className="flex items-center gap-2">
            <p className={cn("text-2xl font-bold truncate", theme === "dark" ? "text-white" : "text-foreground")}>{value}</p>
            {trend === "up" && (
              <TrendingUp className="h-4 w-4 text-emerald-500 animate-in fade-in" />
            )}
          </div>
        </div>
        <div className={cn(`absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-10 bg-gradient-to-br ${color} transition-opacity group-hover:opacity-20`)} />
      </CardContent>
    </Card>
  );
}