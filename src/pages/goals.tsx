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
} from "lucide-react";

// ---------------- TYPES ----------------
type SubGoal = {
  id: string;
  title: string;
  completed: boolean;
};

type Goal = {
  id: string;
  title: string;
  subGoals: SubGoal[];
};

// ================= PAGE =================
export default function Goals() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoal, setNewGoal] = useState("");
  const [subGoalInput, setSubGoalInput] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;

    const loadGoals = async () => {
      const snap = await getDocs(collection(db, "users", user.uid, "goals"));
      const data: Goal[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Goal, "id">),
      }));
      setGoals(data);
    };

    loadGoals();
  }, [user]);

  // ---------- ACTIONS ----------
  const addGoal = async () => {
    if (!newGoal.trim() || !user) return;

    const ref = await addDoc(collection(db, "users", user.uid, "goals"), {
      title: newGoal,
      subGoals: [],
    });

    setGoals((g) => [...g, { id: ref.id, title: newGoal, subGoals: [] }]);
    setNewGoal("");
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

  // ================= UI =================
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">3</span>
            </Button>
            <ThemeToggle />
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
            <Avatar className="h-9 w-9">
              <AvatarImage src={user?.photoURL || ""} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {user?.email?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        {/* Page Intro */}
        <Card className="border-border/50">
          <CardContent className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Target className="h-6 w-6 text-primary" />
                Your Study Goals
              </CardTitle>
              <CardDescription>
                Break subjects into smaller milestones and track real progress.
              </CardDescription>
            </div>
          </CardContent>
        </Card>

        {/* Add Goal */}
        <Card className="border-dashed border-2">
          <CardContent className="flex gap-3 p-4">
            <Input
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              placeholder="Add a new subject or goal (e.g. Calculus, Physics)"
            />
            <Button onClick={addGoal}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </CardContent>
        </Card>

        {/* Goals */}
        {goals.length === 0 && (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center text-muted-foreground">
              No goals yet. Add your first one to get started.
            </CardContent>
          </Card>
        )}

        {goals.map((g) => (
          <Card key={g.id} className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle>{g.title}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => deleteGoal(g.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
              <Progress value={progress(g.subGoals)} className="mt-3" />
            </CardHeader>

            <CardContent className="space-y-3">
              {g.subGoals.map((s) => (
                <div key={s.id} className="flex items-center gap-3">
                  <div onClick={() => toggleSubGoal(g.id, s.id)} className="cursor-pointer">
                    {s.completed ? (
                      <CheckCircle2 className="text-green-500" />
                    ) : (
                      <Circle className="text-muted-foreground" />
                    )}
                  </div>
                  <span className={s.completed ? "line-through text-muted-foreground" : ""}>
                    {s.title}
                  </span>
                </div>
              ))}

              <div className="flex gap-2 pt-2">
                <Input
                  value={subGoalInput[g.id] || ""}
                  onChange={(e) =>
                    setSubGoalInput((p) => ({ ...p, [g.id]: e.target.value }))
                  }
                  placeholder="Add sub-goal"
                />
                <Button size="sm" onClick={() => addSubGoal(g.id)}>
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}