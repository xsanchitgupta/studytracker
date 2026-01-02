import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
} from "lucide-react";

type SubGoal = { id: string; completed: boolean };

type Goal = {
  id: string;
  title: string;
  subGoals: SubGoal[];
  createdAt?: Timestamp;
};

type VideoActivity = {
  id: string;
  title: string;
  videoId: string;
  watchTime?: number;
  updatedAt?: Timestamp;
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [videos, setVideos] = useState<VideoActivity[]>([]);
  const [recentActivity, setRecentActivity] = useState<VideoActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "goals"));
    const unsub = onSnapshot(q, snap => {
      const data: Goal[] = snap.docs.map(d => {
        const raw = d.data() as any;
        return {
          id: d.id,
          title: raw.title ?? "Untitled Goal",
          subGoals: Array.isArray(raw.subGoals) ? raw.subGoals : [],
          createdAt: raw.createdAt,
        };
      });
      setGoals(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "playlists"));
    const unsub = onSnapshot(q, snap => {
      const vids: VideoActivity[] = [];
      snap.docs.forEach(d => {
        const raw = d.data() as any;
        if (Array.isArray(raw.lectures)) {
          raw.lectures.forEach((l: any) => {
            vids.push({
              id: l.id,
              title: l.title,
              videoId: l.videoId,
              watchTime: l.watchTime,
              updatedAt: raw.updatedAt,
            });
          });
        }
      });
      setVideos(vids);
      const sorted = vids
        .filter(v => v.updatedAt)
        .sort((a, b) => b.updatedAt!.toMillis() - a.updatedAt!.toMillis())
        .slice(0, 6);
      setRecentActivity(sorted);
    });
    return () => unsub();
  }, [user]);

  const { completedGoals, totalGoals, weeklyHours, streak } = useMemo(() => {
    let completed = 0;
    goals.forEach(g => {
      if (g.subGoals.length > 0 && g.subGoals.every(sg => sg.completed)) completed++;
    });

    const days = new Set(
      videos
        .filter(v => v.updatedAt)
        .map(v => v.updatedAt!.toDate().toDateString())
    );

    let streakCount = 0;
    const today = new Date();

    for (let i = 0; ; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      if (days.has(d.toDateString())) streakCount++;
      else break;
    }

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weeklyVideos = videos.filter(v => v.updatedAt && v.updatedAt.toDate() >= weekAgo);

    return {
      completedGoals: completed,
      totalGoals: goals.length,
      weeklyHours: weeklyVideos.length === 0 ? "N/A" : `${(weeklyVideos.length * 0.25).toFixed(1)}h`,
      streak: streakCount,
    };
  }, [goals, videos]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading dashboard...</div>;
  }

  const quickActions = [
    { label: "Study Goals", icon: Target, href: "/goals", color: "bg-gradient-to-br from-green-500 to-emerald-600" },
    { label: "Playlists", icon: Play, href: "/playlists", color: "bg-gradient-to-br from-purple-500 to-violet-600" },
    { label: "Practice Tests", icon: BookOpen, href: "#", color: "bg-gradient-to-br from-blue-500 to-cyan-600" },
    { label: "Leaderboard", icon: Trophy, href: "#", color: "bg-gradient-to-br from-yellow-500 to-orange-600" },
    { label: "Chat", icon: MessageCircle, href: "#", color: "bg-gradient-to-br from-pink-500 to-rose-600" },
    { label: "Performance", icon: TrendingUp, href: "#", color: "bg-gradient-to-br from-indigo-500 to-purple-600" },
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
            <Button variant="ghost" size="icon"><Bell /></Button>
            <ThemeToggle />
            <Button variant="ghost" size="icon"><Settings /></Button>
            <Avatar onClick={() => navigate("/profile")} className="cursor-pointer">
              <AvatarImage src={user?.photoURL || ""} />
              <AvatarFallback>{user?.email?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-10">
        <section className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Welcome back, {user?.displayName || user?.email?.split("@")[0]}!</h1>
            <p className="text-muted-foreground">Ready to crush your goals today?</p>
          </div>
          <Button variant="outline" onClick={async () => { await logout(); navigate("/auth"); }}>
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <Stat icon={Flame} label="Study Streak" value={`${streak} days`} />
          <Stat icon={Target} label="Goals Completed" value={`${completedGoals}/${totalGoals}`} />
          <Stat icon={Trophy} label="Leaderboard Rank" value="N/A" />
          <Stat icon={Clock} label="Estimated Hours This Week" value={weeklyHours} />
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {quickActions.map(a => (
              <div
                key={a.label}
                onClick={() => a.href !== "#" && navigate(a.href)}
                className={`${a.color} rounded-3xl h-40 p-6 cursor-pointer text-white flex flex-col justify-between shadow-lg`}
              >
                <a.icon className="h-8 w-8" />
                <div>
                  <p className="font-semibold">{a.label}</p>
                  <p className="text-xs opacity-80">{a.href === "#" ? "Coming soon" : "Open"}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>Upcoming Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {goals.length === 0 && <p className="text-sm text-muted-foreground">No goals yet</p>}
              {goals.map(g => {
                const total = g.subGoals.length;
                const done = g.subGoals.filter(s => s.completed).length;
                const progress = total === 0 ? 0 : Math.round((done / total) * 100);
                return (
                  <div key={g.id}>
                    <div className="flex justify-between text-sm"><span>{g.title}</span><span>{progress}%</span></div>
                    <Progress value={progress} />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
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
                  className="flex items-center gap-3 cursor-pointer hover:bg-muted/40 p-2 rounded-xl"
                >
                  <Star className="h-5 w-5" />
                  <div>
                    <p className="text-sm">{v.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.watchTime ? `Watched ${v.watchTime} min` : "Opened"}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Connect with Peers</CardTitle>
            <CardDescription>N/A</CardDescription>
          </CardHeader>
        </Card>
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card className="rounded-3xl">
      <CardContent className="p-5 flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-muted"><Icon className="h-6 w-6" /></div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}