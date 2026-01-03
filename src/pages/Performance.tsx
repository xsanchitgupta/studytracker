import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ArrowLeft, TrendingUp, Brain, Clock, Target, BarChart3, Zap, Award, Flame } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Area, AreaChart } from "recharts";

export default function Performance() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  const [flashcardStats, setFlashcardStats] = useState<any[]>([]);
  const [studyTime, setStudyTime] = useState<any[]>([]);
  const [subjectData, setSubjectData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusScore, setFocusScore] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        // 1. Fetch Flashcards for Retention Stats
        const cardsSnap = await getDocs(collection(db, "users", user.uid, "flashcardDecks"));
        let learning = 0, reviewing = 0, mastered = 0;
        let totalCards = 0;
        
        cardsSnap.docs.forEach(doc => {
          const cards = doc.data().cards || [];
          totalCards += cards.length;
          cards.forEach((card: any) => {
            const srs = card.srs || { repetition: 0, interval: 0 };
            if (srs.repetition === 0) learning++;
            else if (srs.interval > 21) mastered++;
            else reviewing++;
          });
        });
        
        setFlashcardStats([
          { name: "Learning", value: learning, color: "#3b82f6" },
          { name: "Reviewing", value: reviewing, color: "#eab308" },
          { name: "Mastered", value: mastered, color: "#22c55e" }
        ]);

        // 2. Fetch Playlists for Study Time
        const playlistsSnap = await getDocs(collection(db, "users", user.uid, "playlists"));
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const weeklyData = days.map(day => ({
          day,
          minutes: Math.floor(Math.random() * 120) + 30, // Mock data - replace with real data
          goal: 60
        }));
        setStudyTime(weeklyData);

        // 3. Subject Distribution
        let subjectCounts: Record<string, number> = {};
        playlistsSnap.docs.forEach(doc => {
          const d = doc.data();
          const title = d.title || "Other";
          subjectCounts[title] = (subjectCounts[title] || 0) + (d.lectures?.length || 0);
        });
        setSubjectData(Object.entries(subjectCounts).map(([name, value]) => ({ name, value })));

        // 4. Calculate Focus Score (mock calculation)
        const totalMinutes = weeklyData.reduce((acc, d) => acc + d.minutes, 0);
        const avgDaily = totalMinutes / 7;
        const goalMet = weeklyData.filter(d => d.minutes >= d.goal).length;
        setFocusScore(Math.min(100, Math.round((avgDaily / 60) * 50 + (goalMet / 7) * 50)));

        setLoading(false);
      } catch (error) {
        console.error("Error fetching performance data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center",
        theme === "dark" ? "bg-background" : "bg-background"
      )}>
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff6b9d'];

  return (
    <div className={cn("min-h-screen transition-colors duration-300 pb-10",
      theme === "dark" 
        ? "bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-background to-background"
        : "bg-gradient-to-br from-background via-background to-muted/20"
    )}>
      <header className={cn("sticky top-0 z-50 border-b backdrop-blur-xl transition-all duration-300",
        theme === "dark" ? "bg-background/80 border-white/5" : "bg-background/60 border-border shadow-sm"
      )}>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-xl transition-all duration-300",
                theme === "dark" ? "bg-primary/20" : "bg-primary/10"
              )}>
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-2xl font-bold", theme === "dark" ? "text-white" : "text-foreground")}>
                  Performance Analytics
                </h1>
                <p className="text-xs text-muted-foreground">Deep dive into your learning metrics</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* Focus Score Hero */}
        <Card className={cn("overflow-hidden border backdrop-blur-xl transition-all duration-300 animate-in slide-in-from-top-4",
          theme === "dark" 
            ? "bg-gradient-to-br from-primary/10 via-background/80 to-background border-white/10 shadow-2xl" 
            : "bg-gradient-to-br from-primary/5 via-background to-background border-border shadow-lg"
        )}>
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className={cn("p-6 rounded-2xl",
                  theme === "dark" ? "bg-primary/20" : "bg-primary/10"
                )}>
                  <Target className="h-12 w-12 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className={cn("text-3xl font-bold", theme === "dark" ? "text-white" : "text-foreground")}>
                      Focus Score: {focusScore}/100
                    </h2>
                    {focusScore >= 80 && (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <Award className="h-3 w-3 mr-1" />
                        Excellent
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground">
                    {focusScore >= 80 
                      ? "You are in the top 5% of students this week!" 
                      : focusScore >= 60
                      ? "Great progress! Keep up the momentum."
                      : "Keep studying to improve your focus score."}
                  </p>
                  <Progress value={focusScore} className="mt-4 h-2 max-w-md" />
                </div>
              </div>
              <Button size="lg" className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90" onClick={() => navigate('/goals')}>
                <Target className="h-4 w-4 mr-2" />
                View Goals
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Brain} label="Total Cards" value={flashcardStats.reduce((a, b) => a + b.value, 0)} color="from-purple-500 to-pink-500" />
          <StatCard icon={Clock} label="Study Time" value={`${Math.floor(studyTime.reduce((a, b) => a + b.minutes, 0) / 60)}h`} color="from-blue-500 to-cyan-500" />
          <StatCard icon={Flame} label="Streak" value="7 days" color="from-orange-500 to-red-500" />
          <StatCard icon={Award} label="Mastered" value={flashcardStats.find(s => s.name === "Mastered")?.value || 0} color="from-green-500 to-emerald-500" />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Flashcard Retention */}
          <Card className={cn("backdrop-blur-xl border transition-all duration-300 hover:shadow-xl",
            theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
          )}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-500" /> 
                Flashcard Retention
              </CardTitle>
              <CardDescription>Mastery levels distribution</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={flashcardStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {flashcardStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: theme === "dark" ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.95)",
                      borderRadius: '8px',
                      border: theme === "dark" ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)"
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className={cn("text-4xl font-bold", theme === "dark" ? "text-white" : "text-foreground")}>
                  {flashcardStats.reduce((a, b) => a + b.value, 0)}
                </span>
                <span className="text-sm text-muted-foreground">Total Cards</span>
              </div>
              <div className="flex justify-center gap-4 mt-4">
                {flashcardStats.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-xs text-muted-foreground">{entry.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Study Time Trend */}
          <Card className={cn("backdrop-blur-xl border transition-all duration-300 hover:shadow-xl",
            theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
          )}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" /> 
                Study Velocity
              </CardTitle>
              <CardDescription>Daily watch time vs. Goal (60m)</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={studyTime}>
                  <defs>
                    <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                  <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: theme === "dark" ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)" }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: theme === "dark" ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)" }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: theme === "dark" ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.95)",
                      borderRadius: '8px',
                      border: theme === "dark" ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)"
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="minutes" 
                    stroke="hsl(var(--primary))" 
                    fillOpacity={1}
                    fill="url(#colorMinutes)"
                    strokeWidth={3}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="goal" 
                    stroke="#ef4444" 
                    strokeDasharray="5 5" 
                    strokeWidth={2} 
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Subject Distribution */}
          {subjectData.length > 0 && (
            <Card className={cn("lg:col-span-2 backdrop-blur-xl border transition-all duration-300 hover:shadow-xl",
              theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
            )}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" /> 
                  Subject Distribution
                </CardTitle>
                <CardDescription>Your learning across different subjects</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjectData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: theme === "dark" ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)" }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: theme === "dark" ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)" }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: theme === "dark" ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.95)",
                        borderRadius: '8px',
                        border: theme === "dark" ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)"
                      }}
                    />
                    <Bar 
                      dataKey="value" 
                      fill="hsl(var(--primary))" 
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { 
  icon: any; 
  label: string; 
  value: string | number;
  color: string;
}) {
  const { theme } = useTheme();
  
  return (
    <Card className={cn("backdrop-blur-xl border transition-all duration-300 hover:shadow-xl hover:scale-[1.02] overflow-hidden",
      theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1 truncate">{label}</p>
            <p className={cn("text-2xl font-bold truncate", theme === "dark" ? "text-white" : "text-foreground")}>
              {value}
            </p>
          </div>
          <div className={cn(`p-2 rounded-lg bg-gradient-to-br ${color} shrink-0`)}>
            <Icon className="h-4 w-4 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}