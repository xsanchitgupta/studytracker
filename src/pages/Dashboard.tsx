import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { getEarnedBadges } from "@/lib/badges"; // Assuming you added this file from the previous step

import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
  Medal
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
  const navigate = useNavigate();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [videos, setVideos] = useState<VideoActivity[]>([]);
  const [recentActivity, setRecentActivity] = useState<VideoActivity[]>([]);
  const [loading, setLoading] = useState(true);

  // -------- FETCH DATA --------
  useEffect(() => {
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
              updatedAt: raw.updatedAt, // Approximate last access from playlist
            });
          });
        }
      });
      setVideos(vids);
      
      // Sort for recent activity (simplified)
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
  const { completedGoals, totalGoals, weeklyHours, streak, overdueCount, badgeCount } = useMemo(() => {
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
    // Note: accurate weekly hours requires a dedicated 'sessions' collection. 
    // This is an estimation based on *updated* videos, which is imperfect but works for a demo.
    const activeVideos = videos.filter(v => v.updatedAt && v.updatedAt.toDate() >= weekAgo);
    
    // Badge Calculation (Reuse logic from badges.ts)
    const totalMinutes = videos.reduce((acc, v) => acc + (v.watchTime || 0), 0);
    const watchedLectures = videos.filter(v => v.completed).length;
    const earnedBadges = getEarnedBadges({ watchedLectures, totalMinutes, completedGoals: completed });

    return {
      completedGoals: completed,
      totalGoals: goals.length,
      weeklyHours: activeVideos.length === 0 ? "0h" : `${(activeVideos.length * 0.5).toFixed(1)}h`, // Estimate
      streak: streakCount,
      overdueCount: overdue,
      badgeCount: earnedBadges.length
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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold">StudySync</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/chat")}><MessageCircle className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon"><Bell className="h-5 w-5" /></Button>
            <ThemeToggle />
            <Avatar onClick={() => navigate("/profile")} className="cursor-pointer">
              <AvatarImage src={user?.photoURL || ""} />
              <AvatarFallback>{user?.email?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-8">
        {/* WELCOME SECTION */}
        <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Welcome back, {user?.displayName || "Student"}!</h1>
            <p className="text-muted-foreground">Ready to crush your goals today?</p>
          </div>
          <Button variant="outline" onClick={async () => { await logout(); navigate("/auth"); }}>
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
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
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <Stat icon={Flame} label="Study Streak" value={`${streak} days`} />
          <Stat icon={Target} label="Goals Completed" value={`${completedGoals}/${totalGoals}`} />
          {/* Replaced generic leaderboard rank with Badge Count */}
          <Stat icon={Medal} label="Badges Earned" value={`${badgeCount}`} />
          <Stat icon={Clock} label="Est. Hours (Week)" value={weeklyHours} />
        </section>

        {/* QUICK ACTIONS */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {quickActions.map(a => (
              <div
                key={a.label}
                onClick={() => a.href !== "#" && navigate(a.href)}
                className={`${a.color} rounded-3xl h-32 md:h-40 p-4 md:p-6 cursor-pointer text-white flex flex-col justify-between shadow-lg hover:scale-[1.02] transition-transform`}
              >
                <a.icon className="h-6 w-6 md:h-8 md:w-8" />
                <div>
                  <p className="font-semibold text-sm md:text-base">{a.label}</p>
                  <p className="text-[10px] md:text-xs opacity-80">{a.href === "#" ? "Coming soon" : "Open"}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ACTIVITY & GOALS */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="rounded-3xl shadow-sm border-2">
            <CardHeader>
              <CardTitle>Upcoming Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {goals.length === 0 && <p className="text-sm text-muted-foreground">No goals yet</p>}
              {goals.slice(0, 4).map(g => {
                const total = g.subGoals.length;
                const done = g.subGoals.filter(s => s.completed).length;
                const progress = total === 0 ? 0 : Math.round((done / total) * 100);
                const isOverdue = g.deadline && g.deadline < Date.now() && progress < 100;
                
                return (
                  <div key={g.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className={isOverdue ? "text-destructive font-medium" : ""}>
                        {g.title} {isOverdue && "(Overdue)"}
                      </span>
                      <span className="text-muted-foreground">{progress}%</span>
                    </div>
                    <Progress value={progress} className={isOverdue ? "bg-destructive/20" : ""} indicatorClassName={isOverdue ? "bg-destructive" : ""} />
                  </div>
                );
              })}
              {goals.length > 4 && (
                <Button variant="ghost" className="w-full text-xs" onClick={() => navigate("/goals")}>
                  View all goals
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-sm border-2">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivity.length === 0 && (
                <p className="text-sm text-muted-foreground">No recent activity</p>
              )}
              {recentActivity.map(v => (
                <div
                  key={v.id}
                  onClick={() => navigate(`/playlists?video=${v.videoId}`)}
                  className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded-xl transition-colors"
                >
                  <div className="p-2 bg-primary/10 rounded-full text-primary">
                    <Play className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{v.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.watchTime ? `Watched ${v.watchTime} min` : "Opened"} • {v.completed ? "Completed" : "In Progress"}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card className="rounded-3xl shadow-sm border-2">
      <CardContent className="p-5 flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-muted shrink-0"><Icon className="h-6 w-6" /></div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-bold truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}