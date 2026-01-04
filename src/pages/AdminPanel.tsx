import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Users,
  Play,
  Shield,
  BarChart3,
  Trash2,
  Edit2,
  Search,
  UserCheck,
  BookOpen,
  TrendingUp,
  AlertCircle,
  Plus,
  X,
  Check,
  Loader2,
  Settings,
  Database,
  Zap,
  Activity,
  Clock,
  Mail,
  Calendar,
  Download,
  Upload,
  Copy,
  Eye,
  EyeOff,
  Ban,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Filter,
  MoreVertical,
  UserPlus,
  UserMinus,
  FileText,
  Bell,
  Globe,
  Lock,
  Unlock,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

type Lecture = {
  id: string;
  title: string;
  videoId: string;
};

type Playlist = {
  id: string;
  title: string;
  lectures: Lecture[];
  createdBy?: string;
  createdAt?: any;
  description?: string;
  isPublic?: boolean;
  syncedToUsers?: number;
};

type User = {
  uid: string;
  email: string | null;
  name: string;
  photoURL: string | null;
  role: string;
  createdAt?: any;
  lastSignInAt?: any;
  isActive?: boolean;
  playlistsCount?: number;
  totalWatchTime?: number;
};

type SystemStats = {
  totalUsers: number;
  activeUsers: number;
  admins: number;
  totalPlaylists: number;
  globalPlaylists: number;
  totalLectures: number;
  totalWatchTime: number;
  newUsersToday: number;
  newUsersThisWeek: number;
};

export default function AdminPanel() {
  const { user: currentUser, profile, isAdmin, refreshProfile } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState("overview");
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [newPlaylist, setNewPlaylist] = useState("");
  const [newPlaylistDesc, setNewPlaylistDesc] = useState("");
  const [lectureTitle, setLectureTitle] = useState("");
  const [lectureVideo, setLectureVideo] = useState("");
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [syncingPlaylist, setSyncingPlaylist] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string>("");
  const [showSyncDialog, setShowSyncDialog] = useState<string | null>(null);

  // Load users with real-time updates
  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      query(collection(db, "users"), orderBy("createdAt", "desc")),
      (snap) => {
        const usersData = snap.docs.map(async (d) => {
          const data = d.data();
          // Get user's playlist count
          const playlistsSnap = await getDocs(collection(db, "users", d.id, "playlists"));
          let totalWatchTime = 0;
          playlistsSnap.forEach(p => {
            const lectures = p.data().lectures || [];
            totalWatchTime += lectures.reduce((acc: number, l: any) => acc + (l.watchTime || 0), 0);
          });

          return {
            uid: d.id,
            ...data,
            playlistsCount: playlistsSnap.size,
            totalWatchTime,
            isActive: data.lastSignInAt && 
              (data.lastSignInAt.toDate ? data.lastSignInAt.toDate().getTime() : data.lastSignInAt) > Date.now() - 7 * 24 * 60 * 60 * 1000
          } as User;
        });
        
        Promise.all(usersData).then(resolved => {
          setUsers(resolved);
          setLoading(false);
        });
      },
      (error) => {
        console.error("Error loading users:", error);
        toast.error("Failed to load users");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Load playlists with real-time updates
  useEffect(() => {
    setPlaylistLoading(true);
    const unsub = onSnapshot(
      query(collection(db, "playlists_global"), orderBy("createdAt", "desc")),
      (snap) => {
        setPlaylists(
          snap.docs.map((d) => ({ 
            id: d.id, 
            ...(d.data() as Omit<Playlist, "id">) 
          }))
        );
        setPlaylistLoading(false);
      },
      (error) => {
        console.error("Error loading playlists:", error);
        toast.error("Failed to load playlists");
        setPlaylistLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Calculate system statistics
  const systemStats: SystemStats = useMemo(() => {
    const now = Date.now();
    const today = now - 24 * 60 * 60 * 1000;
    const thisWeek = now - 7 * 24 * 60 * 60 * 1000;

    const newUsersToday = users.filter(u => {
      const created = u.createdAt?.toDate ? u.createdAt.toDate().getTime() : (u.createdAt || 0);
      return created > today;
    }).length;

    const newUsersThisWeek = users.filter(u => {
      const created = u.createdAt?.toDate ? u.createdAt.toDate().getTime() : (u.createdAt || 0);
      return created > thisWeek;
    }).length;

    return {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.isActive).length,
      admins: users.filter(u => u.role === "admin").length,
      totalPlaylists: playlists.length,
      globalPlaylists: playlists.length,
      totalLectures: playlists.reduce((acc, p) => acc + p.lectures.length, 0),
      totalWatchTime: users.reduce((acc, u) => acc + (u.totalWatchTime || 0), 0),
      newUsersToday,
      newUsersThisWeek,
    };
  }, [users, playlists]);

  // User management functions
  const updateUserRole = async (userId: string, newRole: string) => {
    if (userId === currentUser?.uid) {
      toast.error("You cannot change your own role");
      return;
    }

    try {
      await updateDoc(doc(db, "users", userId), {
        role: newRole
      });
      toast.success(`User role updated to ${newRole}`);
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update user role");
    }
  };

  const deleteUser = async (userId: string) => {
    if (userId === currentUser?.uid) {
      toast.error("You cannot delete your own account");
      return;
    }

    if (!confirm("Are you sure you want to delete this user? This will delete all their data. This action cannot be undone.")) {
      return;
    }

    try {
      // Delete user's subcollections first
      const playlistsSnap = await getDocs(collection(db, "users", userId, "playlists"));
      const batch = writeBatch(db);
      
      playlistsSnap.docs.forEach(d => {
        batch.delete(doc(db, "users", userId, "playlists", d.id));
      });

      // Delete user document
      batch.delete(doc(db, "users", userId));
      
      await batch.commit();
      toast.success("User deleted successfully");
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    }
  };

  const bulkUpdateUsers = async () => {
    if (selectedUsers.size === 0) {
      toast.error("Please select at least one user");
      return;
    }

    if (!bulkAction) {
      toast.error("Please select an action");
      return;
    }

    try {
      const batch = writeBatch(db);
      let count = 0;

      selectedUsers.forEach(userId => {
        if (userId === currentUser?.uid) return;
        
        if (bulkAction === "make_admin") {
          batch.update(doc(db, "users", userId), { role: "admin" });
          count++;
        } else if (bulkAction === "make_user") {
          batch.update(doc(db, "users", userId), { role: "user" });
          count++;
        } else if (bulkAction === "delete") {
          batch.delete(doc(db, "users", userId));
          count++;
        }
      });

      if (count > 0) {
        await batch.commit();
        toast.success(`${count} user(s) updated successfully`);
        setSelectedUsers(new Set());
        setBulkAction("");
      }
    } catch (error) {
      console.error("Error bulk updating users:", error);
      toast.error("Failed to update users");
    }
  };

  // Playlist management functions
  const createPlaylist = async () => {
    if (!newPlaylist.trim()) {
      toast.error("Please enter a playlist title");
      return;
    }

    try {
      await addDoc(collection(db, "playlists_global"), {
        title: newPlaylist.trim(),
        description: newPlaylistDesc.trim() || "",
        createdBy: currentUser?.uid || "admin",
        lectures: [],
        isPublic: true,
        syncedToUsers: 0,
        createdAt: new Date(),
      });
      setNewPlaylist("");
      setNewPlaylistDesc("");
      toast.success("Playlist created successfully");
    } catch (error) {
      console.error("Error creating playlist:", error);
      toast.error("Failed to create playlist");
    }
  };

  const deletePlaylist = async (id: string) => {
    if (!confirm("Are you sure you want to delete this playlist? All lectures will be removed.")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "playlists_global", id));
      toast.success("Playlist deleted successfully");
    } catch (error) {
      console.error("Error deleting playlist:", error);
      toast.error("Failed to delete playlist");
    }
  };

  const syncPlaylistToUsers = async (playlistId: string, targetUserIds?: string[]) => {
    setSyncingPlaylist(playlistId);
    try {
      const playlist = playlists.find(p => p.id === playlistId);
      if (!playlist) {
        toast.error("Playlist not found");
        return;
      }

      // Convert admin playlist format to user playlist format
      const userPlaylistData = {
        title: playlist.title,
        description: playlist.description || "",
        lectures: playlist.lectures.map(l => ({
          id: crypto.randomUUID(),
          title: l.title,
          videoId: l.videoId,
          completed: false,
          notes: "",
          watchTime: 0,
          createdAt: Date.now(),
          tags: [],
          timestampNotes: [],
        })),
        createdAt: Date.now(),
        isFromAdmin: true,
        adminPlaylistId: playlistId,
      };

      const targetUsers = targetUserIds || users.map(u => u.uid);
      let syncedCount = 0;

      for (const userId of targetUsers) {
        try {
          await addDoc(collection(db, "users", userId, "playlists"), userPlaylistData);
          syncedCount++;
        } catch (error) {
          console.error(`Error syncing to user ${userId}:`, error);
        }
      }

      // Update sync count
      await updateDoc(doc(db, "playlists_global", playlistId), {
        syncedToUsers: (playlist.syncedToUsers || 0) + syncedCount
      });

      toast.success(`Playlist synced to ${syncedCount} user(s)`);
      setShowSyncDialog(null);
    } catch (error) {
      console.error("Error syncing playlist:", error);
      toast.error("Failed to sync playlist");
    } finally {
      setSyncingPlaylist(null);
    }
  };

  const addLecture = async (p: Playlist) => {
    if (!lectureTitle.trim() || !lectureVideo.trim()) {
      toast.error("Please fill in both title and video ID");
      return;
    }

    // Extract video ID from URL if full URL is provided
    let videoId = lectureVideo.trim();
    if (videoId.includes("youtube.com") || videoId.includes("youtu.be")) {
      const match = videoId.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
      videoId = match ? match[1] : videoId;
    }

    try {
      const updated = [
        ...p.lectures,
        {
          id: crypto.randomUUID(),
          title: lectureTitle.trim(),
          videoId: videoId,
        },
      ];

      await updateDoc(doc(db, "playlists_global", p.id), {
        lectures: updated,
      });

      setLectureTitle("");
      setLectureVideo("");
      setActivePlaylistId(null);
      toast.success("Lecture added successfully");
    } catch (error) {
      console.error("Error adding lecture:", error);
      toast.error("Failed to add lecture");
    }
  };

  const removeLecture = async (p: Playlist, lid: string) => {
    try {
      const updated = p.lectures.filter((l) => l.id !== lid);
      await updateDoc(doc(db, "playlists_global", p.id), {
        lectures: updated,
      });
      toast.success("Lecture removed successfully");
    } catch (error) {
      console.error("Error removing lecture:", error);
      toast.error("Failed to remove lecture");
    }
  };

  const togglePlaylistPublic = async (id: string, isPublic: boolean) => {
    try {
      await updateDoc(doc(db, "playlists_global", id), {
        isPublic: !isPublic
      });
      toast.success(`Playlist ${!isPublic ? "published" : "unpublished"}`);
    } catch (error) {
      console.error("Error toggling playlist visibility:", error);
      toast.error("Failed to update playlist");
    }
  };

  // Filtered data
  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  const filteredPlaylists = playlists.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Chart data
  const userGrowthData = useMemo(() => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return {
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        users: users.filter(u => {
          const created = u.createdAt?.toDate ? u.createdAt.toDate().getTime() : (u.createdAt || 0);
          return created <= date.getTime() && created > date.getTime() - 24 * 60 * 60 * 1000;
        }).length
      };
    });
    return last30Days;
  }, [users]);

  const roleDistribution = [
    { name: "Admins", value: systemStats.admins, color: "#8b5cf6" },
    { name: "Users", value: systemStats.totalUsers - systemStats.admins, color: "#10b981" },
  ];

  if (loading && users.length === 0) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center transition-colors duration-300",
        theme === "dark" 
          ? "bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-background to-background"
          : "bg-gradient-to-br from-background via-background to-muted/20"
      )}>
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen transition-colors duration-300",
      theme === "dark" 
        ? "bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-background to-background"
        : "bg-gradient-to-br from-background via-background to-muted/20"
    )}>
      {/* Header */}
      <header className={cn("sticky top-0 z-50 border-b backdrop-blur-xl transition-all duration-300",
        theme === "dark" ? "bg-background/80 border-white/5" : "bg-background/60 border-border shadow-sm"
      )}>
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-xl transition-all duration-300",
                theme === "dark" ? "bg-primary/20" : "bg-primary/10"
              )}>
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-2xl font-bold", theme === "dark" ? "text-white" : "text-foreground")}>
                  Admin Control Center
                </h1>
                <p className="text-xs text-muted-foreground">Complete system management and analytics</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
              <Shield className="h-3 w-3 mr-1" />
              Admin Access
            </Badge>
            <Button variant="ghost" size="icon" onClick={refreshProfile} className="rounded-full">
              <RefreshCw className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Debug Info - Only show if role doesn't match */}
        {profile && profile.role !== "admin" && (
          <Card className={cn("mb-6 border-2 border-yellow-500/50 backdrop-blur-xl",
            theme === "dark" ? "bg-yellow-500/10 border-yellow-500/30" : "bg-yellow-50 border-yellow-300"
          )}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn("font-semibold mb-1", theme === "dark" ? "text-yellow-400" : "text-yellow-700")}>
                    <AlertCircle className="h-4 w-4 inline mr-2" />
                    Role Mismatch Detected
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Your current role: <span className="font-bold">{profile.role || "user"}</span>
                    {!isAdmin && " - You need 'admin' role to access this panel"}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={refreshProfile}>
                  Refresh Profile
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
          <StatCard icon={Users} label="Total Users" value={systemStats.totalUsers} color="from-blue-500 to-cyan-500" />
          <StatCard icon={Activity} label="Active" value={systemStats.activeUsers} color="from-green-500 to-emerald-500" />
          <StatCard icon={Shield} label="Admins" value={systemStats.admins} color="from-purple-500 to-pink-500" />
          <StatCard icon={TrendingUp} label="New Today" value={systemStats.newUsersToday} color="from-orange-500 to-red-500" />
          <StatCard icon={BookOpen} label="Playlists" value={systemStats.totalPlaylists} color="from-indigo-500 to-purple-500" />
          <StatCard icon={Play} label="Lectures" value={systemStats.totalLectures} color="from-pink-500 to-rose-500" />
          <StatCard icon={Clock} label="Watch Time" value={`${Math.floor(systemStats.totalWatchTime / 60)}h`} color="from-yellow-500 to-orange-500" />
          <StatCard icon={Zap} label="This Week" value={systemStats.newUsersThisWeek} color="from-cyan-500 to-blue-500" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={cn("grid w-full grid-cols-6",
            theme === "dark" ? "bg-background/40" : "bg-background/60"
          )}>
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Users
            </TabsTrigger>
            <TabsTrigger value="playlists" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Playlists
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="sync" className="flex items-center gap-2">
              <Globe className="h-4 w-4" /> Sync
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" /> Settings
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className={cn("backdrop-blur-xl border",
                theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
              )}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    User Growth (Last 30 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={userGrowthData}>
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="users" stroke="hsl(var(--primary))" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className={cn("backdrop-blur-xl border",
                theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
              )}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Role Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={roleDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {roleDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-4 mt-4">
                    {roleDistribution.map((entry, index) => (
                      <div key={entry.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-sm text-muted-foreground">{entry.name}: {entry.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <QuickActionCard
                icon={UserPlus}
                title="Add User"
                description="Create a new user account"
                onClick={() => setActiveTab("users")}
                color="from-blue-500 to-cyan-500"
              />
              <QuickActionCard
                icon={BookOpen}
                title="Create Playlist"
                description="Add a new global playlist"
                onClick={() => setActiveTab("playlists")}
                color="from-purple-500 to-pink-500"
              />
              <QuickActionCard
                icon={Globe}
                title="Sync Content"
                description="Sync playlists to users"
                onClick={() => setActiveTab("sync")}
                color="from-green-500 to-emerald-500"
              />
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            {/* Bulk Actions */}
            {selectedUsers.size > 0 && (
              <Card className={cn("backdrop-blur-xl border",
                theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn("font-semibold", theme === "dark" ? "text-white" : "text-foreground")}>
                        {selectedUsers.size} user(s) selected
                      </p>
                      <p className="text-sm text-muted-foreground">Choose an action to apply</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={bulkAction} onValueChange={setBulkAction}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Select action" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="make_admin">Make Admin</SelectItem>
                          <SelectItem value="make_user">Make User</SelectItem>
                          <SelectItem value="delete">Delete Selected</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button onClick={bulkUpdateUsers} disabled={!bulkAction}>
                        Apply
                      </Button>
                      <Button variant="outline" onClick={() => setSelectedUsers(new Set())}>
                        Clear
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className={cn("backdrop-blur-xl border",
              theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
            )}>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      User Management
                    </CardTitle>
                    <CardDescription>Manage user roles, permissions, and accounts</CardDescription>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading users...</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground">No users found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredUsers.map((u) => (
                      <div
                        key={u.uid}
                        className={cn("flex items-center justify-between p-4 rounded-lg border transition-all hover:scale-[1.01]",
                          theme === "dark" ? "bg-white/5 border-white/10" : "bg-muted/30 border-border",
                          u.uid === currentUser?.uid && "ring-2 ring-primary/30"
                        )}
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={selectedUsers.has(u.uid)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUsers(prev => new Set([...prev, u.uid]));
                              } else {
                                setSelectedUsers(prev => {
                                  const next = new Set(prev);
                                  next.delete(u.uid);
                                  return next;
                                });
                              }
                            }}
                            className="w-4 h-4 rounded border-primary"
                            disabled={u.uid === currentUser?.uid}
                          />
                          <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                            <AvatarImage src={u.photoURL || ""} />
                            <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                              {u.name[0]?.toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={cn("font-semibold truncate", theme === "dark" ? "text-white" : "text-foreground")}>
                                {u.name}
                              </p>
                              {u.uid === currentUser?.uid && (
                                <Badge variant="secondary" className="text-xs">You</Badge>
                              )}
                              {u.isActive && (
                                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                                  Active
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                              {u.playlistsCount !== undefined && (
                                <span>{u.playlistsCount} playlists</span>
                              )}
                              {u.totalWatchTime !== undefined && u.totalWatchTime > 0 && (
                                <span>{Math.floor(u.totalWatchTime / 60)}h watched</span>
                              )}
                              {u.lastSignInAt && (
                                <span>
                                  Last: {u.lastSignInAt.toDate ? new Date(u.lastSignInAt.toDate()).toLocaleDateString() : "Unknown"}
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge variant={u.role === "admin" ? "default" : "secondary"} className="shrink-0">
                            {u.role === "admin" ? (
                              <><Shield className="h-3 w-3 mr-1" /> Admin</>
                            ) : (
                              <><UserCheck className="h-3 w-3 mr-1" /> User</>
                            )}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 ml-4 shrink-0">
                          <Select
                            value={u.role}
                            onValueChange={(value) => updateUserRole(u.uid, value)}
                            disabled={u.uid === currentUser?.uid}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => navigate(`/profile`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Profile
                              </DropdownMenuItem>
                              {u.uid !== currentUser?.uid && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => deleteUser(u.uid)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete User
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Playlists Tab */}
          <TabsContent value="playlists" className="space-y-4">
            {/* Create New Playlist */}
            <Card className={cn("backdrop-blur-xl border",
              theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
            )}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-primary" />
                  Create New Global Playlist
                </CardTitle>
                <CardDescription>Create playlists that can be synced to all users</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Playlist title"
                  value={newPlaylist}
                  onChange={(e) => setNewPlaylist(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createPlaylist()}
                />
                <Textarea
                  placeholder="Description (optional)"
                  value={newPlaylistDesc}
                  onChange={(e) => setNewPlaylistDesc(e.target.value)}
                  rows={2}
                />
                <Button onClick={createPlaylist} className="w-full bg-gradient-to-r from-primary to-purple-600">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Playlist
                </Button>
              </CardContent>
            </Card>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search playlists..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Playlists List */}
            {playlistLoading ? (
              <Card className={cn("backdrop-blur-xl border",
                theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
              )}>
                <CardContent className="py-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading playlists...</p>
                </CardContent>
              </Card>
            ) : filteredPlaylists.length === 0 ? (
              <Card className={cn("backdrop-blur-xl border text-center py-12",
                theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
              )}>
                <CardContent>
                  <BookOpen className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">No playlists found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredPlaylists.map((p) => (
                  <Card key={p.id} className={cn("backdrop-blur-xl border",
                    theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
                  )}>
                    <CardHeader className="flex flex-row justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <CardTitle className="flex items-center gap-2">
                            {p.title}
                            {p.isPublic && (
                              <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">
                                <Globe className="h-3 w-3 mr-1" />
                                Public
                              </Badge>
                            )}
                          </CardTitle>
                        </div>
                        <CardDescription className="mb-2">
                          {p.description || "No description"}
                        </CardDescription>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Play className="h-3 w-3" />
                            {p.lectures.length} lectures
                          </span>
                          {p.syncedToUsers !== undefined && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              Synced to {p.syncedToUsers} users
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowSyncDialog(p.id)}
                        >
                          <Globe className="h-4 w-4 mr-2" />
                          Sync
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setActivePlaylistId(activePlaylistId === p.id ? null : p.id)}
                        >
                          {activePlaylistId === p.id ? (
                            <>
                              <X className="h-4 w-4 mr-2" />
                              Cancel
                            </>
                          ) : (
                            <>
                              <Edit2 className="h-4 w-4 mr-2" />
                              Add Lecture
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => togglePlaylistPublic(p.id, p.isPublic || false)}
                        >
                          {p.isPublic ? (
                            <>
                              <EyeOff className="h-4 w-4 mr-2" />
                              Unpublish
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4 mr-2" />
                              Publish
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deletePlaylist(p.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      {p.lectures.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No lectures yet</p>
                      ) : (
                        <div className="space-y-2">
                          {p.lectures.map((l) => (
                            <div
                              key={l.id}
                              className={cn("flex justify-between items-center p-3 rounded-lg border transition-all hover:scale-[1.01]",
                                theme === "dark" ? "bg-white/5 border-white/10" : "bg-muted/30 border-border"
                              )}
                            >
                              <div className="flex-1 min-w-0">
                                <p className={cn("font-medium truncate", theme === "dark" ? "text-white" : "text-foreground")}>
                                  {l.title}
                                </p>
                                <p className="text-xs text-muted-foreground">Video ID: {l.videoId}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                                onClick={() => removeLecture(p, l.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {activePlaylistId === p.id && (
                        <div className={cn("flex gap-2 p-4 rounded-lg border",
                          theme === "dark" ? "bg-white/5 border-white/10" : "bg-muted/30 border-border"
                        )}>
                          <Input
                            placeholder="Lecture title"
                            value={lectureTitle}
                            onChange={(e) => setLectureTitle(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addLecture(p)}
                            className="flex-1"
                          />
                          <Input
                            placeholder="YouTube video ID or URL"
                            value={lectureVideo}
                            onChange={(e) => setLectureVideo(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addLecture(p)}
                            className="flex-1"
                          />
                          <Button onClick={() => addLecture(p)} className="bg-gradient-to-r from-primary to-purple-600">
                            <Check className="h-4 w-4 mr-2" />
                            Add
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className={cn("backdrop-blur-xl border",
                theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
              )}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    User Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Users</span>
                    <span className="text-2xl font-bold text-primary">{systemStats.totalUsers}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Active (Last 7 Days)</span>
                    <span className="text-2xl font-bold text-green-500">{systemStats.activeUsers}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Administrators</span>
                    <span className="text-2xl font-bold text-purple-500">{systemStats.admins}</span>
                  </div>
                  <Progress value={(systemStats.activeUsers / systemStats.totalUsers) * 100} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    {Math.round((systemStats.activeUsers / systemStats.totalUsers) * 100)}% active users
                  </p>
                </CardContent>
              </Card>

              <Card className={cn("backdrop-blur-xl border",
                theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
              )}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Content Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Playlists</span>
                    <span className="text-2xl font-bold text-orange-500">{systemStats.totalPlaylists}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Lectures</span>
                    <span className="text-2xl font-bold text-indigo-500">{systemStats.totalLectures}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Watch Time</span>
                    <span className="text-2xl font-bold text-cyan-500">
                      {Math.floor(systemStats.totalWatchTime / 60)}h {systemStats.totalWatchTime % 60}m
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Avg Lectures/Playlist</span>
                    <span className="text-2xl font-bold text-pink-500">
                      {systemStats.totalPlaylists > 0 
                        ? (systemStats.totalLectures / systemStats.totalPlaylists).toFixed(1)
                        : "0"
                      }
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Sync Tab */}
          <TabsContent value="sync" className="space-y-4">
            <Card className={cn("backdrop-blur-xl border",
              theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
            )}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  Sync Playlists to Users
                </CardTitle>
                <CardDescription>
                  Distribute global playlists to selected users or all users
                </CardDescription>
              </CardHeader>
              <CardContent>
                {playlists.length === 0 ? (
                  <div className="text-center py-12">
                    <BookOpen className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground">No playlists available to sync</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {playlists.map((p) => (
                      <div
                        key={p.id}
                        className={cn("flex items-center justify-between p-4 rounded-lg border",
                          theme === "dark" ? "bg-white/5 border-white/10" : "bg-muted/30 border-border"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={cn("font-semibold mb-1", theme === "dark" ? "text-white" : "text-foreground")}>
                            {p.title}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{p.lectures.length} lectures</span>
                            {p.syncedToUsers !== undefined && (
                              <span>Synced to {p.syncedToUsers} users</span>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={() => setShowSyncDialog(p.id)}
                          disabled={syncingPlaylist === p.id}
                        >
                          {syncingPlaylist === p.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Syncing...
                            </>
                          ) : (
                            <>
                              <Globe className="h-4 w-4 mr-2" />
                              Sync
                            </>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card className={cn("backdrop-blur-xl border",
              theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
            )}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  System Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-sync New Playlists</Label>
                    <p className="text-sm text-muted-foreground">Automatically sync new playlists to all users</p>
                  </div>
                  <Switch />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Send email when users are added or removed</p>
                  </div>
                  <Switch />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Activity Logging</Label>
                    <p className="text-sm text-muted-foreground">Log all admin actions</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Sync Dialog */}
        <Dialog open={showSyncDialog !== null} onOpenChange={(open) => !open && setShowSyncDialog(null)}>
          <DialogContent className={cn("sm:max-w-md",
            theme === "dark" ? "bg-background/95 border-white/10" : "bg-background border-border"
          )}>
            <DialogHeader>
              <DialogTitle>Sync Playlist to Users</DialogTitle>
              <DialogDescription>
                Choose which users should receive this playlist
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Target Users</Label>
                <Select defaultValue="all">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="selected">Selected Users Only</SelectItem>
                    <SelectItem value="new">New Users Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => showSyncDialog && syncPlaylistToUsers(showSyncDialog)}
                  className="flex-1"
                  disabled={syncingPlaylist !== null}
                >
                  {syncingPlaylist === showSyncDialog ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <Globe className="h-4 w-4 mr-2" />
                      Sync to All Users
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowSyncDialog(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
            <p className={cn("text-2xl font-bold truncate", theme === "dark" ? "text-white" : "text-foreground")}>
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

function QuickActionCard({ icon: Icon, title, description, onClick, color }: {
  icon: any;
  title: string;
  description: string;
  onClick: () => void;
  color: string;
}) {
  const { theme } = useTheme();
  
  return (
    <Card 
      className={cn("backdrop-blur-xl border transition-all duration-300 hover:shadow-xl hover:scale-[1.02] cursor-pointer",
        theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className={cn(`p-3 rounded-xl bg-gradient-to-br ${color} w-fit mb-4`)}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <h3 className={cn("font-semibold mb-1", theme === "dark" ? "text-white" : "text-foreground")}>
          {title}
        </h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}