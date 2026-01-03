import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, Brain, Clock, Target } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";

export default function Performance() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [flashcardStats, setFlashcardStats] = useState<any[]>([]);
  const [studyTime, setStudyTime] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      // 1. Fetch Flashcards for Retention Stats
      const cardsSnap = await getDocs(collection(db, "users", user.uid, "flashcards"));
      let learning = 0, reviewing = 0, mastered = 0;
      
      cardsSnap.docs.forEach(doc => {
        const srs = doc.data().srs || { repetition: 0, interval: 0 };
        if (srs.repetition === 0) learning++;
        else if (srs.interval > 21) mastered++;
        else reviewing++;
      });
      
      setFlashcardStats([
        { name: "Learning", value: learning, color: "#3b82f6" },
        { name: "Reviewing", value: reviewing, color: "#eab308" },
        { name: "Mastered", value: mastered, color: "#22c55e" }
      ]);

      // 2. Fetch Playlists for Study Time (Mocked daily data for visualization)
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const mockWeeklyData = days.map(day => ({
        day,
        minutes: Math.floor(Math.random() * 120) + 30, // Mock data
        goal: 60
      }));
      setStudyTime(mockWeeklyData);
      
      setLoading(false);
    };

    fetchData();
  }, [user]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading analytics...</div>;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <header className="max-w-6xl mx-auto flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-primary" /> Performance
          </h1>
          <p className="text-muted-foreground">Deep dive into your learning metrics</p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* FLASHCARD RETENTION */}
        <Card className="lg:col-span-1 border-2 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" /> Retention
            </CardTitle>
            <CardDescription>Flashcard mastery levels</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={flashcardStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {flashcardStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold">{flashcardStats.reduce((a, b) => a + b.value, 0)}</span>
              <span className="text-xs text-muted-foreground">Cards</span>
            </div>
          </CardContent>
        </Card>

        {/* STUDY TIME TREND */}
        <Card className="lg:col-span-2 border-2 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" /> Study Velocity
            </CardTitle>
            <CardDescription>Daily watch time vs. Goal (60m)</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={studyTime}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} dy={10} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)' }}
                />
                <Line type="monotone" dataKey="minutes" stroke="hsl(var(--primary))" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                <Line type="monotone" dataKey="goal" stroke="#ef4444" strokeDasharray="5 5" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* FOCUS METRICS (Mock) */}
        <Card className="lg:col-span-3 bg-gradient-to-br from-primary/5 via-primary/10 to-transparent border-0">
          <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-background rounded-full shadow-lg">
                <Target className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Focus Score: 92/100</h3>
                <p className="text-muted-foreground">You are in the top 5% of students this week!</p>
              </div>
            </div>
            <Button size="lg" className="shadow-lg" onClick={() => navigate('/goals')}>View Goals</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}