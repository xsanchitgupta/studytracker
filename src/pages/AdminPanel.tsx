import { useEffect, useState, useCallback } from "react";
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
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Users,
  Play,
  Shield,
  BarChart3,
  ChevronLeft,
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
} from "lucide-react";

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
};

type User = {
  uid: string;
  email: string | null;
  name: string;
  photoURL: string | null;
  role: string;
  createdAt?: any;
  lastSignInAt?: any;
};

export default function AdminPanel() {
  const { user: currentUser, profile, isAdmin, refreshProfile } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState("users");
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

  // Load users with real-time updates
  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      query(collection(db, "users"), orderBy("createdAt", "desc")),
      (snap) => {
        const usersData = snap.docs.map(d => ({
          uid: d.id,
          ...d.data()
        } as User));
        setUsers(usersData);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading users:", error);
        toast.error("Failed to load users");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Load playlists
  const loadPlaylists = useCallback(async () => {
    setPlaylistLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "playlists_global"), orderBy("createdAt", "desc")));
      setPlaylists(
        snap.docs.map((d) => ({ 
          id: d.id, 
          ...(d.data() as Omit<Playlist, "id">) 
        }))
      );
    } catch (error) {
      console.error("Error loading playlists:", error);
      toast.error("Failed to load playlists");
    } finally {
      setPlaylistLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

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

    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "users", userId));
      toast.success("User deleted successfully");
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
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
        createdAt: new Date(),
      });
      setNewPlaylist("");
      setNewPlaylistDesc("");
      toast.success("Playlist created successfully");
      loadPlaylists();
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
      loadPlaylists();
    } catch (error) {
      console.error("Error deleting playlist:", error);
      toast.error("Failed to delete playlist");
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
      loadPlaylists();
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
      loadPlaylists();
    } catch (error) {
      console.error("Error removing lecture:", error);
      toast.error("Failed to remove lecture");
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

  // Statistics
  const stats = {
    totalUsers: users.length,
    admins: users.filter(u => u.role === "admin").length,
    regularUsers: users.filter(u => u.role === "user").length,
    totalPlaylists: playlists.length,
    totalLectures: playlists.reduce((acc, p) => acc + p.lectures.length, 0)
  };

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
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-xl transition-all duration-300",
                theme === "dark" ? "bg-primary/20" : "bg-primary/10"
              )}>
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-2xl font-bold", theme === "dark" ? "text-white" : "text-foreground")}>
                  Admin Panel
                </h1>
                <p className="text-xs text-muted-foreground">Manage users, playlists, and system settings</p>
              </div>
            </div>
          </div>
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
            <Shield className="h-3 w-3 mr-1" />
            Admin Access
          </Badge>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard icon={Users} label="Total Users" value={stats.totalUsers} color="from-blue-500 to-cyan-500" />
          <StatCard icon={Shield} label="Admins" value={stats.admins} color="from-purple-500 to-pink-500" />
          <StatCard icon={UserCheck} label="Users" value={stats.regularUsers} color="from-green-500 to-emerald-500" />
          <StatCard icon={BookOpen} label="Playlists" value={stats.totalPlaylists} color="from-orange-500 to-red-500" />
          <StatCard icon={Play} label="Lectures" value={stats.totalLectures} color="from-indigo-500 to-purple-500" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={cn("grid w-full grid-cols-3",
            theme === "dark" ? "bg-background/40" : "bg-background/60"
          )}>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Users
            </TabsTrigger>
            <TabsTrigger value="playlists" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Playlists
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Statistics
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
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
                    <CardDescription>Manage user roles and permissions</CardDescription>
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
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                            {u.lastSignInAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Last active: {u.lastSignInAt.toDate ? new Date(u.lastSignInAt.toDate()).toLocaleDateString() : "Unknown"}
                              </p>
                            )}
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
                          {u.uid !== currentUser?.uid && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => deleteUser(u.uid)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
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
                  Create New Playlist
                </CardTitle>
                <CardDescription>Add a new suggested playlist for all users</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Playlist title"
                  value={newPlaylist}
                  onChange={(e) => setNewPlaylist(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createPlaylist()}
                />
                <Input
                  placeholder="Description (optional)"
                  value={newPlaylistDesc}
                  onChange={(e) => setNewPlaylistDesc(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createPlaylist()}
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
                        <CardTitle className="flex items-center gap-2 mb-2">
                          {p.title}
                          <Badge variant="secondary">{p.lectures.length} lectures</Badge>
                        </CardTitle>
                        {p.description && (
                          <CardDescription>{p.description}</CardDescription>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
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

          {/* Statistics Tab */}
          <TabsContent value="stats" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className={cn("backdrop-blur-xl border",
                theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
              )}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    User Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Users</span>
                    <span className="text-2xl font-bold text-primary">{stats.totalUsers}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Administrators</span>
                    <span className="text-2xl font-bold text-purple-500">{stats.admins}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Regular Users</span>
                    <span className="text-2xl font-bold text-green-500">{stats.regularUsers}</span>
                  </div>
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
                    <span className="text-2xl font-bold text-orange-500">{stats.totalPlaylists}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Lectures</span>
                    <span className="text-2xl font-bold text-indigo-500">{stats.totalLectures}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Avg Lectures/Playlist</span>
                    <span className="text-2xl font-bold text-cyan-500">
                      {stats.totalPlaylists > 0 
                        ? (stats.totalLectures / stats.totalPlaylists).toFixed(1)
                        : "0"
                      }
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { 
  icon: any; 
  label: string; 
  value: number;
  color: string;
}) {
  const { theme } = useTheme();
  
  return (
    <Card className={cn("backdrop-blur-xl border transition-all duration-300 hover:shadow-xl hover:scale-[1.02] overflow-hidden",
      theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
    )}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{label}</p>
            <p className={cn("text-3xl font-bold", theme === "dark" ? "text-white" : "text-foreground")}>{value}</p>
          </div>
          <div className={cn(`p-3 rounded-xl bg-gradient-to-br ${color}`)}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}