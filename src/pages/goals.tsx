import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, deleteDoc, updateDoc, doc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, isPast } from "date-fns";

import {
  ArrowLeft,
  BookOpen,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Bell,
  Settings,
  Target,
  Calendar,
  Link as LinkIcon,
  AlertCircle,
  TrendingUp,
  Clock,
  AlertTriangle,
  Sparkles,
  Zap
} from "lucide-react";

type SubGoal = {
  id: string;
  title: string;
  completed: boolean;
};

type Goal = {
  id: string;
  title: string;
  subGoals: SubGoal[];
  deadline?: number; // timestamp
  linkedPlaylistId?: string;
};

type PlaylistInfo = {
  id: string;
  title: string;
};

export default function Goals() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistInfo[]>([]);
  
  // Form State
  const [newGoal, setNewGoal] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>("");
  const [subGoalInput, setSubGoalInput] = useState<Record<string, string>>({});
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    const loadData = async () => {
      try {
        // Load Goals
        const goalsSnap = await getDocs(collection(db, "users", user.uid, "goals"));
        const goalsData: Goal[] = goalsSnap.docs.map((d) => {
          try {
            return {
              id: d.id,
              ...(d.data() as Omit<Goal, "id">),
            };
          } catch (err) {
            console.error("Error parsing goal:", err);
            return null;
          }
        }).filter((g): g is Goal => g !== null);
        
        if (isMounted) {
          setGoals(goalsData);
        }

        // Load Playlists for linking
        try {
          const plSnap = await getDocs(collection(db, "users", user.uid, "playlists"));
          if (isMounted) {
            setPlaylists(plSnap.docs.map(d => {
              try {
                const data = d.data();
                return { id: d.id, title: data.title || "Untitled" };
              } catch (err) {
                console.error("Error parsing playlist:", err);
                return { id: d.id, title: "Untitled" };
              }
            }));
          }
        } catch (playlistError) {
          console.error("Error loading playlists:", playlistError);
        }
      } catch (error) {
        console.error("Error loading goals data:", error);
        toast.error("Failed to load goals");
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // ---------- ACTIONS ----------
  const addGoal = async () => {
    if (!newGoal.trim() || !user) {
      toast.error("Please enter a goal title");
      return;
    }

    try {
      const goalData = {
        title: newGoal,
        subGoals: [],
        deadline: selectedDate ? selectedDate.getTime() : null,
        linkedPlaylistId: selectedPlaylist || null,
        createdAt: Date.now()
      };

      const ref = await addDoc(collection(db, "users", user.uid, "goals"), goalData);

      setGoals((g) => [...g, { id: ref.id, ...goalData } as Goal]);
      setNewGoal("");
      setSelectedDate(undefined);
      setSelectedPlaylist("");
      toast.success("Goal created successfully!");
    } catch (error) {
      console.error("Error creating goal:", error);
      toast.error("Failed to create goal");
    }
  };

  const deleteGoal = async (goalId: string) => {
    if (!user) return;
    if (!confirm("Are you sure you want to delete this goal?")) return;
    
    try {
      await deleteDoc(doc(db, "users", user.uid, "goals", goalId));
      setGoals((g) => g.filter((x) => x.id !== goalId));
      toast.success("Goal deleted");
    } catch (error) {
      console.error("Error deleting goal:", error);
      toast.error("Failed to delete goal");
    }
  };

  const addSubGoal = async (goalId: string) => {
    const title = subGoalInput[goalId];
    if (!title || !user) return;

    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;

    const updated = [...goal.subGoals, { id: crypto.randomUUID(), title, completed: false }];

    await updateDoc(doc(db, "users", user.uid, "goals", goalId), {
      subGoals: updated,
    });

    setGoals((g) => g.map((x) => (x.id === goalId ? { ...x, subGoals: updated } : x)));
    setSubGoalInput((p) => ({ ...p, [goalId]: "" }));
  };

  const toggleSubGoal = async (goalId: string, subId: string) => {
    const goal = goals.find((g) => g.id === goalId);
    if (!goal || !user) return;

    const updated = goal.subGoals.map((s) =>
      s.id === subId ? { ...s, completed: !s.completed } : s
    );

    await updateDoc(doc(db, "users", user.uid, "goals", goalId), {
      subGoals: updated,
    });

    setGoals((g) => g.map((x) => (x.id === goalId ? { ...x, subGoals: updated } : x)));
  };

  const progress = (subs: SubGoal[]) =>
    subs.length === 0 ? 0 : Math.round((subs.filter((s) => s.completed).length / subs.length) * 100);

  const isOverdue = (timestamp?: number) => {
    if (!timestamp) return false;
    return Date.now() > timestamp;
  };

  const stats = useMemo(() => {
    const total = goals.length;
    const completed = goals.filter(g => {
      const prog = progress(g.subGoals);
      return prog === 100;
    }).length;
    const overdue = goals.filter(g => !progress(g.subGoals) && isOverdue(g.deadline)).length;
    const inProgress = total - completed - overdue;
    const avgProgress = total > 0 
      ? Math.round(goals.reduce((acc, g) => acc + progress(g.subGoals), 0) / total)
      : 0;
    
    return { total, completed, overdue, inProgress, avgProgress };
  }, [goals]);

  const toggleExpand = (goalId: string) => {
    setExpandedGoals(prev => {
      const next = new Set(prev);
      if (next.has(goalId)) {
        next.delete(goalId);
      } else {
        next.add(goalId);
      }
      return next;
    });
  };

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
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-xl transition-all duration-300",
                theme === "dark" ? "bg-primary/20" : "bg-primary/10"
              )}>
                <Target className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-2xl font-bold", theme === "dark" ? "text-white" : "text-foreground")}>Study Goals</h1>
                <p className="text-xs text-muted-foreground">Track your academic progress</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Avatar className="h-9 w-9 ring-2 ring-primary/20 hover:ring-primary/40 transition-all">
              <AvatarImage src={user?.photoURL || ""} />
              <AvatarFallback className="bg-primary text-primary-foreground font-bold">{user?.email?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard icon={Target} label="Total Goals" value={stats.total} color="from-blue-500 to-cyan-500" />
          <StatCard icon={CheckCircle2} label="Completed" value={stats.completed} color="from-green-500 to-emerald-500" />
          <StatCard icon={Clock} label="In Progress" value={stats.inProgress} color="from-yellow-500 to-orange-500" />
          <StatCard icon={AlertTriangle} label="Overdue" value={stats.overdue} color="from-red-500 to-rose-500" />
          <StatCard icon={TrendingUp} label="Avg Progress" value={`${stats.avgProgress}%`} color="from-purple-500 to-pink-500" />
        </div>

        {/* Hero Card */}
        <Card className={cn("overflow-hidden border backdrop-blur-xl transition-all duration-300 animate-in slide-in-from-top-4",
          theme === "dark" 
            ? "bg-gradient-to-br from-green-500/10 via-background/80 to-background border-white/10 shadow-2xl" 
            : "bg-gradient-to-br from-green-500/5 via-background to-background border-border shadow-lg"
        )}>
          <CardContent className="p-8">
            <div className="flex items-center gap-4 mb-4">
              <div className={cn("p-4 rounded-2xl",
                theme === "dark" ? "bg-green-500/20" : "bg-green-500/10"
              )}>
                <Target className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <CardTitle className={cn("text-3xl mb-1", theme === "dark" ? "text-white" : "text-foreground")}>
                  Goals & Milestones
                </CardTitle>
                <CardDescription className="text-base">Set ambitious targets and track your academic journey</CardDescription>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CREATE GOAL */}
        <Card className={cn("border-2 border-dashed backdrop-blur-xl transition-all duration-300 hover:shadow-lg",
          theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
        )}>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl">Create New Goal</CardTitle>
            </div>
            <div className="flex flex-col md:flex-row gap-3">
              <Input
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                placeholder="New Goal Title (e.g. Master Calculus)"
                className="flex-[2]"
                onKeyDown={(e) => e.key === "Enter" && addGoal()}
              />
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}>
                    <Calendar className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : "Pick Deadline"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus />
                </PopoverContent>
              </Popover>

              <Select value={selectedPlaylist} onValueChange={setSelectedPlaylist}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Link Playlist" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Playlist</SelectItem>
                  {playlists.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addGoal} className="w-full md:w-auto bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90">
              <Plus className="h-4 w-4 mr-2" /> Create Goal
            </Button>
          </CardContent>
        </Card>

        {/* GOALS LIST */}
        <div className="grid gap-6">
          {goals.length === 0 && (
            <Card className={cn("backdrop-blur-xl border text-center py-16",
              theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
            )}>
              <CardContent>
                <Target className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground text-lg mb-4">No goals set yet.</p>
                <p className="text-sm text-muted-foreground">Create your first goal to start tracking your progress!</p>
              </CardContent>
            </Card>
          )}
          
          {goals.map((g, index) => {
            const prog = progress(g.subGoals);
            const overdue = prog < 100 && isOverdue(g.deadline);
            const isExpanded = expandedGoals.has(g.id);
            const daysLeft = g.deadline ? Math.ceil((g.deadline - Date.now()) / (1000 * 60 * 60 * 24)) : null;
            
            return (
              <Card 
                key={g.id} 
                className={cn("backdrop-blur-xl border transition-all duration-300 hover:shadow-xl hover:scale-[1.01] overflow-hidden",
                  theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border",
                  overdue && (theme === "dark" ? "border-red-500/30 bg-red-500/10" : "border-red-300 bg-red-50/50"),
                  `animate-in fade-in slide-in-from-bottom-${Math.min(index + 1, 5)}`
                )}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className={cn("text-xl truncate", theme === "dark" ? "text-white" : "text-foreground")}>
                          {g.title}
                        </CardTitle>
                        {prog === 100 && (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Completed
                          </Badge>
                        )}
                        {overdue && (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Overdue
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 mt-2">
                        {g.deadline && (
                          <span className={cn("text-xs flex items-center gap-1.5",
                            overdue ? "text-red-500 font-bold" : daysLeft && daysLeft <= 3 ? "text-orange-500" : "text-muted-foreground"
                          )}>
                            <Calendar className="h-3 w-3" />
                            {overdue ? "Overdue: " : daysLeft !== null && daysLeft < 0 ? "Past due: " : "Due: "}
                            {format(g.deadline, "MMM d, yyyy")}
                            {daysLeft !== null && daysLeft > 0 && !overdue && ` (${daysLeft} days left)`}
                          </span>
                        )}
                        {g.linkedPlaylistId && (
                          <div 
                            className="text-xs text-blue-500 flex items-center cursor-pointer hover:underline transition-colors"
                            onClick={() => navigate("/playlists")}
                          >
                            <LinkIcon className="h-3 w-3 mr-1" /> Linked to Playlist
                          </div>
                        )}
                      </div>
                      <div className="mt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-bold text-primary">{prog}%</span>
                        </div>
                        <Progress 
                          value={prog} 
                          className={cn("h-3",
                            prog === 100 ? "bg-green-500" : overdue ? "bg-red-500/20" : ""
                          )} 
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => toggleExpand(g.id)}
                        className="rounded-full"
                      >
                        {isExpanded ? <Zap className="h-4 w-4" /> : <Zap className="h-4 w-4 rotate-90" />}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => deleteGoal(g.id)}
                        className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {(isExpanded || g.subGoals.length > 0) && (
                  <CardContent className="space-y-3 pt-0">
                    {g.subGoals.length > 0 && (
                      <div className={cn("space-y-2 p-4 rounded-lg border",
                        theme === "dark" ? "bg-white/5 border-white/10" : "bg-muted/30 border-border"
                      )}>
                        {g.subGoals.map((s) => (
                          <div 
                            key={s.id} 
                            className="flex items-center gap-3 group p-2 rounded-md hover:bg-white/5 transition-colors"
                          >
                            <div 
                              onClick={() => toggleSubGoal(g.id, s.id)} 
                              className="cursor-pointer transition-transform active:scale-90 hover:scale-110"
                            >
                              {s.completed ? (
                                <CheckCircle2 className="text-green-500 h-5 w-5" />
                              ) : (
                                <Circle className="text-muted-foreground h-5 w-5 group-hover:text-primary transition-colors" />
                              )}
                            </div>
                            <span className={cn("flex-1 transition-all",
                              s.completed ? "line-through text-muted-foreground" : theme === "dark" ? "text-white" : "text-foreground"
                            )}>
                              {s.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Input
                        value={subGoalInput[g.id] || ""}
                        onChange={(e) => setSubGoalInput((p) => ({ ...p, [g.id]: e.target.value }))}
                        placeholder="Add sub-task..."
                        className="h-9 text-sm"
                        onKeyDown={(e) => e.key === "Enter" && addSubGoal(g.id)}
                      />
                      <Button 
                        size="sm" 
                        onClick={() => addSubGoal(g.id)} 
                        className="bg-primary hover:bg-primary/90"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
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
            <p className={cn("text-xl font-bold truncate", theme === "dark" ? "text-white" : "text-foreground")}>
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