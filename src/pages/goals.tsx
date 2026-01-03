import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, deleteDoc, updateDoc, doc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

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
  Link as LinkIcon
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

  const [goals, setGoals] = useState<Goal[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistInfo[]>([]);
  
  // Form State
  const [newGoal, setNewGoal] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>("");
  const [subGoalInput, setSubGoalInput] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      // Load Goals
      const goalsSnap = await getDocs(collection(db, "users", user.uid, "goals"));
      const goalsData: Goal[] = goalsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Goal, "id">),
      }));
      setGoals(goalsData);

      // Load Playlists for linking
      const plSnap = await getDocs(collection(db, "users", user.uid, "playlists"));
      setPlaylists(plSnap.docs.map(d => ({ id: d.id, title: d.data().title })));
    };

    loadData();
  }, [user]);

  // ---------- ACTIONS ----------
  const addGoal = async () => {
    if (!newGoal.trim() || !user) return;

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
  };

  const deleteGoal = async (goalId: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "goals", goalId));
    setGoals((g) => g.filter((x) => x.id !== goalId));
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

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Study Goals</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" size="icon"><Settings className="h-5 w-5" /></Button>
            <Avatar className="h-9 w-9"><AvatarImage src={user?.photoURL || ""} /><AvatarFallback>{user?.email?.[0]}</AvatarFallback></Avatar>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        <Card className="border-border/50 bg-gradient-to-br from-green-500/10 to-emerald-600/5">
          <CardContent className="p-6">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" /> Goals & Milestones
            </CardTitle>
            <CardDescription className="mt-1">Track your academic progress and set strict deadlines.</CardDescription>
          </CardContent>
        </Card>

        {/* CREATE GOAL */}
        <Card className="border-2 border-dashed">
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <Input
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                placeholder="New Goal Title (e.g. Master Calculus)"
                className="flex-[2]"
              />
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={`justify-start text-left font-normal ${!selectedDate && "text-muted-foreground"}`}>
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
            <Button onClick={addGoal} className="w-full md:w-auto"><Plus className="h-4 w-4 mr-2" /> Create Goal</Button>
          </CardContent>
        </Card>

        {/* GOALS LIST */}
        <div className="grid gap-6">
          {goals.length === 0 && <p className="text-center text-muted-foreground py-8">No goals set yet.</p>}
          
          {goals.map((g) => {
            const overdue = !progress(g.subGoals) && isOverdue(g.deadline);
            return (
              <Card key={g.id} className={`border-2 ${overdue ? "border-red-500/30 bg-red-500/5" : "border-border/50"}`}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{g.title}</CardTitle>
                      <div className="flex items-center gap-4 mt-1">
                        {g.deadline && (
                          <span className={`text-xs flex items-center ${overdue ? "text-red-500 font-bold" : "text-muted-foreground"}`}>
                            <Calendar className="h-3 w-3 mr-1" />
                            {overdue ? "Overdue: " : "Due: "}{format(g.deadline, "PPP")}
                          </span>
                        )}
                        {g.linkedPlaylistId && (
                          <div 
                            className="text-xs text-blue-500 flex items-center cursor-pointer hover:underline"
                            onClick={() => navigate("/playlists")}
                          >
                            <LinkIcon className="h-3 w-3 mr-1" /> Linked to Playlist
                          </div>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteGoal(g.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <Progress value={progress(g.subGoals)} className="mt-4 h-2" />
                </CardHeader>

                <CardContent className="space-y-3">
                  {g.subGoals.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 group">
                      <div onClick={() => toggleSubGoal(g.id, s.id)} className="cursor-pointer transition-transform active:scale-90">
                        {s.completed ? <CheckCircle2 className="text-green-500 h-5 w-5" /> : <Circle className="text-muted-foreground h-5 w-5" />}
                      </div>
                      <span className={`flex-1 ${s.completed ? "line-through text-muted-foreground" : ""}`}>
                        {s.title}
                      </span>
                    </div>
                  ))}

                  <div className="flex gap-2 pt-2">
                    <Input
                      value={subGoalInput[g.id] || ""}
                      onChange={(e) => setSubGoalInput((p) => ({ ...p, [g.id]: e.target.value }))}
                      placeholder="Add sub-task..."
                      className="h-9 text-sm"
                      onKeyDown={(e) => e.key === "Enter" && addSubGoal(g.id)}
                    />
                    <Button size="sm" onClick={() => addSubGoal(g.id)} variant="secondary">Add</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}