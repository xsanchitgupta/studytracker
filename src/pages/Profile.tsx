import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, query, orderBy, limit } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getEarnedBadges, Badge } from "@/lib/badges";
import { format, isToday, isYesterday } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge as BadgeComponent } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { 
  ArrowLeft, LogOut, Save, GraduationCap, School, Camera, Medal, 
  Trophy, TrendingUp, Clock, Target, BookOpen, Play, Brain,
  Settings, Bell, Shield, Mail, Calendar, MapPin, Edit2, X,
  Upload, Check, Award, Zap, Flame, Star, BarChart3, Activity,
  User, Lock, Eye, EyeOff, Trash2, Image as ImageIcon
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";

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

export default function Profile() {
  const { user, profile, logout } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState("overview");
  const [college, setCollege] = useState("");
  const [semester, setSemester] = useState<number | "">("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [earnedBadges, setEarnedBadges] = useState<Badge[]>([]);
  const [stats, setStats] = useState<ProfileStats>({
    watchedLectures: 0,
    totalMinutes: 0,
    completedGoals: 0,
    totalPlaylists: 0,
    studyStreak: 0,
    totalFlashcards: 0
  });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Load profile data
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
        }
        
        // Calculate stats
        const playlistsSnap = await getDocs(collection(db, "users", user.uid, "playlists"));
        let watchedLectures = 0;
        let totalMinutes = 0;
        const activityItems: ActivityItem[] = [];
        
        playlistsSnap.forEach(p => {
          const lectures = p.data().lectures || [];
          watchedLectures += lectures.filter((l: any) => l.completed).length;
          totalMinutes += lectures.reduce((acc: number, l: any) => acc + (l.watchTime || 0), 0);
          
          // Add recent completed lectures to activity
          lectures.filter((l: any) => l.completed && l.updatedAt).forEach((l: any) => {
            activityItems.push({
              id: l.id,
              type: "lecture",
              title: l.title,
              timestamp: l.updatedAt,
              description: `Completed in ${p.data().title}`
            });
          });
        });

        const goalsSnap = await getDocs(collection(db, "users", user.uid, "goals"));
        const completedGoals = goalsSnap.docs.filter(g => {
          const sg = g.data().subGoals || [];
          return sg.length > 0 && sg.every((s: any) => s.completed);
        }).length;

        // Add completed goals to activity
        goalsSnap.docs.forEach(g => {
          const data = g.data();
          const sg = data.subGoals || [];
          if (sg.length > 0 && sg.every((s: any) => s.completed) && data.updatedAt) {
            activityItems.push({
              id: g.id,
              type: "goal",
              title: data.title,
              timestamp: data.updatedAt,
              description: "Goal completed"
            });
          }
        });

        // Get flashcards count
        const flashcardsSnap = await getDocs(collection(db, "users", user.uid, "flashcardDecks"));
        let totalFlashcards = 0;
        flashcardsSnap.forEach(d => {
          totalFlashcards += (d.data().cards || []).length;
        });

        // Calculate study streak (simplified - check last 30 days)
        const days = new Set(
          activityItems
            .filter(a => a.timestamp)
            .map(a => {
              const date = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
              return date.toDateString();
            })
        );
        let streakCount = 0;
        const today = new Date();
        for (let i = 0; ; i++) {
          const d = new Date();
          d.setDate(today.getDate() - i);
          if (days.has(d.toDateString())) streakCount++;
          else if (i > 0) break;
        }

        setStats({
          watchedLectures,
          totalMinutes,
          completedGoals,
          totalPlaylists: playlistsSnap.size,
          studyStreak: streakCount,
          totalFlashcards
        });

        setEarnedBadges(getEarnedBadges({ watchedLectures, totalMinutes, completedGoals }));
        
        // Sort activity by timestamp
        activityItems.sort((a, b) => {
          const aTime = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : (a.timestamp || 0);
          const bTime = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : (b.timestamp || 0);
          return bTime - aTime;
        });
        setRecentActivity(activityItems.slice(0, 20));
        
        setLoading(false);
      } catch (error) {
        console.error("Error loading profile:", error);
        toast.error("Failed to load profile");
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  // Save profile
  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);

    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          college,
          semester,
          bio,
          location,
          email: user.email,
          updatedAt: new Date(),
        },
        { merge: true }
      );
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  // Handle photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0]) return;
    
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    setUploadingPhoto(true);
    try {
      // Delete old photo if exists
      if (profile?.photoURL) {
        try {
          const oldRef = ref(storage, profile.photoURL);
          await deleteObject(oldRef);
        } catch (error) {
          // Ignore if old photo doesn't exist
        }
      }

      // Upload new photo
      const storageRef = ref(storage, `profile_photos/${user.uid}/${Date.now()}_${file.name}`);
      const snap = await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(snap.ref);

      // Update user document
      await updateDoc(doc(db, "users", user.uid), {
        photoURL,
        updatedAt: new Date()
      });

      toast.success("Profile photo updated!");
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast.error("Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Delete photo
  const handleDeletePhoto = async () => {
    if (!user || !profile?.photoURL) return;
    
    try {
      const photoRef = ref(storage, profile.photoURL);
      await deleteObject(photoRef);
      
      await updateDoc(doc(db, "users", user.uid), {
        photoURL: null,
        updatedAt: new Date()
      });
      
      toast.success("Profile photo removed");
    } catch (error) {
      console.error("Error deleting photo:", error);
      toast.error("Failed to delete photo");
    }
  };

  if (loading) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center",
        theme === "dark" ? "bg-background" : "bg-background"
      )}>
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  const hoursStudied = Math.floor(stats.totalMinutes / 60);
  const minutesStudied = stats.totalMinutes % 60;

  return (
    <div className={cn("min-h-screen transition-colors duration-300",
      theme === "dark" 
        ? "bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-background to-background"
        : "bg-gradient-to-br from-background via-background to-muted/20"
    )}>
      {/* Header */}
      <header className={cn("sticky top-0 z-50 border-b backdrop-blur-x1 transition-all duration-300",
        theme === "dark" ? "bg-background/80 border-white/5" : "bg-background/60 border-border shadow-sm"
      )}>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className={cn("text-2xl font-bold", theme === "dark" ? "text-white" : "text-foreground")}>Profile</h1>
              <p className="text-xs text-muted-foreground">Manage your account and preferences</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="icon" className="rounded-full" onClick={async () => { await logout(); navigate("/auth"); }}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Profile Hero Section */}
        <Card className={cn("mb-8 overflow-hidden border backdrop-blur-x1 transition-all duration-300 animate-in slide-in-from-top-4",
          theme === "dark" 
            ? "bg-gradient-to-br from-primary/10 via-background/80 to-background border-white/10 shadow-2xl" 
            : "bg-gradient-to-br from-primary/5 via-background to-background border-border shadow-lg"
        )}>
          <div className="relative">
            {/* Cover/Banner */}
            <div className={cn("h-48 w-full relative overflow-hidden",
              theme === "dark" ? "bg-gradient-to-r from-primary/20 to-purple-600/20" : "bg-gradient-to-r from-primary/10 to-purple-600/10"
            )}>
              <div className={cn("absolute inset-0 opacity-20",
                theme === "dark" ? "bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/40" : ""
              )} />
            </div>
            
            {/* Profile Photo Section */}
            <div className="absolute -bottom-16 left-8">
              <div className="relative group">
                <Avatar className={cn("h-32 w-32 border-4 shadow-2xl ring-4 transition-all duration-300 group-hover:scale-105",
                  theme === "dark" ? "border-background ring-primary/20" : "border-background ring-primary/10"
                )}>
                  <AvatarImage src={profile?.photoURL || user?.photoURL || ""} className="object-cover" />
                  <AvatarFallback className={cn("text-4xl font-bold bg-gradient-to-br from-primary to-purple-600",
                    theme === "dark" ? "text-white" : "text-white"
                  )}>
                    {profile?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      size="icon"
                      className={cn("absolute -bottom-2 -right-2 rounded-full shadow-lg transition-all hover:scale-110",
                        theme === "dark" ? "bg-primary hover:bg-primary/90" : "bg-primary hover:bg-primary/90"
                      )}
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className={cn("sm:max-w-md",
                    theme === "dark" ? "bg-background/95 border-white/10" : "bg-background border-border"
                  )}>
                    <DialogHeader>
                      <DialogTitle>Update Profile Photo</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="flex justify-center">
                        <Avatar className="h-24 w-24">
                          <AvatarImage src={profile?.photoURL || user?.photoURL || ""} />
                          <AvatarFallback className="text-2xl">
                            {profile?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="space-y-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                        <Button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingPhoto}
                          className="w-full"
                        >
                          {uploadingPhoto ? (
                            <>
                              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Upload New Photo
                            </>
                          )}
                        </Button>
                        {profile?.photoURL && (
                          <Button
                            variant="destructive"
                            onClick={handleDeletePhoto}
                            className="w-full"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove Photo
                          </Button>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          {/* Profile Info */}
          <div className="pt-20 px-8 pb-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h2 className={cn("text-3xl font-bold", theme === "dark" ? "text-white" : "text-foreground")}>
                    {profile?.name || user?.displayName || user?.email?.split("@")[0] || "User"}
                  </h2>
                  {profile?.role === "admin" && (
                    <BadgeComponent className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                      <Shield className="h-3 w-3 mr-1" />
                      Admin
                    </BadgeComponent>
                  )}
                </div>
                <p className="text-muted-foreground">{user?.email}</p>
                {bio && <p className="text-sm text-muted-foreground max-w-2xl">{bio}</p>}
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {location}
                    </div>
                  )}
                  {college && (
                    <div className="flex items-center gap-1.5">
                      <School className="h-4 w-4" />
                      {college}
                    </div>
                  )}
                  {semester && (
                    <div className="flex items-center gap-1.5">
                      <GraduationCap className="h-4 w-4" />
                      Semester {semester}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatCard icon={Play} label="Lectures" value={stats.watchedLectures} color="from-blue-500 to-cyan-500" />
          <StatCard icon={Clock} label="Study Time" value={`${hoursStudied}h ${minutesStudied}m`} color="from-green-500 to-emerald-500" />
          <StatCard icon={Target} label="Goals" value={stats.completedGoals} color="from-purple-500 to-pink-500" />
          <StatCard icon={BookOpen} label="Playlists" value={stats.totalPlaylists} color="from-orange-500 to-red-500" />
          <StatCard icon={Flame} label="Streak" value={`${stats.studyStreak} days`} color="from-yellow-500 to-orange-500" />
          <StatCard icon={Brain} label="Flashcards" value={stats.totalFlashcards} color="from-indigo-500 to-purple-500" />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={cn("grid w-full grid-cols-4",
            theme === "dark" ? "bg-background/40" : "bg-background/60"
          )}>
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="achievements" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" /> Achievements
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <Activity className="h-4 w-4" /> Activity
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" /> Settings
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Progress Cards */}
              <Card className={cn("backdrop-blur-x1 border",
                theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
              )}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Learning Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Lectures Watched</span>
                      <span className="font-bold">{stats.watchedLectures}</span>
                    </div>
                    <Progress value={Math.min(100, (stats.watchedLectures / 100) * 100)} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Goals Completed</span>
                      <span className="font-bold">{stats.completedGoals}</span>
                    </div>
                    <Progress value={Math.min(100, (stats.completedGoals / 10) * 100)} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Study Streak</span>
                      <span className="font-bold">{stats.studyStreak} days</span>
                    </div>
                    <Progress value={Math.min(100, (stats.studyStreak / 30) * 100)} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card className={cn("backdrop-blur-x1 border",
                theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
              )}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    Quick Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className={cn("p-4 rounded-xl border",
                    theme === "dark" ? "bg-primary/10 border-primary/20" : "bg-primary/5 border-primary/10"
                  )}>
                    <div className="text-2xl font-bold text-primary mb-1">
                      {hoursStudied}h {minutesStudied}m
                    </div>
                    <div className="text-sm text-muted-foreground">Total Study Time</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className={cn("p-3 rounded-lg border text-center",
                      theme === "dark" ? "bg-white/5 border-white/10" : "bg-muted/30 border-border"
                    )}>
                      <div className="text-xl font-bold">{stats.totalPlaylists}</div>
                      <div className="text-xs text-muted-foreground">Playlists</div>
                    </div>
                    <div className={cn("p-3 rounded-lg border text-center",
                      theme === "dark" ? "bg-white/5 border-white/10" : "bg-muted/30 border-border"
                    )}>
                      <div className="text-xl font-bold">{stats.totalFlashcards}</div>
                      <div className="text-xs text-muted-foreground">Flashcards</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Achievements Tab */}
          <TabsContent value="achievements" className="space-y-6">
            <Card className={cn("backdrop-blur-x1 border",
              theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
            )}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Medal className="h-5 w-5 text-yellow-500" />
                  Your Achievements
                </CardTitle>
                <CardDescription>
                  {earnedBadges.length} of {4} badges earned
                </CardDescription>
              </CardHeader>
              <CardContent>
                {earnedBadges.length === 0 ? (
                  <div className="text-center py-12">
                    <Award className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground">Keep studying to earn your first badge!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {earnedBadges.map(badge => (
                      <div
                        key={badge.id}
                        className={cn("flex flex-col items-center p-6 rounded-xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-lg",
                          theme === "dark" 
                            ? "bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/20 hover:border-yellow-500/40" 
                            : "bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200 hover:border-yellow-300"
                        )}
                      >
                        <div className="text-5xl mb-3 animate-bounce">{badge.icon}</div>
                        <p className="font-bold text-lg mb-1 text-center">{badge.name}</p>
                        <p className="text-xs text-muted-foreground text-center">{badge.description}</p>
                        <BadgeComponent className="mt-3 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30">
                          <Check className="h-3 w-3 mr-1" />
                          Earned
                        </BadgeComponent>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-6">
            <Card className={cn("backdrop-blur-x1 border",
              theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
            )}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Your learning journey</CardDescription>
              </CardHeader>
              <CardContent>
                {recentActivity.length === 0 ? (
                  <div className="text-center py-12">
                    <Activity className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground">No recent activity</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentActivity.map((item, i) => {
                      const date = item.timestamp?.toDate ? item.timestamp.toDate() : new Date(item.timestamp || Date.now());
                      const isRecent = isToday(date) || isYesterday(date);
                      
                      return (
                        <div
                          key={item.id}
                          className={cn("flex items-start gap-4 p-4 rounded-lg border transition-all hover:scale-[1.01]",
                            theme === "dark" ? "bg-white/5 border-white/10" : "bg-muted/30 border-border",
                            `animate-in fade-in slide-in-from-left-${Math.min(i + 1, 5)}`
                          )}
                          style={{ animationDelay: `${i * 50}ms` }}
                        >
                          <div className={cn("p-2 rounded-lg shrink-0",
                            item.type === "lecture" ? "bg-blue-500/20 text-blue-400" :
                            item.type === "goal" ? "bg-green-500/20 text-green-400" :
                            item.type === "flashcard" ? "bg-purple-500/20 text-purple-400" :
                            "bg-orange-500/20 text-orange-400"
                          )}>
                            {item.type === "lecture" && <Play className="h-4 w-4" />}
                            {item.type === "goal" && <Target className="h-4 w-4" />}
                            {item.type === "flashcard" && <Brain className="h-4 w-4" />}
                            {item.type === "playlist" && <BookOpen className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("font-semibold truncate", theme === "dark" ? "text-white" : "text-foreground")}>
                              {item.title}
                            </p>
                            {item.description && (
                              <p className="text-sm text-muted-foreground">{item.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {isRecent 
                                ? isToday(date) ? "Today" : "Yesterday"
                                : format(date, "MMM d, yyyy")
                              } at {format(date, "h:mm a")}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card className={cn("backdrop-blur-x1 border",
              theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
            )}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Personal Information
                </CardTitle>
                <CardDescription>Update your profile details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    placeholder="Tell us about yourself..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="college" className="flex items-center gap-2">
                      <School className="h-4 w-4" /> College
                    </Label>
                    <Input
                      id="college"
                      placeholder="e.g. IIT Bombay"
                      value={college}
                      onChange={(e) => setCollege(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="semester" className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" /> Semester
                    </Label>
                    <select
                      id="semester"
                      className={cn("w-full h-10 rounded-md border bg-background px-3 text-sm",
                        theme === "dark" ? "border-white/10" : "border-border"
                      )}
                      value={semester}
                      onChange={(e) => setSemester(e.target.value ? Number(e.target.value) : "")}
                    >
                      <option value="">Select semester</option>
                      {[1,2,3,4,5,6,7,8].map(s => (
                        <option key={s} value={s}>Semester {s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Location
                  </Label>
                  <Input
                    id="location"
                    placeholder="e.g. Mumbai, India"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>

                <Button onClick={saveProfile} disabled={saving} className="w-full">
                  {saving ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Account Settings */}
            <Card className={cn("backdrop-blur-x1 border",
              theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
            )}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  Account Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className={cn("p-4 rounded-lg border",
                  theme === "dark" ? "bg-white/5 border-white/10" : "bg-muted/30 border-border"
                )}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn("font-semibold", theme === "dark" ? "text-white" : "text-foreground")}>Email</p>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                    </div>
                    <BadgeComponent variant="secondary">Verified</BadgeComponent>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className={cn("font-semibold", theme === "dark" ? "text-white" : "text-foreground")}>Password</p>
                    <p className="text-sm text-muted-foreground">Last changed: Never</p>
                  </div>
                  <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline">Change Password</Button>
                    </DialogTrigger>
                    <DialogContent className={cn(
                      theme === "dark" ? "bg-background/95 border-white/10" : "bg-background border-border"
                    )}>
                      <DialogHeader>
                        <DialogTitle>Change Password</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Current Password</Label>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>New Password</Label>
                          <Input
                            type={showPassword ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                          />
                        </div>
                        <Button className="w-full" onClick={() => {
                          toast.info("Password change feature coming soon!");
                          setShowPasswordDialog(false);
                        }}>
                          Update Password
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
    <Card className={cn("backdrop-blur-x1 border transition-all duration-300 hover:shadow-xl hover:scale-[1.02] overflow-hidden",
      theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
    )}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1 truncate">{label}</p>
            <p className={cn("text-2xl font-bold truncate", theme === "dark" ? "text-white" : "text-foreground")}>
              {value}
            </p>
          </div>
          <div className={cn(`p-3 rounded-xl bg-gradient-to-br ${color} shrink-0`)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}