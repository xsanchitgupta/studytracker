import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ArrowLeft, TrendingUp, Brain, Clock, Target, BarChart3, Zap, Award, Flame, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart, CartesianGrid, Line } from "recharts";
import { startOfDay, subDays, format, isSameDay } from "date-fns";

// --- UI HELPERS ---

const SpotlightCard = ({ children, className = "", onClick, noHover = false }: any) => {
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
        "relative overflow-hidden rounded-3xl border bg-background/50 backdrop-blur-md transition-all duration-300",
        !noHover && "hover:border-primary/20",
        onClick && "cursor-pointer active:scale-[0.99]",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 hidden md:block z-0"
        style={{ opacity, background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(120, 119, 198, 0.1), transparent 40%)` }}
      />
      <div className="absolute inset-0 md:hidden pointer-events-none z-0 opacity-50 bg-gradient-to-br from-primary/5 to-transparent" />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color, subtext }: any) => (
  <SpotlightCard className="p-3 sm:p-4 md:p-5 flex flex-col justify-between h-24 sm:h-28 md:h-32 hover:scale-[1.02] transition-transform cursor-default">
    <div className="flex justify-between items-start">
      <div className={cn("p-2.5 rounded-xl bg-gradient-to-br shadow-inner text-white", color)}>
        <Icon className="h-5 w-5" />
      </div>
      {subtext && <span className="text-[10px] font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">{subtext}</span>}
    </div>
    <div>
      <p className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight">{value}</p>
      <p className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
    </div>
  </SpotlightCard>
);

// --- MAIN PAGE ---

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
        // --- 1. Real Flashcard Stats ---
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

        // --- 2. Real Study Time (From Logs) ---
        // Fetch last 7 days of logs
        const sevenDaysAgo = subDays(startOfDay(new Date()), 6);
        const logsSnap = await getDocs(query(
           collection(db, "users", user.uid, "study_logs"),
           where("createdAt", ">=", Timestamp.fromDate(sevenDaysAgo))
        ));

        const rawLogs = logsSnap.docs.map(d => ({
           minutes: d.data().minutes || 0,
           subject: d.data().subject || "General",
           createdAt: d.data().createdAt?.toDate() || new Date()
        }));

        // Group by Day for Chart
        const last7Days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i));
        
        const weeklyData = last7Days.map(date => {
           const dayLogs = rawLogs.filter(log => isSameDay(log.createdAt, date));
           const totalMinutes = dayLogs.reduce((acc, log) => acc + log.minutes, 0);
           return {
              day: format(date, 'EEE'),
              minutes: totalMinutes,
              goal: 60 // This could be a user setting in the future
           };
        });
        
        setStudyTime(weeklyData);

        // --- 3. Real Subject Distribution ---
        let subjectCounts: Record<string, number> = {};
        rawLogs.forEach(log => {
           subjectCounts[log.subject] = (subjectCounts[log.subject] || 0) + log.minutes;
        });
        
        // If no logs yet, try to fallback to playlist counts for "Interest"
        if (Object.keys(subjectCounts).length === 0) {
           const playlistsSnap = await getDocs(collection(db, "users", user.uid, "playlists"));
           playlistsSnap.docs.forEach(doc => {
              const d = doc.data();
              // Try to guess subject from title (e.g., "Math 101" -> "Math")
              const title = d.title || "Other";
              const subject = title.split(" ")[0] || "General";
              subjectCounts[subject] = (subjectCounts[subject] || 0) + (d.lectures?.length || 0);
           });
        }

        const sortedSubjects = Object.entries(subjectCounts)
           .map(([name, value]) => ({ name, value }))
           .sort((a,b) => b.value - a.value)
           .slice(0, 5);
           
        setSubjectData(sortedSubjects);

        // --- 4. Focus Score (Derived from Real Data) ---
        const totalMinutes = weeklyData.reduce((acc, d) => acc + d.minutes, 0);
        const avgDaily = totalMinutes / 7;
        const consistency = weeklyData.filter(d => d.minutes >= 20).length; // Days with >20m study
        // Formula: 60% based on hitting average goals, 40% based on consistency
        const score = Math.min(100, Math.round(((avgDaily / 60) * 60) + ((consistency / 7) * 40)));
        
        setFocusScore(score);
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
      <div className={cn("min-h-[80vh] flex items-center justify-center", theme === "dark" ? "bg-background" : "bg-background")}>
        <div className="flex flex-col items-center gap-4">
           <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
           <p className="text-muted-foreground animate-pulse">Analysing performance...</p>
        </div>
      </div>
    );
  }

  const totalCards = flashcardStats.reduce((a, b) => a + b.value, 0);
  const totalStudyHours = (studyTime.reduce((a, b) => a + b.minutes, 0) / 60).toFixed(1);

  return (
    <div className={cn("container mx-auto px-4 pb-20 animate-in fade-in duration-700 space-y-6 sm:space-y-8", 
      theme === "dark" ? "text-white" : "text-zinc-900"
    )}>
      
      {/* HEADER */}
      <div className="flex items-center gap-3 sm:gap-4 pt-4 sm:pt-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full hover:bg-muted h-10 w-10 sm:h-11 sm:w-11">
           <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
        <div>
           <h1 className="text-3xl md:text-4xl xl:text-5xl font-extrabold tracking-tight flex items-center gap-2 sm:gap-3">
             Performance <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
           </h1>
           <p className="text-muted-foreground text-sm sm:text-base">Real-time learning metrics</p>
        </div>
      </div>

      {/* FOCUS SCORE HERO */}
      <SpotlightCard className="p-0 overflow-hidden border-0" noHover>
         <div className="relative p-4 sm:p-6 md:p-8 lg:p-10 flex flex-col lg:flex-row items-center justify-between gap-4 sm:gap-6 lg:gap-8">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-purple-500/10 to-transparent pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 lg:gap-8 relative z-10 w-full sm:w-auto">
               <div className="relative h-20 w-20 sm:h-24 sm:w-24 lg:h-28 lg:w-28 flex items-center justify-center flex-shrink-0">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                     <path className="text-muted/20" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                     <path className="text-primary transition-all duration-1000 ease-out" strokeDasharray={`${focusScore}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                     <span className="text-xl sm:text-2xl lg:text-3xl font-bold">{focusScore}</span>
                     <span className="text-[8px] sm:text-[10px] text-muted-foreground uppercase tracking-widest">Score</span>
                  </div>
               </div>
               
               <div className="text-center sm:text-left flex-1 sm:flex-initial">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2 justify-center sm:justify-start">
                     <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold">Focus Score</h2>
                     {focusScore >= 80 && <Badge className="bg-green-500/20 text-green-500 border-green-500/30 px-2 py-0.5 self-center sm:self-auto">Excellent</Badge>}
                  </div>
                  <p className="text-muted-foreground max-w-md text-sm leading-relaxed text-center sm:text-left">
                     {focusScore === 0 ? "No study data yet. Watch a lecture or use the timer to start tracking!" :
                      focusScore >= 80 ? "Top tier performance! Your consistency is impressive." : 
                      "Keep building your streak to improve this score."}
                  </p>
               </div>
            </div>

            <Button size="lg" className="relative z-10 rounded-full px-4 sm:px-6 lg:px-8 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 h-9 sm:h-10 lg:h-12 text-sm sm:text-base w-full sm:w-auto" onClick={() => navigate('/goals')}>
               <Target className="mr-2 h-4 w-4" /> View Goals
            </Button>
         </div>
      </SpotlightCard>

      {/* STATS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
         <StatCard icon={Brain} label="Total Cards" value={totalCards} color="from-purple-500 to-pink-500" />
         <StatCard icon={Clock} label="Study Time" value={`${totalStudyHours}h`} color="from-blue-500 to-cyan-500" subtext="Last 7 Days" />
         <StatCard icon={Flame} label="Daily Goal" value={studyTime[6]?.minutes >= 60 ? "Met" : `${studyTime[6]?.minutes}/60m`} color="from-orange-500 to-red-500" />
         <StatCard icon={Award} label="Mastered" value={flashcardStats.find(s => s.name === "Mastered")?.value || 0} color="from-green-500 to-emerald-500" />
      </div>

      {/* CHARTS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         
         {/* STUDY VELOCITY CHART */}
         <SpotlightCard className="p-4 sm:p-6 md:p-8 flex flex-col" noHover>
            <div className="flex items-center justify-between mb-4 sm:mb-6">
               <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500"><TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" /></div>
                  <div>
                     <h3 className="font-bold text-base sm:text-lg">Study Velocity</h3>
                     <p className="text-xs text-muted-foreground">Daily Minutes vs Goal (60m)</p>
                  </div>
               </div>
            </div>

            <div className="flex-1 min-h-[200px] sm:min-h-[250px] lg:min-h-[300px]">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={studyTime} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                        tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 12 }}
                        dy={10}
                     />
                     <YAxis hide />
                     <Tooltip 
                        contentStyle={{ 
                           backgroundColor: theme === "dark" ? "rgba(20,20,20,0.9)" : "rgba(255,255,255,0.9)",
                           borderRadius: '12px',
                           border: 'none',
                           boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
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
                        activeDot={false}
                     />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </SpotlightCard>

         {/* RETENTION CHART */}
         <SpotlightCard className="p-4 sm:p-6 md:p-8 flex flex-col" noHover>
            <div className="flex items-center justify-between mb-4 sm:mb-6">
               <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500"><Brain className="h-4 w-4 sm:h-5 sm:w-5" /></div>
                  <h3 className="font-bold text-base sm:text-lg">Retention</h3>
               </div>
            </div>
            
            <div className="flex-1 min-h-[200px] sm:min-h-[250px] lg:min-h-[300px] relative">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                     <Pie
                        data={flashcardStats}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                     >
                        {flashcardStats.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                     </Pie>
                     <Tooltip 
                        contentStyle={{ 
                           backgroundColor: theme === "dark" ? "rgba(20,20,20,0.9)" : "rgba(255,255,255,0.9)",
                           borderRadius: '12px',
                           border: 'none',
                           boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                        itemStyle={{ color: theme === "dark" ? "#fff" : "#000" }}
                     />
                  </PieChart>
               </ResponsiveContainer>
               
               <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl sm:text-2xl lg:text-3xl md:text-4xl font-bold">{totalCards}</span>
                  <span className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground uppercase tracking-widest">Cards</span>
               </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3 sm:gap-4 md:gap-6 mt-3 sm:mt-4">
               {flashcardStats.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                     <span className="text-[9px] sm:text-[10px] md:text-xs font-medium text-muted-foreground">{entry.name}</span>
                  </div>
               ))}
            </div>
         </SpotlightCard>

         {/* SUBJECT DISTRIBUTION */}
         {subjectData.length > 0 && (
            <SpotlightCard className="md:col-span-2 p-4 sm:p-6 md:p-8" noHover>
               <div className="flex items-center gap-2 mb-4 sm:mb-6">
                  <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500"><Activity className="h-4 w-4 sm:h-5 sm:w-5" /></div>
                  <h3 className="font-bold text-base sm:text-lg">Subject Breakdown</h3>
               </div>
               
               <div className="h-[180px] sm:h-[200px] lg:h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={subjectData} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.1} />
                        <XAxis type="number" hide />
                        <YAxis 
                           dataKey="name" 
                           type="category" 
                           axisLine={false} 
                           tickLine={false}
                           width={100}
                           tick={{ fill: 'currentColor', fontSize: 13, fontWeight: 600 }}
                        />
                        <Tooltip 
                           cursor={{fill: 'rgba(255,255,255,0.05)', radius: 8}}
                           contentStyle={{ 
                              backgroundColor: theme === "dark" ? "rgba(20,20,20,0.9)" : "rgba(255,255,255,0.9)",
                              borderRadius: '12px',
                              border: 'none'
                           }}
                        />
                        <Bar 
                           dataKey="value" 
                           fill="hsl(var(--primary))" 
                           radius={[0, 8, 8, 0]} 
                           barSize={32}
                        />
                     </BarChart>
                  </ResponsiveContainer>
               </div>
            </SpotlightCard>
         )}
      </div>
    </div>
  );
}