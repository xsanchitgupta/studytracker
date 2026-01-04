import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc, collection, getDocs, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, updateProfile } from "firebase/auth";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getEarnedBadges, Badge } from "@/lib/badges";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge as BadgeComponent } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import {
  ArrowLeft, Camera, Medal, Trophy, TrendingUp, Clock, Target, BookOpen, Play, Brain,
  Settings, Shield, MapPin, Edit2, Upload, Check, Activity, Award,
  User, Lock, Eye, EyeOff, Trash2, School, GraduationCap, Flame, Save, X, Loader2
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription
} from "@/components/ui/dialog";

// --- TYPES ---
interface ProfileStats {
  watchedLectures: number;
  totalMinutes: number;
  completedGoals: number;
  totalPlaylists: number;
  studyStreak: number;
  totalFlashcards: number;
}

interface ActivityItem {
  id: string;
  type: "lecture" | "goal" | "flashcard" | "playlist";
  title: string;
  timestamp: any;
  description?: string;
}

// --- HELPER COMPONENTS ---

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
        "relative overflow-hidden rounded-3xl border bg-background/50 backdrop-blur-xl transition-all duration-300",
        !noHover && "hover:border-primary/20",
        onClick && "cursor-pointer active:scale-[0.99]",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 hidden md:block z-0"
        style={{ opacity, background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(120, 119, 198, 0.15), transparent 40%)` }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color }: any) => (
  <SpotlightCard className="p-5 flex flex-col justify-between h-28 hover:scale-[1.02] transition-transform cursor-default">
    <div className="flex justify-between items-start">
      <div className={cn("p-2.5 rounded-xl bg-gradient-to-br shadow-inner text-white", color)}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
    <div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
    </div>
  </SpotlightCard>
);

// --- MAIN PROFILE COMPONENT ---

export default function Profile() {
  const { user, profile, logout } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState("overview");

  // Form State
  const [college, setCollege] = useState("");
  const [semester, setSemester] = useState<number | "">("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(""); // FIXED: Local state for instant feedback

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [earnedBadges, setEarnedBadges] = useState<Badge[]>([]);
  const [stats, setStats] = useState<ProfileStats>({
    watchedLectures: 0, totalMinutes: 0, completedGoals: 0,
    totalPlaylists: 0, studyStreak: 0, totalFlashcards: 0
  });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);

  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // --- DATA LOADING ---
  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const data = snap.data();
          setCollege(data.college || "");
          setSemester(data.semester || "");
          setBio(data.bio || "");
          setLocation(data.location || "");
          // FIXED: Set initial avatar URL from Firestore
          setAvatarUrl(data.photoURL || user.photoURL || "");
        } else {
          setAvatarUrl(user.photoURL || "");
        }

        // Stats Calculation Logic...
        // (Keeping your exact logic for brevity)
        const playlistsSnap = await getDocs(collection(db, "users", user.uid, "playlists"));
        const goalsSnap = await getDocs(collection(db, "users", user.uid, "goals"));
        const flashcardsSnap = await getDocs(collection(db, "users", user.uid, "flashcardDecks"));

        let watchedLectures = 0;
        let totalMinutes = 0;
        const activityItems: ActivityItem[] = [];

        playlistsSnap.forEach(p => {
          const lectures = p.data().lectures || [];
          watchedLectures += lectures.filter((l: any) => l.completed).length;
          totalMinutes += lectures.reduce((acc: number, l: any) => acc + (l.watchTime || 0), 0);
          lectures.filter((l: any) => l.completed && l.updatedAt).forEach((l: any) => {
            activityItems.push({
              id: l.id, type: "lecture", title: l.title, timestamp: l.updatedAt,
              description: `Completed in ${p.data().title}`
            });
          });
        });

        const completedGoals = goalsSnap.docs.filter(g => {
          const sg = g.data().subGoals || [];
          return sg.length > 0 && sg.every((s: any) => s.completed);
        }).length;

        goalsSnap.docs.forEach(g => {
          const data = g.data();
          const sg = data.subGoals || [];
          if (sg.length > 0 && sg.every((s: any) => s.completed) && data.updatedAt) {
            activityItems.push({
              id: g.id, type: "goal", title: data.title, timestamp: data.updatedAt, description: "Goal completed"
            });
          }
        });

        let totalFlashcards = 0;
        flashcardsSnap.forEach(d => totalFlashcards += (d.data().cards || []).length);

        const days = new Set(activityItems.map(a => {
          const date = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
          return date.toDateString();
        }));
        let streakCount = 0;
        const today = new Date();
        for (let i = 0; ; i++) {
          const d = new Date();
          d.setDate(today.getDate() - i);
          if (days.has(d.toDateString())) streakCount++; else if (i > 0) break;
        }

        setStats({
          watchedLectures, totalMinutes, completedGoals,
          totalPlaylists: playlistsSnap.size, studyStreak: streakCount, totalFlashcards
        });

        setEarnedBadges(getEarnedBadges({ watchedLectures, totalMinutes, completedGoals }));

        activityItems.sort((a, b) => {
          const aTime = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : (a.timestamp || 0);
          const bTime = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : (b.timestamp || 0);
          return bTime - aTime;
        });
        setRecentActivity(activityItems.slice(0, 20));

        setLoading(false);
      } catch (error) {
        console.error("Error loading profile:", error);
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  // --- ACTIONS ---

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid), {
        college, semester: semester, bio, location,
        email: user.email, updatedAt: new Date(),
      }, { merge: true });
      toast.success("Profile updated successfully!");
    } catch (error) { toast.error("Failed to save profile"); }
    finally { setSaving(false); }
  };

  // Inside src/pages/Profile.tsx

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0]) return;
    const file = e.target.files[0];

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    setUploadingPhoto(true);
    try {
      console.log("Starting upload...");

      // 1. Upload
      const storageRef = ref(storage, `profile_photos/${user.uid}/${Date.now()}_${file.name}`);
      const snap = await uploadBytes(storageRef, file);
      console.log("Upload successful:", snap);

      const newPhotoURL = await getDownloadURL(snap.ref);
      console.log("Download URL:", newPhotoURL);

      // 2. Auth Update
      await updateProfile(user, { photoURL: newPhotoURL });

      // 3. Firestore Update
      await setDoc(doc(db, "users", user.uid), {
        photoURL: newPhotoURL,
        updatedAt: new Date()
      }, { merge: true });

      setAvatarUrl(newPhotoURL);
      await user.reload();

      toast.success("Profile photo updated!");
    } catch (error: any) {
      console.error("FULL UPLOAD ERROR:", error);

      // SHOW THE REAL REASON IN THE TOAST
      if (error.code === 'storage/unauthorized') {
        toast.error("Permission Denied: Check Storage Rules");
      } else if (error.code === 'storage/canceled') {
        toast.error("Upload canceled");
      } else if (error.code === 'storage/unknown') {
        toast.error("Unknown Error: Check Firebase Config");
      } else if (error.message.includes("network")) {
        toast.error("CORS Error: Localhost blocked");
      } else {
        toast.error(`Error: ${error.message}`);
      }
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeletePhoto = async () => {
    if (!user || !avatarUrl) return;
    try {
      const photoRef = ref(storage, avatarUrl);
      await deleteObject(photoRef);
      await updateDoc(doc(db, "users", user.uid), { photoURL: null, updatedAt: new Date() });
      setAvatarUrl(""); // Update local state
      toast.success("Profile photo removed");
    } catch (error) {
      console.error("Error deleting photo:", error);
      toast.error("Failed to delete photo");
    }
  };

  const handleChangePassword = async () => {
    if (!user || !currentPassword || !newPassword) { toast.error("Please fill in all fields"); return; }
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }

    try {
      const credential = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      toast.success("Password changed successfully");
      setShowPasswordDialog(false); setCurrentPassword(""); setNewPassword("");
    } catch (error: any) {
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        toast.error("Incorrect current password");
      } else {
        toast.error("Failed to change password. Try logging in again.");
      }
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const hoursStudied = Math.floor(stats.totalMinutes / 60);
  const minutesStudied = stats.totalMinutes % 60;

  return (
    <div className={cn("container mx-auto px-4 pb-20 animate-in fade-in duration-700",
      theme === "dark" ? "text-white" : "text-zinc-900"
    )}>

      {/* 1. HERO SECTION */}
      <SpotlightCard className="mb-8 p-0 border-0 overflow-visible" noHover>
        <div className="relative">
          {/* Banner */}
          <div className="h-48 md:h-64 w-full rounded-3xl overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-purple-600/30 animate-gradient-x" />
            <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-soft-light" />
          </div>

          {/* Avatar Group */}
          <div className="absolute -bottom-16 left-6 md:left-10 flex items-end gap-6">
            <div className="relative group">
              <Avatar className="h-32 w-32 md:h-40 md:w-40 border-[6px] border-background shadow-2xl ring-4 ring-primary/10 transition-transform group-hover:scale-105">
                {/* FIXED: Uses local avatarUrl state */}
                <AvatarImage src={avatarUrl} className="object-cover" />
                <AvatarFallback className="text-4xl bg-gradient-to-br from-primary to-purple-600 text-white font-bold">
                  {user?.email?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>

              {/* Photo Upload Dialog */}
              <div className="absolute bottom-2 right-2">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="icon" className="rounded-full shadow-lg h-9 w-9 bg-primary hover:bg-primary/90 transition-all hover:scale-110">
                      <Camera className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Update Profile Photo</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                      <Button onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto} className="w-full">
                        {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="mr-2 h-4 w-4" />}
                        Upload New Photo
                      </Button>
                      {avatarUrl && (
                        <Button variant="destructive" onClick={handleDeletePhoto} className="w-full">
                          <Trash2 className="mr-2 h-4 w-4" /> Remove Photo
                        </Button>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="mb-4 hidden md:block">
              <h1 className="text-3xl font-bold flex items-center gap-3">
                {profile?.name || user?.displayName || "Student"}
                {profile?.role === "admin" && <BadgeComponent className="bg-purple-500/20 text-purple-400 border-purple-500/30">Admin</BadgeComponent>}
              </h1>
              <p className="text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Mobile Info */}
        <div className="mt-20 px-6 md:px-10 pb-8 flex flex-col md:flex-row justify-between gap-6">
          <div className="md:hidden">
            <h1 className="text-2xl font-bold">{profile?.name || user?.displayName || "Student"}</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {location && <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" /> {location}</div>}
            {college && <div className="flex items-center gap-1.5"><School className="h-4 w-4 text-primary" /> {college}</div>}
            {semester && <div className="flex items-center gap-1.5"><GraduationCap className="h-4 w-4 text-primary" /> Sem {semester}</div>}
          </div>
        </div>
      </SpotlightCard>

      {/* 2. STATS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard icon={Play} label="Lectures" value={stats.watchedLectures} color="from-blue-500 to-cyan-500" />
        <StatCard icon={Clock} label="Time" value={`${hoursStudied}h ${minutesStudied}m`} color="from-green-500 to-emerald-500" />
        <StatCard icon={Target} label="Goals" value={stats.completedGoals} color="from-purple-500 to-pink-500" />
        <StatCard icon={BookOpen} label="Playlists" value={stats.totalPlaylists} color="from-orange-500 to-red-500" />
        <StatCard icon={Flame} label="Streak" value={stats.studyStreak} color="from-yellow-500 to-orange-500" />
        <StatCard icon={Brain} label="Cards" value={stats.totalFlashcards} color="from-indigo-500 to-purple-500" />
      </div>

      {/* 3. TABS CONTENT */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/40 p-1 rounded-full h-12 w-full md:w-auto grid grid-cols-4 md:inline-flex shadow-sm">
          <TabsTrigger value="overview" className="rounded-full">Overview</TabsTrigger>
          <TabsTrigger value="achievements" className="rounded-full">Awards</TabsTrigger>
          <TabsTrigger value="activity" className="rounded-full">History</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-full">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid md:grid-cols-2 gap-6">
            <SpotlightCard className="p-6 space-y-6" noHover>
              <h3 className="font-bold text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Progress</h3>
              <div className="space-y-4">
                <div className="space-y-2"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Lectures</span><span>{stats.watchedLectures}</span></div><Progress value={Math.min(100, stats.watchedLectures)} className="h-2" /></div>
                <div className="space-y-2"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Goals</span><span>{stats.completedGoals}</span></div><Progress value={Math.min(100, (stats.completedGoals / 10) * 100)} className="h-2" /></div>
              </div>
            </SpotlightCard>
            <SpotlightCard className="p-6" noHover>
              <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-lg flex items-center gap-2"><User className="h-5 w-5 text-primary" /> Bio</h3><Button variant="ghost" size="sm" onClick={() => setActiveTab("settings")}><Edit2 className="h-4 w-4" /></Button></div>
              <p className="text-muted-foreground leading-relaxed">{bio || "No bio added yet. Go to Settings to update."}</p>
            </SpotlightCard>
          </div>
        </TabsContent>

        <TabsContent value="achievements" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <SpotlightCard className="p-6" noHover>
            <h3 className="font-bold text-xl mb-6 flex items-center gap-2"><Medal className="h-6 w-6 text-yellow-500" /> Badges ({earnedBadges.length})</h3>
            {earnedBadges.length === 0 ? <div className="text-center py-12 opacity-50"><Trophy className="h-12 w-12 mx-auto mb-2" /><p>Start learning to earn badges!</p></div> :
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{earnedBadges.map(b => <div key={b.id} className="flex flex-col items-center text-center p-4 rounded-xl bg-muted/30 border hover:border-yellow-500/30 transition-all"><div className="text-4xl mb-3">{b.icon}</div><p className="font-bold text-sm">{b.name}</p><p className="text-xs text-muted-foreground">{b.description}</p></div>)}</div>}
          </SpotlightCard>
        </TabsContent>

        <TabsContent value="activity" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <SpotlightCard className="p-0" noHover>
            <div className="p-6 border-b border-border/40"><h3 className="font-bold text-lg flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> History</h3></div>
            <div className="divide-y divide-border/40">
              {recentActivity.map((item) => (
                <div key={item.id} className="p-4 flex items-start gap-4 hover:bg-muted/30 transition-colors">
                  <div className={cn("mt-1 p-2 rounded-xl shrink-0", item.type === 'lecture' ? 'bg-blue-500/10 text-blue-500' : item.type === 'goal' ? 'bg-green-500/10 text-green-500' : 'bg-purple-500/10 text-purple-500')}>
                    {item.type === 'lecture' && <Play className="h-4 w-4" />}
                    {item.type === 'goal' && <Target className="h-4 w-4" />}
                    {item.type === 'flashcard' && <Brain className="h-4 w-4" />}
                  </div>
                  <div><p className="font-semibold text-sm">{item.title}</p><p className="text-xs text-muted-foreground mt-0.5">{item.description}</p><p className="text-[10px] text-muted-foreground/60 mt-1 uppercase">{format(item.timestamp?.toDate ? item.timestamp.toDate() : new Date(item.timestamp), "MMM d, h:mm a")}</p></div>
                </div>
              ))}
              {recentActivity.length === 0 && <div className="p-12 text-center text-muted-foreground">No recent activity.</div>}
            </div>
          </SpotlightCard>
        </TabsContent>

        <TabsContent value="settings" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid md:grid-cols-2 gap-6">
            <SpotlightCard className="p-6 space-y-6" noHover>
              <h3 className="font-bold text-lg flex items-center gap-2"><User className="h-5 w-5 text-primary" /> Edit Profile</h3>
              <div className="space-y-4">
                <div className="space-y-2"><Label>College</Label><Input value={college} onChange={e => setCollege(e.target.value)} className="bg-background/50" /></div>
                <div className="space-y-2"><Label>Semester</Label><Select value={semester?.toString()} onValueChange={v => setSemester(Number(v))}><SelectTrigger className="bg-background/50"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5, 6, 7, 8].map(s => <SelectItem key={s} value={s.toString()}>Semester {s}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Location</Label><Input value={location} onChange={e => setLocation(e.target.value)} className="bg-background/50" /></div>
                <div className="space-y-2"><Label>Bio</Label><Textarea value={bio} onChange={e => setBio(e.target.value)} className="bg-background/50 resize-none" rows={3} /></div>
                <Button onClick={saveProfile} disabled={saving} className="w-full bg-primary text-white">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}</Button>
              </div>
            </SpotlightCard>

            <div className="space-y-6">
              <SpotlightCard className="p-6 space-y-4" noHover>
                <h3 className="font-bold text-lg flex items-center gap-2"><Lock className="h-5 w-5 text-primary" /> Security</h3>
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/10">
                  <div><p className="font-medium text-sm">Password</p><p className="text-xs text-muted-foreground">Update your password</p></div>
                  <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
                    <DialogTrigger asChild><Button variant="outline" size="sm">Change</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Change Password</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2"><Label>Current</Label><Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></div>
                        <div className="space-y-2"><Label>New</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} /></div>
                      </div>
                      <DialogFooter><Button onClick={handleChangePassword}>Update</Button></DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </SpotlightCard>

              <SpotlightCard className="p-6 border-red-500/20 bg-red-500/5" noHover>
                <h3 className="font-bold text-lg flex items-center gap-2 text-red-500"><Shield className="h-5 w-5" /> Danger Zone</h3>
                <div className="flex items-center justify-between mt-4">
                  <div><p className="font-medium text-sm text-red-600">Sign Out</p><p className="text-xs text-muted-foreground">Log out of this device</p></div>
                  <Button variant="destructive" size="sm" onClick={async () => { await logout(); navigate("/auth"); }}>Log Out</Button>
                </div>
              </SpotlightCard>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}