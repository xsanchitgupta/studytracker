import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, orderBy, limit, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { 
  ArrowLeft, Trophy, Medal, Crown, TrendingUp, 
  Flame, Clock, Target, BookOpen, Brain, Zap, User, Star, Award 
} from "lucide-react";

// --- TYPES ---
interface LeaderboardUser {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  score: number;
  watchedLectures: number;
  totalMinutes: number;
  completedGoals: number;
  totalFlashcards: number;
  studyStreak: number;
}

// --- VISUAL HELPERS ---

const SpotlightCard = ({ children, className = "", glowColor = "rgba(120, 119, 198, 0.1)" }: any) => {
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
        "relative overflow-hidden rounded-3xl border bg-background/50 backdrop-blur-xl transition-all duration-500 shadow-2xl",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 hidden md:block z-0"
        style={{ opacity, background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${glowColor}, transparent 40%)` }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};

// --- MAIN PAGE ---

export default function Leaderboard() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overall");

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        const leaderboardData: LeaderboardUser[] = [];

        // Parallel processing of all users for real-time calculation
        const userStatsPromises = usersSnap.docs.map(async (userDoc) => {
          const userData = userDoc.data();
          const uid = userDoc.id;

          // Fetch real data from subcollections
          const [playlistsSnap, goalsSnap, flashcardsSnap, logsSnap] = await Promise.all([
            getDocs(collection(db, "users", uid, "playlists")),
            getDocs(collection(db, "users", uid, "goals")),
            getDocs(collection(db, "users", uid, "flashcardDecks")),
            getDocs(collection(db, "users", uid, "study_logs"))
          ]);

          // Calculate real watched lectures and time
          let watchedLectures = 0;
          let totalMinutes = 0;
          playlistsSnap.forEach(p => {
            const lectures = p.data().lectures || [];
            watchedLectures += lectures.filter((l: any) => l.completed).length;
            totalMinutes += lectures.reduce((acc: number, l: any) => acc + (l.watchTime || 0), 0);
          });

          // Calculate real completed goals
          const completedGoals = goalsSnap.docs.filter(g => {
            const sg = g.data().subGoals || [];
            return sg.length > 0 && sg.every((s: any) => s.completed);
          }).length;

          // Total real flashcards
          let totalFlashcards = 0;
          flashcardsSnap.forEach(d => totalFlashcards += (d.data().cards || []).length);

          // Real Streak Calculation (No Randomness)
          const activityDates = new Set(logsSnap.docs.map(doc => {
            const date = doc.data().createdAt?.toDate();
            return date ? date.toDateString() : null;
          }).filter(Boolean));

          let streak = 0;
          const today = new Date();
          for (let i = 0; i < 365; i++) {
            const checkDate = new Date();
            checkDate.setDate(today.getDate() - i);
            if (activityDates.has(checkDate.toDateString())) streak++;
            else if (i > 0) break; 
          }

          // Scoring logic
          const score = (watchedLectures * 15) + (Math.floor(totalMinutes / 10) * 2) + 
                        (completedGoals * 100) + (totalFlashcards * 5) + (streak * 20);

          return {
            uid,
            name: userData.name || userData.email?.split("@")[0] || "Scholar",
            email: userData.email || "",
            photoURL: userData.photoURL || null,
            score,
            watchedLectures,
            totalMinutes,
            completedGoals,
            totalFlashcards,
            studyStreak: streak
          };
        });

        const results = await Promise.all(userStatsPromises);
        setUsers(results.sort((a, b) => b.score - a.score));
        setLoading(false);
      } catch (error) {
        console.error("Leaderboard Error:", error);
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const getSortedUsers = () => {
    switch (activeTab) {
      case "lectures": return [...users].sort((a, b) => b.watchedLectures - a.watchedLectures);
      case "time": return [...users].sort((a, b) => b.totalMinutes - a.totalMinutes);
      case "goals": return [...users].sort((a, b) => b.completedGoals - a.completedGoals);
      case "streak": return [...users].sort((a, b) => b.studyStreak - a.studyStreak);
      default: return users;
    }
  };

  const sortedList = getSortedUsers();
  const topThree = sortedList.slice(0, 3);
  const currentUserRank = sortedList.findIndex(u => u.uid === user?.uid) + 1;
  const currentUsersData = sortedList.find(u => u.uid === user?.uid);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground animate-pulse font-medium tracking-widest uppercase text-xs">Synchronizing Ranks</p>
      </div>
    </div>
  );

  return (
    <div className={cn("container mx-auto px-4 pb-24 animate-in fade-in duration-1000", 
      theme === "dark" ? "text-white" : "text-zinc-900"
    )}>
      
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6 pt-6 sm:pt-10 mb-12 sm:mb-16">
        <div className="flex items-center gap-4 sm:gap-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full h-10 w-10 sm:h-12 sm:w-12 hover:bg-primary/10">
            <ArrowLeft className="h-4 w-4 sm:h-6 sm:w-6" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter flex items-center gap-2 sm:gap-4 italic">
              <Trophy className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" /> Hall of Fame
            </h1>
            <p className="text-muted-foreground font-medium tracking-wide uppercase text-[10px] sm:text-xs">The top 1% of global scholars</p>
          </div>
        </div>
      </header>

      {/* PODIUM SECTION - BUTTERMAX TIER */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mb-12 sm:mb-16 items-end">
        {/* 2nd Place */}
        {topThree[1] && (
          <SpotlightCard className="p-6 sm:p-8 md:p-10 flex flex-col items-center order-2 md:order-1 h-fit border-slate-400/30" glowColor="rgba(148, 163, 184, 0.15)">
             <div className="relative mb-4 sm:mb-6">
                <Avatar className="h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 border-3 sm:border-4 border-slate-400 ring-[8px] sm:ring-[12px] ring-slate-400/5">
                   <AvatarImage src={topThree[1].photoURL || ""} />
                   <AvatarFallback className="text-lg sm:text-xl md:text-2xl font-bold">{topThree[1].name[0]}</AvatarFallback>
                </Avatar>
                <Badge className="absolute -bottom-1 sm:-bottom-2 left-1/2 -translate-x-1/2 bg-slate-400 text-white border-none px-3 sm:px-4 py-0.5 sm:py-1 font-black text-xs sm:text-sm">#2</Badge>
             </div>
             <h3 className="text-lg sm:text-xl md:text-2xl font-black truncate w-full text-center">{topThree[1].name}</h3>
             <p className="text-slate-400 font-mono text-xs sm:text-sm mb-4 sm:mb-6">{topThree[1].score.toLocaleString()} PTS</p>
             <div className="flex gap-3 sm:gap-4 w-full border-t border-slate-400/10 pt-4 sm:pt-6">
                <div className="flex-1 text-center"><p className="text-[9px] sm:text-[10px] uppercase text-muted-foreground font-bold">Streak</p><p className="font-black text-sm sm:text-base">{topThree[1].studyStreak}d</p></div>
                <div className="flex-1 text-center"><p className="text-[9px] sm:text-[10px] uppercase text-muted-foreground font-bold">Videos</p><p className="font-black text-sm sm:text-base">{topThree[1].watchedLectures}</p></div>
             </div>
          </SpotlightCard>
        )}

        {/* 1st Place - The Crown Jewel */}
        {topThree[0] && (
          <SpotlightCard className="p-8 sm:p-10 md:p-12 flex flex-col items-center order-1 md:order-2 ring-4 ring-yellow-500/20 scale-110 z-20 border-yellow-500/50" glowColor="rgba(234, 179, 8, 0.3)">
             <div className="relative mb-6 sm:mb-8">
                <Crown className="h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 text-yellow-500 absolute -top-8 sm:-top-10 md:-top-12 left-1/2 -translate-x-1/2 drop-shadow-[0_0_10px_rgba(234,179,8,0.8)] animate-bounce" />
                <Avatar className="h-28 w-28 sm:h-32 sm:w-32 md:h-40 md:w-40 border-[4px] sm:border-[5px] md:border-[6px] border-yellow-500 ring-[12px] sm:ring-[16px] md:ring-[20px] ring-yellow-500/5 shadow-[0_0_50px_rgba(234,179,8,0.2)]">
                   <AvatarImage src={topThree[0].photoURL || ""} />
                   <AvatarFallback className="text-2xl sm:text-3xl md:text-4xl font-bold">{topThree[0].name[0]}</AvatarFallback>
                </Avatar>
                <Badge className="absolute -bottom-2 sm:-bottom-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black border-none px-4 sm:px-5 md:px-6 py-1 sm:py-1.5 font-black text-sm sm:text-base md:text-lg italic shadow-xl">CHAMPION</Badge>
             </div>
             <h2 className="text-2xl sm:text-3xl md:text-4xl font-black truncate w-full text-center tracking-tighter mb-2">{topThree[0].name}</h2>
             <p className="text-yellow-500 font-black text-lg sm:text-xl md:text-2xl tracking-tighter italic">{topThree[0].score.toLocaleString()} <span className="text-[10px] sm:text-xs uppercase font-bold not-italic text-muted-foreground ml-1">Points</span></p>
             <div className="flex gap-4 sm:gap-5 md:gap-6 w-full border-t border-yellow-500/10 mt-6 sm:mt-7 md:mt-8 pt-6 sm:pt-7 md:pt-8">
                <div className="flex-1 text-center"><p className="text-[9px] sm:text-[10px] uppercase text-muted-foreground font-bold">Level</p><p className="text-lg sm:text-xl font-black italic">{Math.floor(topThree[0].score / 500) + 1}</p></div>
                <div className="flex-1 text-center"><p className="text-[9px] sm:text-[10px] uppercase text-muted-foreground font-bold">Goals</p><p className="text-lg sm:text-xl font-black italic">{topThree[0].completedGoals}</p></div>
             </div>
          </SpotlightCard>
        )}

        {/* 3rd Place */}
        {topThree[2] && (
          <SpotlightCard className="p-6 sm:p-8 md:p-10 flex flex-col items-center order-3 h-fit border-amber-700/30" glowColor="rgba(180, 83, 9, 0.15)">
             <div className="relative mb-4 sm:mb-6">
                <Avatar className="h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 border-3 sm:border-4 border-amber-700 ring-[8px] sm:ring-[12px] ring-amber-700/5">
                   <AvatarImage src={topThree[2].photoURL || ""} />
                   <AvatarFallback className="text-lg sm:text-xl md:text-2xl font-bold">{topThree[2].name[0]}</AvatarFallback>
                </Avatar>
                <Badge className="absolute -bottom-1 sm:-bottom-2 left-1/2 -translate-x-1/2 bg-amber-700 text-white border-none px-3 sm:px-4 py-0.5 sm:py-1 font-black text-xs sm:text-sm">#3</Badge>
             </div>
             <h3 className="text-lg sm:text-xl md:text-2xl font-black truncate w-full text-center">{topThree[2].name}</h3>
             <p className="text-amber-700 font-mono text-xs sm:text-sm mb-4 sm:mb-6">{topThree[2].score.toLocaleString()} PTS</p>
             <div className="flex gap-3 sm:gap-4 w-full border-t border-amber-700/10 pt-4 sm:pt-6">
                <div className="flex-1 text-center"><p className="text-[9px] sm:text-[10px] uppercase text-muted-foreground font-bold">Streak</p><p className="font-black text-sm sm:text-base">{topThree[2].studyStreak}d</p></div>
                <div className="flex-1 text-center"><p className="text-[9px] sm:text-[10px] uppercase text-muted-foreground font-bold">Cards</p><p className="font-black text-sm sm:text-base">{topThree[2].totalFlashcards}</p></div>
             </div>
          </SpotlightCard>
        )}
      </div>

      {/* FILTER TABS */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8 sm:space-y-10">
        <TabsList className="bg-muted/30 p-1 sm:p-1.5 rounded-full h-12 sm:h-14 md:h-16 w-full max-w-3xl mx-auto flex shadow-2xl border border-white/5 backdrop-blur-3xl">
          {[
            { id: "overall", label: "Global Score", icon: Zap },
            { id: "lectures", label: "Video Count", icon: BookOpen },
            { id: "time", label: "Study Hours", icon: Clock },
            { id: "streak", label: "Day Streaks", icon: Flame }
          ].map(t => (
            <TabsTrigger 
              key={t.id} 
              value={t.id} 
              className="flex-1 rounded-full gap-2 sm:gap-3 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] transition-all font-bold text-xs sm:text-sm tracking-tight px-2 sm:px-3"
            >
              <t.icon className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden lg:inline">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <SpotlightCard className="max-w-5xl mx-auto p-0 border-none bg-background/20 rounded-[2rem] sm:rounded-[3rem]" noHover>
          <div className="divide-y divide-white/5">
            {sortedList.map((u, index) => {
              const isMe = u.uid === user?.uid;
              const valueDisplay = 
                activeTab === "lectures" ? `${u.watchedLectures} Videos` :
                activeTab === "time" ? `${Math.floor(u.totalMinutes / 60)}h ${u.totalMinutes % 60}m` :
                activeTab === "streak" ? `${u.studyStreak} Day Streak` :
                `${u.score.toLocaleString()} Points`;

              return (
                <div key={u.uid} className={cn("flex items-center gap-3 sm:gap-4 md:gap-6 p-4 sm:p-5 md:p-6 transition-all hover:bg-white/5 group", isMe && "bg-primary/10")}>
                  <div className="w-10 sm:w-12 md:w-14 text-center font-black text-xl sm:text-2xl md:text-3xl italic text-muted-foreground/20 group-hover:text-primary transition-colors">{index + 1}</div>
                  <Avatar className="h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 border-2 border-white/10 ring-2 sm:ring-3 md:ring-4 ring-black/10">
                    <AvatarImage src={u.photoURL || ""} />
                    <AvatarFallback className="font-black text-sm sm:text-base">{u.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <p className="font-black text-base sm:text-lg md:text-xl truncate tracking-tight">{u.name}</p>
                      {isMe && <Badge className="bg-primary text-white font-black italic scale-90 text-xs">YOU</Badge>}
                    </div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate uppercase tracking-widest">{u.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-lg sm:text-xl md:text-2xl text-primary tracking-tighter italic">{valueDisplay}</p>
                    <div className="flex items-center justify-end gap-1 sm:gap-2 opacity-30 group-hover:opacity-100 transition-opacity">
                       <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 fill-yellow-500 text-yellow-500" />
                       <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-tighter">LVL {Math.floor(u.score / 500) + 1}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SpotlightCard>
      </Tabs>

      {/* FIXED BUTTERMAX STATUS BAR */}
      {currentUsersData && currentUserRank > 3 && (
        <div className="fixed bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xs sm:max-w-sm md:max-w-xl px-4 sm:px-6 animate-in slide-in-from-bottom-12 duration-1000">
          <div className="bg-primary p-3 sm:p-4 md:p-5 rounded-[1.5rem] sm:rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex items-center justify-between text-white ring-1 ring-white/20 backdrop-blur-xl">
            <div className="flex items-center gap-3 sm:gap-4 md:gap-5">
              <div className="h-9 w-9 sm:h-10 sm:w-10 md:h-12 md:w-12 rounded-full bg-white/20 flex items-center justify-center font-black text-base sm:text-lg md:text-xl italic shadow-inner ring-1 ring-white/30">#{currentUserRank}</div>
              <div>
                <p className="text-[8px] sm:text-[9px] md:text-[10px] uppercase font-black tracking-[0.2em] text-white/60">Current Standing</p>
                <p className="font-black text-lg sm:text-xl md:text-2xl leading-none italic tracking-tighter">{currentUsersData.score.toLocaleString()} Total Points</p>
              </div>
            </div>
            <Button variant="secondary" size="icon" className="rounded-xl sm:rounded-2xl h-9 w-9 sm:h-10 sm:w-10 md:h-12 md:w-12 bg-white text-primary hover:bg-white/90 shadow-xl scale-105 sm:scale-110" onClick={() => navigate('/profile')}>
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}