import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, deleteDoc, updateDoc, doc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

import {
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Target,
  Calendar,
  Link as LinkIcon,
  AlertTriangle,
  TrendingUp,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  LayoutList,
  MoreHorizontal
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// --- TYPES ---
type SubGoal = { id: string; title: string; completed: boolean };
type Goal = { id: string; title: string; subGoals: SubGoal[]; deadline?: number; linkedPlaylistId?: string; createdAt?: number };
type PlaylistInfo = { id: string; title: string };

// --- COMPONENTS ---

const SpotlightCard = ({ children, className = "", onClick, glowColor = "rgba(120, 119, 198, 0.1)" }: any) => {
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
        onClick && "cursor-pointer active:scale-[0.98] md:hover:scale-[1.01]",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 hidden md:block z-0"
        style={{ opacity, background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${glowColor}, transparent 40%)` }}
      />
      <div className="absolute inset-0 md:hidden pointer-events-none z-0 opacity-50"
        style={{ background: `radial-gradient(circle at 50% 0%, ${glowColor}, transparent 70%)` }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color, trend }: any) => (
  <SpotlightCard className="p-5 flex flex-col justify-between h-28 md:h-32 hover:border-primary/20 transition-colors">
    <div className="flex justify-between items-start">
      <div className={cn("p-2 rounded-xl bg-gradient-to-br shadow-inner", color)}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      {trend && (
        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-white/10 text-muted-foreground border border-white/5 backdrop-blur-sm">
          {trend}
        </span>
      )}
    </div>
    <div>
      <p className="text-2xl font-bold tracking-tight truncate">{value}</p>
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
    </div>
  </SpotlightCard>
);

// --- MAIN PAGE ---

export default function Goals() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistInfo[]>([]);
  
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
        const goalsSnap = await getDocs(collection(db, "users", user.uid, "goals"));
        const goalsData = goalsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Goal));
        goalsData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        
        if (isMounted) setGoals(goalsData);

        const plSnap = await getDocs(collection(db, "users", user.uid, "playlists"));
        if (isMounted) setPlaylists(plSnap.docs.map(d => ({ id: d.id, title: d.data().title || "Untitled" })));
      } catch (error) { console.error(error); }
    };
    loadData();
    return () => { isMounted = false; };
  }, [user]);

  const addGoal = async () => {
    if (!newGoal.trim() || !user) {
      toast.error("Please enter a goal title");
      return;
    }
    try {
      const goalData = {
        title: newGoal,
        subGoals: [],
        deadline: selectedDate ? selectedDate.setHours(23, 59, 59, 999) : null,
        linkedPlaylistId: selectedPlaylist || null,
        createdAt: Date.now()
      };
      const ref = await addDoc(collection(db, "users", user.uid, "goals"), goalData);
      setGoals(g => [{ id: ref.id, ...goalData } as Goal, ...g]);
      setNewGoal(""); setSelectedDate(undefined); setSelectedPlaylist("");
      toast.success("Goal created");
    } catch (error) { toast.error("Failed to create goal"); }
  };

  const deleteGoal = async (goalId: string) => {
    try {
      await deleteDoc(doc(db, "users", user.uid, "goals", goalId));
      setGoals(g => g.filter(x => x.id !== goalId));
      toast.success("Deleted");
    } catch (error) { toast.error("Failed to delete"); }
  };

  const addSubGoal = async (goalId: string) => {
    const title = subGoalInput[goalId];
    if (!title || !user) return;
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    const updated = [...goal.subGoals, { id: crypto.randomUUID(), title, completed: false }];
    await updateDoc(doc(db, "users", user.uid, "goals", goalId), { subGoals: updated });
    setGoals(g => g.map(x => x.id === goalId ? { ...x, subGoals: updated } : x));
    setSubGoalInput(p => ({ ...p, [goalId]: "" }));
  };

  const toggleSubGoal = async (goalId: string, subId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    const updated = goal.subGoals.map(s => s.id === subId ? { ...s, completed: !s.completed } : s);
    await updateDoc(doc(db, "users", user.uid, "goals", goalId), { subGoals: updated });
    setGoals(g => g.map(x => x.id === goalId ? { ...x, subGoals: updated } : x));
  };

  const toggleExpand = (id: string) => {
    setExpandedGoals(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const calcProgress = (subs: SubGoal[]) => subs.length === 0 ? 0 : Math.round((subs.filter(s => s.completed).length / subs.length) * 100);
  const isOverdue = (ts?: number) => ts ? Date.now() > ts : false;

  const stats = useMemo(() => {
    const total = goals.length;
    const completed = goals.filter(g => calcProgress(g.subGoals) === 100 && g.subGoals.length > 0).length;
    const overdue = goals.filter(g => g.deadline && isOverdue(g.deadline) && calcProgress(g.subGoals) < 100).length;
    const avg = total > 0 ? Math.round(goals.reduce((acc, g) => acc + calcProgress(g.subGoals), 0) / total) : 0;
    return { total, completed, overdue, avg };
  }, [goals]);

  return (
    <div className={cn("container mx-auto px-4 pb-24 animate-in fade-in duration-700 space-y-8", 
      theme === "dark" ? "text-white" : "text-zinc-900"
    )}>
      
      {/* HEADER */}
      <section className="flex flex-col md:flex-row justify-between items-end gap-6 pt-4">
         <div className="space-y-2 w-full">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight flex items-center gap-3">
              <Target className="h-8 w-8 text-primary" />
              Mission Control
            </h1>
            <p className="text-muted-foreground text-base md:text-lg">Define your targets. Execute the plan.</p>
         </div>
      </section>

      {/* STATS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
         <StatCard icon={Target} label="Total" value={stats.total} color="from-blue-500 to-cyan-500" />
         <StatCard icon={CheckCircle2} label="Done" value={stats.completed} color="from-emerald-500 to-green-600" trend={`${stats.completed > 0 ? "+" : ""}${Math.round((stats.completed/Math.max(stats.total,1))*100)}%`} />
         <StatCard icon={AlertTriangle} label="Late" value={stats.overdue} color="from-red-500 to-pink-600" />
         <StatCard icon={TrendingUp} label="Rate" value={`${stats.avg}%`} color="from-violet-500 to-purple-600" />
      </div>

      {/* CREATE GOAL - FIXED LAYOUT */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-purple-600/50 rounded-[2rem] blur opacity-20 group-hover:opacity-40 transition duration-500" />
        <div className="relative bg-background/80 backdrop-blur-xl border border-white/10 rounded-[1.75rem] p-4 md:p-3 shadow-2xl">
           <div className="flex flex-col md:flex-row gap-3">
              
              {/* Input Area */}
              <div className="flex-1 flex items-center gap-3 px-2">
                  <Sparkles className="h-5 w-5 text-primary shrink-0 animate-pulse hidden md:block" />
                  <Input 
                      value={newGoal}
                      onChange={(e) => setNewGoal(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addGoal()}
                      placeholder="What is your next major milestone?" 
                      className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-lg placeholder:text-muted-foreground/50 h-10 p-0"
                  />
              </div>
              
              {/* Controls Area - Grid on Mobile, Flex on Desktop */}
              <div className="grid grid-cols-2 md:flex gap-2 w-full md:w-auto">
                  {/* Date Picker */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("rounded-xl h-12 md:h-10 border-border/50 bg-muted/20 md:bg-transparent hover:bg-muted/50 w-full md:w-auto justify-center", selectedDate && "text-primary border-primary/30 bg-primary/5")}>
                        <Calendar className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "MMM d") : "Date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <CalendarComponent mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus />
                    </PopoverContent>
                  </Popover>

                  {/* Playlist Select */}
                  <Select value={selectedPlaylist} onValueChange={setSelectedPlaylist}>
                    <SelectTrigger className="rounded-xl h-12 md:h-10 border-border/50 bg-muted/20 md:bg-transparent hover:bg-muted/50 w-full md:w-[140px] justify-between px-3 focus:ring-0">
                      <div className="flex items-center gap-2 truncate">
                         <LinkIcon className="h-4 w-4 opacity-50 shrink-0" />
                         <span className="truncate">{playlists.find(p => p.id === selectedPlaylist)?.title || "Link"}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Link</SelectItem>
                      {playlists.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  {/* Add Button - Full Width on Mobile Row 2 */}
                  <Button onClick={addGoal} className="col-span-2 md:col-span-1 rounded-xl h-12 md:h-10 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 w-full md:w-auto px-6">
                     <Plus className="h-5 w-5 md:mr-2" /> 
                     <span className="md:inline">Create Goal</span>
                  </Button>
              </div>
           </div>
        </div>
      </div>

      {/* GOALS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
         {goals.length === 0 && (
            <div className="col-span-full py-20 text-center space-y-4 animate-in fade-in zoom-in duration-500">
               <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-muted/30 border border-border">
                  <LayoutList className="h-10 w-10 text-muted-foreground/30" />
               </div>
               <div className="space-y-1">
                 <p className="text-lg font-medium">No active goals</p>
                 <p className="text-muted-foreground text-sm">Start by adding one above to track your progress.</p>
               </div>
            </div>
         )}

         {goals.map((g) => {
            const progress = calcProgress(g.subGoals);
            const overdue = progress < 100 && isOverdue(g.deadline);
            const completed = progress === 100 && g.subGoals.length > 0;
            const expanded = expandedGoals.has(g.id);
            const daysLeft = g.deadline ? Math.ceil((g.deadline - Date.now()) / (1000 * 60 * 60 * 24)) : null;

            return (
               <SpotlightCard 
                  key={g.id} 
                  className={cn(
                     "flex flex-col transition-all duration-500",
                     completed ? "border-green-500/30 bg-green-500/5" : overdue ? "border-red-500/30 bg-red-500/5" : "hover:border-primary/30"
                  )}
                  glowColor={completed ? "rgba(34, 197, 94, 0.15)" : overdue ? "rgba(239, 68, 68, 0.15)" : undefined}
               >
                  <div className="p-5 md:p-6 space-y-4">
                     <div className="flex justify-between items-start gap-3">
                        <div className="space-y-1.5 flex-1 min-w-0">
                           <h3 className={cn("font-bold text-lg truncate leading-tight", completed && "text-muted-foreground line-through decoration-green-500/50")}>
                              {g.title}
                           </h3>
                           
                           {/* Goal Metadata Pills */}
                           <div className="flex flex-wrap gap-2">
                              {/* Status Pill */}
                              {overdue ? (
                                 <Badge variant="destructive" className="rounded-md px-1.5 py-0.5 h-auto text-[10px] font-bold uppercase tracking-wider">Late</Badge>
                              ) : completed ? (
                                 <Badge className="bg-green-500/20 text-green-500 border-none rounded-md px-1.5 py-0.5 h-auto text-[10px] font-bold uppercase tracking-wider">Done</Badge>
                              ) : null}

                              {/* Date Pill */}
                              {g.deadline && !completed && (
                                <div className={cn("flex items-center text-[10px] px-2 py-0.5 rounded-full border bg-background/50", 
                                   daysLeft && daysLeft <= 3 ? "text-orange-500 border-orange-500/30" : "text-muted-foreground border-border/50")}>
                                   <Clock className="h-3 w-3 mr-1" />
                                   {daysLeft && daysLeft < 0 ? "Past Due" : `${daysLeft} days`}
                                </div>
                              )}

                              {/* Linked Pill */}
                              {g.linkedPlaylistId && (
                                 <div 
                                    className="flex items-center text-[10px] px-2 py-0.5 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-500 cursor-pointer hover:bg-blue-500/10" 
                                    onClick={(e) => { e.stopPropagation(); navigate("/playlists"); }}
                                 >
                                    <LinkIcon className="h-3 w-3 mr-1" /> Linked
                                 </div>
                              )}
                           </div>
                        </div>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground -mt-1 -mr-2">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => deleteGoal(g.id)} className="text-red-500 focus:text-red-500">
                              <Trash2 className="mr-2 h-4 w-4" /> Delete Goal
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                     </div>

                     <div className="space-y-2">
                        <div className="flex justify-between text-xs font-medium text-muted-foreground">
                           <span>Progress</span>
                           <span>{progress}%</span>
                        </div>
                        <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden">
                           <div 
                              className={cn(
                                 "h-full transition-all duration-1000 ease-out rounded-full relative overflow-hidden",
                                 completed ? "bg-green-500" : overdue ? "bg-red-500" : "bg-gradient-to-r from-primary to-purple-500"
                              )}
                              style={{ width: `${progress}%` }} 
                           />
                        </div>
                     </div>
                  </div>

                  <div className={cn("bg-muted/30 border-t border-border/50 transition-all duration-300", expanded ? "block" : "hidden md:block")}>
                     <div className="p-4 space-y-3">
                        <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                           {g.subGoals.map(s => (
                              <div 
                                 key={s.id} 
                                 onClick={() => toggleSubGoal(g.id, s.id)}
                                 className="group flex items-center gap-3 p-2 rounded-lg hover:bg-background/80 cursor-pointer transition-all active:scale-[0.98]"
                              >
                                 <div className={cn(
                                   "h-5 w-5 rounded-full border flex items-center justify-center transition-colors shrink-0",
                                   s.completed ? "bg-green-500 border-green-500" : "border-muted-foreground/40 group-hover:border-primary"
                                 )}>
                                    {s.completed && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                                 </div>
                                 <span className={cn("text-xs md:text-sm flex-1 break-words transition-all", s.completed ? "line-through text-muted-foreground opacity-50" : "text-foreground")}>
                                    {s.title}
                                 </span>
                              </div>
                           ))}
                           {g.subGoals.length === 0 && (
                              <div className="text-center py-4">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">No steps added</p>
                              </div>
                           )}
                        </div>

                        <div className="flex gap-2 pt-1">
                           <Input 
                              value={subGoalInput[g.id] || ""}
                              onChange={(e) => setSubGoalInput(p => ({ ...p, [g.id]: e.target.value }))}
                              onKeyDown={(e) => e.key === "Enter" && addSubGoal(g.id)}
                              placeholder="Add a step..."
                              className="h-9 text-xs md:text-sm bg-background/50 border-transparent focus:bg-background shadow-sm transition-all"
                           />
                           <Button size="icon" className="h-9 w-9 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm" onClick={() => addSubGoal(g.id)}>
                              <Plus className="h-4 w-4" />
                           </Button>
                        </div>
                     </div>
                  </div>

                  <div 
                     className="md:hidden flex justify-center py-2 border-t border-border/30 bg-muted/20 cursor-pointer active:bg-muted/40 transition-colors"
                     onClick={() => toggleExpand(g.id)}
                  >
                     {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
               </SpotlightCard>
            );
         })}
      </div>
      
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}