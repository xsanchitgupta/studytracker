import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
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
  ArrowLeft, Trophy, Medal, Award, Crown, TrendingUp, 
  Flame, Clock, Target, BookOpen, Brain, Zap
} from "lucide-react";

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
        // Get all users
        const usersSnap = await getDocs(collection(db, "users"));
        const leaderboardData: LeaderboardUser[] = [];

        for (const userDoc of usersSnap.docs) {
          const userData = userDoc.data();
          const uid = userDoc.id;

          // Calculate stats
          const playlistsSnap = await getDocs(collection(db, "users", uid, "playlists"));
          let watchedLectures = 0;
          let totalMinutes = 0;
          
          playlistsSnap.forEach(p => {
            const lectures = p.data().lectures || [];
            watchedLectures += lectures.filter((l: any) => l.completed).length;
            totalMinutes += lectures.reduce((acc: number, l: any) => acc + (l.watchTime || 0), 0);
          });

          const goalsSnap = await getDocs(collection(db, "users", uid, "goals"));
          const completedGoals = goalsSnap.docs.filter(g => {
            const sg = g.data().subGoals || [];
            return sg.length > 0 && sg.every((s: any) => s.completed);
          }).length;

          const flashcardsSnap = await getDocs(collection(db, "users", uid, "flashcardDecks"));
          let totalFlashcards = 0;
          flashcardsSnap.forEach(d => {
            totalFlashcards += (d.data().cards || []).length;
          });

          // Calculate study streak (simplified)
          const studyStreak = Math.floor(Math.random() * 30); // Mock - replace with real calculation

          // Calculate overall score
          const score = 
            watchedLectures * 10 +
            Math.floor(totalMinutes / 60) * 5 +
            completedGoals * 50 +
            totalFlashcards * 2 +
            studyStreak * 3;

          leaderboardData.push({
            uid,
            name: userData.name || userData.email?.split("@")[0] || "User",
            email: userData.email || "",
            photoURL: userData.photoURL || null,
            score,
            watchedLectures,
            totalMinutes,
            completedGoals,
            totalFlashcards,
            studyStreak
          });
        }

        // Sort by score
        leaderboardData.sort((a, b) => b.score - a.score);
        setUsers(leaderboardData);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-6 w-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-6 w-6 text-gray-400" />;
    if (rank === 3) return <Medal className="h-6 w-6 text-amber-600" />;
    return <span className="text-muted-foreground font-bold">#{rank}</span>;
  };

  const getSortedUsers = () => {
    switch (activeTab) {
      case "lectures":
        return [...users].sort((a, b) => b.watchedLectures - a.watchedLectures);
      case "time":
        return [...users].sort((a, b) => b.totalMinutes - a.totalMinutes);
      case "goals":
        return [...users].sort((a, b) => b.completedGoals - a.completedGoals);
      case "streak":
        return [...users].sort((a, b) => b.studyStreak - a.studyStreak);
      default:
        return users;
    }
  };

  const currentUserRank = users.findIndex(u => u.uid === user?.uid) + 1;

  if (loading) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center",
        theme === "dark" ? "bg-background" : "bg-background"
      )}>
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

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
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-2xl font-bold", theme === "dark" ? "text-white" : "text-foreground")}>
                  Leaderboard
                </h1>
                <p className="text-xs text-muted-foreground">Compete with other learners</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
        {/* Current User Rank */}
        {user && currentUserRank > 0 && (
          <Card className={cn("overflow-hidden border backdrop-blur-xl transition-all duration-300 animate-in slide-in-from-top-4",
            theme === "dark" 
              ? "bg-gradient-to-br from-primary/10 via-background/80 to-background border-white/10 shadow-2xl" 
              : "bg-gradient-to-br from-primary/5 via-background to-background border-border shadow-lg"
          )}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn("p-4 rounded-2xl",
                    theme === "dark" ? "bg-primary/20" : "bg-primary/10"
                  )}>
                    <Trophy className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className={cn("text-2xl font-bold", theme === "dark" ? "text-white" : "text-foreground")}>
                        Your Rank: #{currentUserRank}
                      </h2>
                      {currentUserRank <= 3 && (
                        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                          <Crown className="h-3 w-3 mr-1" />
                          Top 3
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground">
                      {users[currentUserRank - 1]?.score.toLocaleString()} points
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground mb-1">Score</div>
                  <div className={cn("text-3xl font-bold", theme === "dark" ? "text-white" : "text-foreground")}>
                    {users[currentUserRank - 1]?.score.toLocaleString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={cn("grid w-full grid-cols-5",
            theme === "dark" ? "bg-background/40" : "bg-background/60"
          )}>
            <TabsTrigger value="overall" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" /> Overall
            </TabsTrigger>
            <TabsTrigger value="lectures" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Lectures
            </TabsTrigger>
            <TabsTrigger value="time" className="flex items-center gap-2">
              <Clock className="h-4 w-4" /> Study Time
            </TabsTrigger>
            <TabsTrigger value="goals" className="flex items-center gap-2">
              <Target className="h-4 w-4" /> Goals
            </TabsTrigger>
            <TabsTrigger value="streak" className="flex items-center gap-2">
              <Flame className="h-4 w-4" /> Streak
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4">
            <Card className={cn("backdrop-blur-xl border",
              theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
            )}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Top Learners
                </CardTitle>
                <CardDescription>
                  {activeTab === "overall" && "Ranked by overall score"}
                  {activeTab === "lectures" && "Most lectures watched"}
                  {activeTab === "time" && "Most study time"}
                  {activeTab === "goals" && "Most goals completed"}
                  {activeTab === "streak" && "Longest study streak"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {getSortedUsers().slice(0, 20).map((u, index) => {
                    const rank = index + 1;
                    const isCurrentUser = u.uid === user?.uid;
                    const value = 
                      activeTab === "lectures" ? u.watchedLectures :
                      activeTab === "time" ? `${Math.floor(u.totalMinutes / 60)}h ${u.totalMinutes % 60}m` :
                      activeTab === "goals" ? u.completedGoals :
                      activeTab === "streak" ? `${u.studyStreak} days` :
                      u.score.toLocaleString();

                    return (
                      <div
                        key={u.uid}
                        className={cn("flex items-center gap-4 p-4 rounded-lg border transition-all hover:scale-[1.01]",
                          theme === "dark" 
                            ? isCurrentUser 
                              ? "bg-primary/20 border-primary/30 ring-2 ring-primary/20" 
                              : "bg-white/5 border-white/10"
                            : isCurrentUser
                            ? "bg-primary/10 border-primary/20 ring-2 ring-primary/10"
                            : "bg-muted/30 border-border",
                          `animate-in fade-in slide-in-from-left-${Math.min(rank, 5)}`
                        )}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex items-center justify-center w-12 h-12 shrink-0">
                          {getRankIcon(rank)}
                        </div>
                        <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                          <AvatarImage src={u.photoURL || ""} />
                          <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                            {u.name[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className={cn("font-bold truncate", theme === "dark" ? "text-white" : "text-foreground")}>
                              {u.name}
                            </p>
                            {isCurrentUser && (
                              <Badge className="bg-primary/20 text-primary border-primary/30">
                                You
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={cn("text-lg font-bold", theme === "dark" ? "text-white" : "text-foreground")}>
                            {value}
                          </div>
                          {activeTab === "overall" && (
                            <div className="text-xs text-muted-foreground">points</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}