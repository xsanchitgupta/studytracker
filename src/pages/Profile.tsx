import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { getEarnedBadges, Badge } from "@/lib/badges";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { ArrowLeft, LogOut, Save, GraduationCap, School, Camera, Medal } from "lucide-react";

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [college, setCollege] = useState("");
  const [semester, setSemester] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [earnedBadges, setEarnedBadges] = useState<Badge[]>([]);

  // -------- LOAD PROFILE --------
  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setCollege(data.college || "");
        setSemester(data.semester || "");
      }
      
      // Calculate Badges (Simple implementation)
      // In production, these stats should be aggregated in the user document
      const playlistsSnap = await getDocs(collection(db, "users", user.uid, "playlists"));
      let watchedLectures = 0;
      let totalMinutes = 0;
      playlistsSnap.forEach(p => {
        const lectures = p.data().lectures || [];
        watchedLectures += lectures.filter((l: any) => l.completed).length;
        totalMinutes += lectures.reduce((acc: number, l: any) => acc + (l.watchTime || 0), 0);
      });

      const goalsSnap = await getDocs(collection(db, "users", user.uid, "goals"));
      // Assume a goal is complete if subGoals exist and all are checked
      const completedGoals = goalsSnap.docs.filter(g => {
        const sg = g.data().subGoals || [];
        return sg.length > 0 && sg.every((s: any) => s.completed);
      }).length;

      setEarnedBadges(getEarnedBadges({ watchedLectures, totalMinutes, completedGoals }));
      setLoading(false);
    };

    loadProfile();
  }, [user]);

  // -------- SAVE PROFILE --------
  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);

    await setDoc(
      doc(db, "users", user.uid),
      {
        college,
        semester,
        email: user.email,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="text-xl font-bold">Profile</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Avatar className="h-9 w-9">
              <AvatarImage src={user?.photoURL || ""} />
              <AvatarFallback>{user?.email?.[0]?.toUpperCase() || "U"}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-4xl grid md:grid-cols-2 gap-8">
        <Card className="shadow-xl h-fit">
          <CardHeader className="text-center">
            <div className="relative w-fit mx-auto mb-3">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user?.photoURL || ""} />
                <AvatarFallback className="text-2xl">
                  {user?.email?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
            </div>
            <CardTitle>{user?.email}</CardTitle>
            <CardDescription>Manage your academic profile</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <School className="h-4 w-4" /> College
              </Label>
              <Input
                placeholder="e.g. IIT Bombay"
                value={college}
                onChange={(e) => setCollege(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" /> Semester
              </Label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3"
                value={semester}
                onChange={(e) => setSemester(Number(e.target.value))}
              >
                <option value="">Select semester</option>
                {[1,2,3,4,5,6,7,8].map(s => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button className="flex-1" onClick={saveProfile} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={async () => {
                  await logout();
                  navigate("/auth");
                }}
              >
                <LogOut className="h-4 w-4 mr-2" /> Logout
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* BADGES SECTION */}
        <Card className="shadow-xl h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Medal className="h-5 w-5 text-yellow-500" /> Achievements
            </CardTitle>
            <CardDescription>Badges you've earned</CardDescription>
          </CardHeader>
          <CardContent>
            {earnedBadges.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Keep studying to earn your first badge!</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {earnedBadges.map(badge => (
                  <div key={badge.id} className="flex flex-col items-center p-3 bg-muted/50 rounded-xl border-2 hover:border-primary/20 transition-colors text-center">
                    <div className="text-3xl mb-2">{badge.icon}</div>
                    <p className="font-bold text-sm">{badge.name}</p>
                    <p className="text-[10px] text-muted-foreground">{badge.description}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}