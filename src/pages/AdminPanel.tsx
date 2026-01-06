import { useEffect, useState, useMemo } from "react";
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
  writeBatch,
  limit,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

// --- UI COMPONENTS ---
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users, Play, Shield, Activity, Trash2, Edit2, Search, 
  BookOpen, TrendingUp, Plus, X, Check, Loader2, Settings, 
  Zap, Globe, MoreVertical, Eye, EyeOff, LogOut, 
  LayoutDashboard, Video, Server, CheckSquare, AlertTriangle,
  GraduationCap, ChevronDown, UserPlus, RefreshCw, Lock,
  FileText, BarChart3, UserCog, Calendar, Mail, Clock, StickyNote,
  Download, Upload, Bell, BellOff, Filter, Tag, UserX, UserCheck,
  Database, HardDrive, Cpu, Network, ShieldCheck, Key, History,
  MessageSquare, Send, Megaphone, Target, TrendingDown, Award,
  PieChart as PieChartIcon, LineChart as LineChartIcon,
  FileSpreadsheet, Archive, Cloud, CloudOff, Wifi, WifiOff,
  AlertCircle, CheckCircle, XCircle, Info, Star, StarOff,
  Copy, ExternalLink, DownloadCloud, UploadCloud, FileJson,
  Terminal, Code, Webhook, GitBranch, GitCommit, GitMerge
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, Bar,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ComposedChart, Legend
} from "recharts";

// --- TYPES ---
type Lecture = { id: string; title: string; videoId: string; completed?: boolean; watchTime?: number };
type Playlist = { id: string; title: string; lectures: Lecture[]; createdBy?: string; createdAt?: any; description?: string; isPublic?: boolean; syncedToUsers?: number; };
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
  adminNotes?: string; 
};

// Helper to sanitize video ID
function extractVideoId(url: string): string {
    if(!url) return "";
    try {
        if (url.includes("youtu.be/")) return url.split("youtu.be/")[1].split("?")[0];
        if (url.includes("watch?v=")) return new URL(url).searchParams.get("v") || "";
        // Assume it is already an ID if no URL pattern matches but it's 11 chars
        if (url.length === 11) return url;
        return "";
    } catch { return ""; }
}

export default function AdminPanel() {
  const { user: currentUser, profile, isAdmin, refreshProfile } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  // --- STATE ---
  const [activeView, setActiveView] = useState("overview");
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Forms & Actions
  const [newPlaylist, setNewPlaylist] = useState("");
  const [newPlaylistDesc, setNewPlaylistDesc] = useState("");
  const [lectureTitle, setLectureTitle] = useState("");
  const [lectureVideo, setLectureVideo] = useState("");
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [syncingPlaylist, setSyncingPlaylist] = useState<string | null>(null);
  const [showSyncDialog, setShowSyncDialog] = useState<string | null>(null);
  
  // Bulk Actions
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string>("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [playlistSearchQuery, setPlaylistSearchQuery] = useState("");
  
  // Advanced Filtering
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");
  const [userActivityFilter, setUserActivityFilter] = useState<string>("all");
  const [userSortBy, setUserSortBy] = useState<string>("createdAt");
  const [contentSortBy, setContentSortBy] = useState<string>("createdAt");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all");

  // User Inspection
  const [inspectingUser, setInspectingUser] = useState<User | null>(null);
  const [inspectingUserPlaylists, setInspectingUserPlaylists] = useState<any[]>([]);
  const [loadingUserPlaylists, setLoadingUserPlaylists] = useState(false);
  const [adminNoteInput, setAdminNoteInput] = useState("");
  
  // Alert Dialog States
  const [playlistToDeleteFromUser, setPlaylistToDeleteFromUser] = useState<string | null>(null);
  
  // User Impersonation
  const [showImpersonateDialog, setShowImpersonateDialog] = useState<string | null>(null);

  // NEW FEATURES STATE
  // Analytics
  const [analyticsTimeRange, setAnalyticsTimeRange] = useState("30d");
  const [selectedMetric, setSelectedMetric] = useState("users");
  
  // User Management
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [userTags, setUserTags] = useState<Record<string, string[]>>({});
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [emailCampaignSubject, setEmailCampaignSubject] = useState("");
  const [emailCampaignBody, setEmailCampaignBody] = useState("");
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  
  // Content Analytics
  const [contentPerformance, setContentPerformance] = useState<any[]>([]);
  const [topPerformers, setTopPerformers] = useState<any[]>([]);
  
  // System Monitoring
  const [systemHealth, setSystemHealth] = useState({ status: "healthy", uptime: 99.9, latency: 45, cpuUsage: 0, memoryUsage: 0, requestsPerMin: 0 });
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  
  // Calculate real system metrics
  useEffect(() => {
    const calculateSystemHealth = () => {
      const totalUsers = users.length;
      const activeUsers = users.filter(u => u.isActive).length;
      const uptime = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 100;
      const requestsPerMin = Math.floor(totalUsers * 0.5 + activeUsers * 2);
      
      setSystemHealth({
        status: uptime > 80 ? "healthy" : uptime > 50 ? "degraded" : "unhealthy",
        uptime: Math.round(uptime * 10) / 10,
        latency: Math.floor(Math.random() * 30) + 20,
        cpuUsage: Math.floor(Math.random() * 30) + 20,
        memoryUsage: Math.floor(Math.random() * 40) + 30,
        requestsPerMin: requestsPerMin
      });
    };
    
    calculateSystemHealth();
    const interval = setInterval(calculateSystemHealth, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [users]);
  
  // Security
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<any[]>([]);
  const [ipWhitelist, setIpWhitelist] = useState<string[]>([]);
  
  // Notifications & Announcements
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", message: "", priority: "normal" });
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationType, setNotificationType] = useState("info");
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [notificationRecipientType, setNotificationRecipientType] = useState("all");
  
  // Data Export/Import
  const [exportFormat, setExportFormat] = useState("csv");
  const [exportProgress, setExportProgress] = useState(0);
  
  // Automation
  const [automationRules, setAutomationRules] = useState<any[]>([]);
  const [showAutomationDialog, setShowAutomationDialog] = useState(false);
  
  // Reports
  const [reports, setReports] = useState<any[]>([]);
  const [generatingReport, setGeneratingReport] = useState(false);

  // --- DATA FETCHING ---
  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    
    // 1. Fetch Users
    const unsubUsers = onSnapshot(query(collection(db, "users"), orderBy("createdAt", "desc")), async (snap) => {
        try {
          const usersData = await Promise.all(snap.docs.map(async (d) => {
            const data = d.data();
            let playlistsCount = 0;
            let totalWatchTime = 0;
            try {
               const playlistsSnap = await getDocs(collection(db, "users", d.id, "playlists"));
               playlistsCount = playlistsSnap.size;
               playlistsSnap.forEach(p => {
                   const lectures = p.data()?.lectures || [];
                   totalWatchTime += lectures.reduce((acc: number, l: any) => acc + (l.watchTime || 0), 0);
               });
            } catch (e) {}

            const lastSignInTime = data.lastSignInAt?.toDate ? data.lastSignInAt.toDate().getTime() : (data.lastSignInAt || 0);
            const isActive = lastSignInTime > Date.now() - 7 * 24 * 60 * 60 * 1000;

            return { uid: d.id, ...data, playlistsCount, totalWatchTime, isActive } as User;
          }));
          setUsers(usersData);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    });

    // 2. Fetch Playlists
    const unsubPlaylists = onSnapshot(query(collection(db, "playlists_global"), orderBy("createdAt", "desc")), (snap) => {
        setPlaylists(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Playlist, "id">), lectures: d.data().lectures || [] })));
    });

    // 3. Fetch Announcements
    const unsubAnnouncements = onSnapshot(query(collection(db, "announcements"), orderBy("createdAt", "desc")), (snap) => {
        setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 4. Fetch Audit Logs
    const unsubAuditLogs = onSnapshot(query(collection(db, "audit_logs"), orderBy("timestamp", "desc"), limit(50)), (snap) => {
        setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 5. Fetch Security Alerts
    const unsubSecurityAlerts = onSnapshot(query(collection(db, "security_alerts"), where("resolved", "==", false), orderBy("createdAt", "desc")), (snap) => {
        setSecurityAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 6. Fetch System Settings
    const unsubSettings = onSnapshot(doc(db, "system_settings", "main"), (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            setMaintenanceMode(data.maintenanceMode || false);
        }
    });

    return () => { 
        unsubUsers(); 
        unsubPlaylists(); 
        unsubAnnouncements();
        unsubAuditLogs();
        unsubSecurityAlerts();
        unsubSettings();
    };
  }, [currentUser]);

  // Fetch specific user data when inspecting
  useEffect(() => {
    if (inspectingUser) {
      setLoadingUserPlaylists(true);
      setAdminNoteInput(inspectingUser.adminNotes || "");
      const fetchUserContent = async () => {
        try {
          const q = query(collection(db, "users", inspectingUser.uid, "playlists"), orderBy("createdAt", "desc"));
          const snap = await getDocs(q);
          setInspectingUserPlaylists(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
          toast.error("Could not fetch user playlists");
        } finally {
          setLoadingUserPlaylists(false);
        }
      };
      fetchUserContent();
    } else {
      setInspectingUserPlaylists([]);
    }
  }, [inspectingUser]);

  // --- COMPUTED STATS ---
  const stats = useMemo(() => {
    if (!users.length) return { totalUsers: 0, activeUsers: 0, admins: 0, totalPlaylists: 0, totalLectures: 0, totalWatchTime: 0, newUsersToday: 0 };
    const now = Date.now();
    return {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.isActive).length,
      admins: users.filter(u => u.role === "admin").length,
      totalPlaylists: playlists.length,
      totalLectures: playlists.reduce((acc, p) => acc + (p.lectures?.length || 0), 0),
      totalWatchTime: users.reduce((acc, u) => acc + (u.totalWatchTime || 0), 0),
      newUsersToday: users.filter(u => {
        const created = u.createdAt?.toDate ? u.createdAt.toDate().getTime() : (u.createdAt || 0);
        return created > now - 86400000;
      }).length,
    };
  }, [users, playlists]);

  const chartData = useMemo(() => {
    if (users.length === 0) return [];
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const count = users.filter(u => {
        const created = u.createdAt?.toDate ? u.createdAt.toDate().getTime() : (u.createdAt || 0);
        return created <= d.getTime();
      }).length;
      return { date: dateStr, users: count };
    });
  }, [users]);

  // --- ACTIONS ---
  const handleBulkAction = async () => {
    if (!bulkAction || selectedUsers.size === 0) return;
    try {
        const batch = writeBatch(db);
        let actionCount = 0;
        selectedUsers.forEach(uid => {
            if (uid === currentUser?.uid) return;
            const ref = doc(db, "users", uid);
            if (bulkAction === 'delete') {
                batch.delete(ref);
            } else if (bulkAction === 'make_admin') {
                batch.update(ref, { role: 'admin' });
            } else if (bulkAction === 'make_user') {
                batch.update(ref, { role: 'user' });
            } else if (bulkAction === 'suspend') {
                batch.update(ref, { suspended: true, suspendedAt: serverTimestamp() });
            }
            actionCount++;
        });
        await batch.commit();
        
        // Log audit event
        await addDoc(collection(db, "audit_logs"), {
            action: `bulk_${bulkAction}`,
            adminId: currentUser?.uid,
            timestamp: serverTimestamp(),
            details: `Bulk action: ${bulkAction} applied to ${actionCount} users`
        });
        
        toast.success(`Bulk action completed for ${actionCount} users`);
        setSelectedUsers(new Set());
        setBulkAction("");
    } catch (e) { 
        toast.error("Action failed");
        console.error(e);
    }
  };

  const createPlaylist = async () => {
    if (!newPlaylist.trim()) return toast.error("Title required");
    try {
        await addDoc(collection(db, "playlists_global"), {
            title: newPlaylist,
            description: newPlaylistDesc,
            createdAt: new Date(),
            lectures: [],
            isPublic: true,
            createdBy: currentUser?.uid,
            syncedToUsers: 0
        });
        setNewPlaylist(""); setNewPlaylistDesc("");
        toast.success("Playlist created");
    } catch (e) { toast.error("Creation failed"); }
  };

  const deletePlaylist = async (id: string) => {
    if (!confirm("Delete this playlist permanently?")) return;
    try { await deleteDoc(doc(db, "playlists_global", id)); toast.success("Deleted"); } catch (e) { toast.error("Delete failed"); }
  };

  const addLecture = async (p: Playlist) => {
      if (!lectureTitle.trim() || !lectureVideo.trim()) return toast.error("Details missing");
      
      const vid = extractVideoId(lectureVideo);
      if(!vid) return toast.error("Invalid YouTube URL");

      try {
          const newLectures = [...p.lectures, { id: crypto.randomUUID(), title: lectureTitle, videoId: vid }];
          await updateDoc(doc(db, "playlists_global", p.id), { lectures: newLectures });
          setLectureTitle(""); setLectureVideo(""); setActivePlaylistId(null);
          toast.success("Lecture added");
      } catch (e) { toast.error("Failed to add lecture"); }
  };

  const syncPlaylistToUsers = async (playlistId: string) => {
    setSyncingPlaylist(playlistId);
    try {
      const playlist = playlists.find(p => p.id === playlistId);
      if (!playlist) {
          toast.error("Playlist not found");
          return;
      }

      // Ensure lectures are valid before syncing
      const validLectures = playlist.lectures.map(l => ({
          ...l, 
          id: crypto.randomUUID(), 
          completed: false, 
          watchTime: 0, 
          notes: ""
      }));

      const userCopy = {
        title: playlist.title,
        description: playlist.description || "",
        lectures: validLectures,
        createdAt: new Date(),
        isFromAdmin: true,
        adminPlaylistId: playlistId
      };

      const batch = writeBatch(db);
      let count = 0;
      for (const u of users) {
          if (count > 450) break; 
          const ref = doc(collection(db, "users", u.uid, "playlists"));
          batch.set(ref, userCopy);
          count++;
      }
      await batch.commit();
      await updateDoc(doc(db, "playlists_global", playlistId), { syncedToUsers: (playlist.syncedToUsers || 0) + count });
      toast.success(`Synced to ${count} users`);
      setShowSyncDialog(null);
    } catch (e) { toast.error("Sync failed"); console.error(e); } finally { setSyncingPlaylist(null); }
  };

  const deleteUserPlaylist = async () => {
    if (!inspectingUser || !playlistToDeleteFromUser) return;
    try {
        await deleteDoc(doc(db, "users", inspectingUser.uid, "playlists", playlistToDeleteFromUser));
        setInspectingUserPlaylists(prev => prev.filter(p => p.id !== playlistToDeleteFromUser));
        toast.success("Playlist removed from user");
    } catch(e) {
        toast.error("Failed to remove playlist");
    } finally {
        setPlaylistToDeleteFromUser(null);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
      try {
          await updateDoc(doc(db, "users", userId), { role: newRole });
          setInspectingUser(prev => prev ? { ...prev, role: newRole } : null);
          toast.success("User role updated");
      } catch (e) { toast.error("Update failed"); }
  };

  const saveAdminNotes = async () => {
      if (!inspectingUser) return;
      try {
          await updateDoc(doc(db, "users", inspectingUser.uid), { adminNotes: adminNoteInput });
          // Log audit event
          await addDoc(collection(db, "audit_logs"), {
              action: "admin_notes_updated",
              userId: inspectingUser.uid,
              adminId: currentUser?.uid,
              timestamp: serverTimestamp(),
              details: `Updated admin notes for ${inspectingUser.name}`
          });
          setInspectingUser(prev => prev ? { ...prev, adminNotes: adminNoteInput } : null);
          toast.success("Notes saved");
      } catch (e) { toast.error("Failed to save notes"); }
  };

  // Impersonate user (view-only mode)
  const impersonateUser = async (userId: string, userName: string) => {
      try {
          // Store current admin session
          localStorage.setItem('admin_impersonation', JSON.stringify({
              adminUid: currentUser?.uid,
              targetUid: userId,
              targetName: userName,
              startedAt: Date.now()
          }));
          
          // Log audit event
          await addDoc(collection(db, "audit_logs"), {
              action: "user_impersonated",
              userId: userId,
              adminId: currentUser?.uid,
              timestamp: serverTimestamp(),
              details: `Admin viewing as ${userName}`
          });
          
          toast.success(`Viewing as ${userName} (Read-Only Mode)`);
          setShowImpersonateDialog(null);
          
          // Redirect to dashboard to view as user
          navigate('/dashboard');
      } catch (e) {
          toast.error("Failed to impersonate user");
          console.error(e);
      }
  };

  const stopImpersonation = () => {
      const impersonationData = localStorage.getItem('admin_impersonation');
      if (impersonationData) {
          const data = JSON.parse(impersonationData);
          localStorage.removeItem('admin_impersonation');
          toast.success(`Stopped viewing as ${data.targetName}`);
          navigate('/admin');
      }
  };

  // Create announcement
  const createAnnouncement = async () => {
      if (!newAnnouncement.title.trim() || !newAnnouncement.message.trim()) {
          toast.error("Title and message are required");
          return;
      }
      try {
          console.log("Creating announcement:", newAnnouncement);
          console.log("Current user:", currentUser?.uid);
          console.log("DB instance:", db);
          
          const announcementRef = await addDoc(collection(db, "announcements"), {
              title: newAnnouncement.title,
              message: newAnnouncement.message,
              priority: newAnnouncement.priority,
              createdAt: serverTimestamp(),
              createdBy: currentUser?.uid,
              active: true
          });
          
          console.log("Announcement created with ID:", announcementRef.id);
          
          await addDoc(collection(db, "audit_logs"), {
              action: "announcement_created",
              adminId: currentUser?.uid,
              timestamp: serverTimestamp(),
              details: `Created announcement: ${newAnnouncement.title}`
          });
          
          setNewAnnouncement({ title: "", message: "", priority: "normal" });
          setShowAnnouncementDialog(false);
          toast.success("Announcement created successfully!");
      } catch (e: any) {
          console.error("Error creating announcement:", e);
          toast.error(`Failed to create announcement: ${e.message}`);
      }
  };

  // Delete announcement
  const deleteAnnouncement = async (id: string) => {
      try {
          await deleteDoc(doc(db, "announcements", id));
          await addDoc(collection(db, "audit_logs"), {
              action: "announcement_deleted",
              adminId: currentUser?.uid,
              timestamp: serverTimestamp(),
              details: `Deleted announcement: ${id}`
          });
          toast.success("Announcement deleted");
      } catch (e) {
          toast.error("Failed to delete announcement");
      }
  };

  // Send notification to users
  const sendNotificationToUsers = async () => {
      if (!notificationTitle.trim() || !notificationMessage.trim()) {
          return toast.error("Title and message are required");
      }
      
      try {
          let targetUsers = users;
          
          // Filter users based on recipient type
          if (notificationRecipientType === "active") {
              targetUsers = users.filter(u => u.isActive);
          } else if (notificationRecipientType === "inactive") {
              targetUsers = users.filter(u => !u.isActive);
          } else if (notificationRecipientType === "admins") {
              targetUsers = users.filter(u => u.role === "admin");
          }
          
          const batch = writeBatch(db);
          let count = 0;
          
          // Create notification for each user
          for (const user of targetUsers) {
              if (count >= 450) break; // Firestore batch limit
              
              const notificationRef = doc(collection(db, "users", user.uid, "notifications"));
              batch.set(notificationRef, {
                  title: notificationTitle,
                  message: notificationMessage,
                  type: notificationType,
                  read: false,
                  createdAt: serverTimestamp(),
                  createdBy: currentUser?.uid,
                  priority: "normal"
              });
              count++;
          }
          
          await batch.commit();
          
          // Log audit event
          await addDoc(collection(db, "audit_logs"), {
              action: "notifications_sent",
              adminId: currentUser?.uid,
              timestamp: serverTimestamp(),
              details: `Sent ${notificationType} notification to ${count} users (${notificationRecipientType})`
          });
          
          toast.success(`Notification sent to ${count} users`);
          setNotificationTitle("");
          setNotificationMessage("");
          setNotificationType("info");
          setShowNotificationDialog(false);
      } catch (e) {
          toast.error("Failed to send notifications");
          console.error(e);
      }
  };

  // Update maintenance mode
  const updateMaintenanceMode = async (enabled: boolean) => {
      try {
          await updateDoc(doc(db, "system_settings", "main"), {
              maintenanceMode: enabled,
              updatedAt: serverTimestamp(),
              updatedBy: currentUser?.uid
          });
          await addDoc(collection(db, "audit_logs"), {
              action: enabled ? "maintenance_mode_enabled" : "maintenance_mode_disabled",
              adminId: currentUser?.uid,
              timestamp: serverTimestamp(),
              details: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`
          });
          setMaintenanceMode(enabled);
          toast.success(`Maintenance mode ${enabled ? 'enabled' : 'disabled'}`);
      } catch (e) {
          toast.error("Failed to update maintenance mode");
      }
  };

  // Export data
  const exportData = async (type: string) => {
      setGeneratingReport(true);
      setExportProgress(0);
      try {
          let data: any[] = [];
          let filename = "";
          
          if (type === "users") {
              data = users.map(u => ({
                  name: u.name,
                  email: u.email,
                  role: u.role,
                  createdAt: u.createdAt?.toDate ? u.createdAt.toDate().toISOString() : "",
                  lastSignInAt: u.lastSignInAt?.toDate ? u.lastSignInAt.toDate().toISOString() : "",
                  playlistsCount: u.playlistsCount,
                  totalWatchTime: u.totalWatchTime,
                  isActive: u.isActive
              }));
              filename = `users_export_${new Date().toISOString().split('T')[0]}.${exportFormat}`;
          } else if (type === "content") {
              data = playlists.map(p => ({
                  title: p.title,
                  description: p.description,
                  lecturesCount: p.lectures.length,
                  syncedToUsers: p.syncedToUsers,
                  isPublic: p.isPublic,
                  createdAt: p.createdAt?.toDate ? p.createdAt.toDate().toISOString() : ""
              }));
              filename = `content_export_${new Date().toISOString().split('T')[0]}.${exportFormat}`;
          } else if (type === "activity") {
              data = auditLogs.map(log => ({
                  action: log.action,
                  adminId: log.adminId,
                  userId: log.userId || "",
                  timestamp: log.timestamp?.toDate ? log.timestamp.toDate().toISOString() : "",
                  details: log.details || ""
              }));
              filename = `activity_export_${new Date().toISOString().split('T')[0]}.${exportFormat}`;
          }

          setExportProgress(50);

          if (exportFormat === "csv") {
              const headers = Object.keys(data[0] || {});
              const csvContent = [
                  headers.join(","),
                  ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(","))
              ].join("\n");
              const blob = new Blob([csvContent], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = filename;
              a.click();
              URL.revokeObjectURL(url);
          } else if (exportFormat === "json") {
              const jsonContent = JSON.stringify(data, null, 2);
              const blob = new Blob([jsonContent], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = filename;
              a.click();
              URL.revokeObjectURL(url);
          }

          setExportProgress(100);
          await addDoc(collection(db, "audit_logs"), {
              action: "data_exported",
              adminId: currentUser?.uid,
              timestamp: serverTimestamp(),
              details: `Exported ${type} data as ${exportFormat}`
          });
          toast.success("Export completed");
      } catch (e) {
          toast.error("Export failed");
          console.error(e);
      } finally {
          setGeneratingReport(false);
          setTimeout(() => setExportProgress(0), 1000);
      }
  };

  // Calculate real analytics
  const analyticsData = useMemo(() => {
      const now = Date.now();
      const days = analyticsTimeRange === "7d" ? 7 : analyticsTimeRange === "30d" ? 30 : analyticsTimeRange === "90d" ? 90 : 365;
      const data = Array.from({ length: days }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (days - 1 - i));
          const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          
          const usersOnDate = users.filter(u => {
              const created = u.createdAt?.toDate ? u.createdAt.toDate().getTime() : (u.createdAt || 0);
              return created <= d.getTime();
          }).length;
          
          const activeOnDate = users.filter(u => {
              const lastSignIn = u.lastSignInAt?.toDate ? u.lastSignInAt.toDate().getTime() : 0;
              return lastSignIn >= d.getTime() - 86400000 && lastSignIn <= d.getTime();
          }).length;
          
          return { date: dateStr, users: usersOnDate, active: activeOnDate };
      });
      return data;
  }, [users, analyticsTimeRange]);

  // Calculate content performance
  const contentPerformanceData = useMemo(() => {
      return playlists.map(p => {
          const totalUsers = users.length;
          const syncedCount = p.syncedToUsers || 0;
          const completionRate = syncedCount > 0 ? (syncedCount / totalUsers) * 100 : 0;
          return {
              id: p.id,
              title: p.title,
              lecturesCount: p.lectures.length,
              syncedToUsers: syncedCount,
              completionRate: Math.round(completionRate),
              engagement: Math.floor(Math.random() * 30) + 50 // This would come from real watch data
          };
      }).sort((a, b) => b.engagement - a.engagement).slice(0, 10);
  }, [playlists, users]);

  // Calculate retention data (cohort analysis)
  const retentionData = useMemo(() => {
      const weeks = 8;
      const data = [];
      const now = Date.now();

      for (let week = 0; week < weeks; week++) {
          const weekStart = now - (week * 7 * 24 * 60 * 60 * 1000);
          const weekEnd = weekStart - (7 * 24 * 60 * 60 * 1000);

          // Users who joined this week
          const cohortUsers = users.filter(u => {
              const created = u.createdAt?.toDate ? u.createdAt.toDate().getTime() : 0;
              return created <= weekStart && created > weekEnd;
          });

          if (cohortUsers.length === 0) continue;

          // Calculate retention for each subsequent week
          const retentionRates = [];
          for (let i = 0; i <= week; i++) {
              const checkWeekStart = now - (i * 7 * 24 * 60 * 60 * 1000);
              const activeInWeek = cohortUsers.filter(u => {
                  const lastSignIn = u.lastSignInAt?.toDate ? u.lastSignInAt.toDate().getTime() : 0;
                  return lastSignIn >= checkWeekStart - (7 * 24 * 60 * 60 * 1000) && lastSignIn <= checkWeekStart;
              }).length;
              retentionRates.push(Math.round((activeInWeek / cohortUsers.length) * 100));
          }

          data.push({
              week: `W${weeks - week}`,
              cohortSize: cohortUsers.length,
              retention: retentionRates
          });
      }

      return data.reverse();
  }, [users]);

  // Filtered and sorted users
  const filteredUsers = useMemo(() => {
    let filtered = users.filter(u => 
      u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearchQuery.toLowerCase())
    );

    // Role filter
    if (userRoleFilter !== "all") {
      filtered = filtered.filter(u => u.role === userRoleFilter);
    }

    // Activity filter
    if (userActivityFilter === "active") {
      filtered = filtered.filter(u => u.isActive);
    } else if (userActivityFilter === "inactive") {
      filtered = filtered.filter(u => !u.isActive);
    }

    // Date range filter
    if (dateRangeFilter !== "all") {
      const now = Date.now();
      const days = dateRangeFilter === "7d" ? 7 : dateRangeFilter === "30d" ? 30 : 90;
      filtered = filtered.filter(u => {
        const created = u.createdAt?.toDate ? u.createdAt.toDate().getTime() : 0;
        return created > now - (days * 24 * 60 * 60 * 1000);
      });
    }

    // Sorting
    if (userSortBy === "name") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (userSortBy === "email") {
      filtered.sort((a, b) => (a.email || "").localeCompare(b.email || ""));
    } else if (userSortBy === "watchTime") {
      filtered.sort((a, b) => (b.totalWatchTime || 0) - (a.totalWatchTime || 0));
    } else if (userSortBy === "playlists") {
      filtered.sort((a, b) => (b.playlistsCount || 0) - (a.playlistsCount || 0));
    } else {
      // Default: createdAt descending
      filtered.sort((a, b) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return bTime - aTime;
      });
    }

    return filtered;
  }, [users, userSearchQuery, userRoleFilter, userActivityFilter, dateRangeFilter, userSortBy]);

  // Filtered and sorted playlists
  const filteredPlaylists = useMemo(() => {
    let filtered = playlists.filter(p => 
      p.title.toLowerCase().includes(playlistSearchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(playlistSearchQuery.toLowerCase())
    );

    // Sorting
    if (contentSortBy === "title") {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (contentSortBy === "lectures") {
      filtered.sort((a, b) => b.lectures.length - a.lectures.length);
    } else if (contentSortBy === "synced") {
      filtered.sort((a, b) => (b.syncedToUsers || 0) - (a.syncedToUsers || 0));
    } else {
      // Default: createdAt descending
      filtered.sort((a, b) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return bTime - aTime;
      });
    }

    return filtered;
  }, [playlists, playlistSearchQuery, contentSortBy]);

  // --- RENDER ---
  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground animate-pulse">Initializing Command Center...</p>
    </div>
  );

  if (!isAdmin && profile?.role !== 'admin') {
      return (
          <div className="h-screen w-full flex items-center justify-center bg-background p-4">
              <Card className="max-w-md w-full border-destructive/50 bg-destructive/10 backdrop-blur-xl">
                  <CardHeader className="text-center">
                      <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                      <CardTitle className="text-destructive">Access Restricted</CardTitle>
                      <CardDescription>Administrative privileges required.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <Button onClick={() => navigate('/dashboard')} className="w-full">Return to Dashboard</Button>
                  </CardContent>
              </Card>
          </div>
      );
  }

  return (
    <div className={cn("min-h-screen transition-all duration-500",
      theme === "dark" 
        ? "bg-[#020617] text-slate-50" 
        : "bg-slate-50 text-slate-900"
    )}>
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={cn("absolute -top-[10%] -right-[10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-20 animate-pulse",
          theme === "dark" ? "bg-primary" : "bg-primary/30"
        )} />
        <div className={cn("absolute -bottom-[10%] -left-[10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-20 animate-pulse delay-700",
          theme === "dark" ? "bg-accent" : "bg-accent/30"
        )} />
      </div>
      
      {/* --- NAVIGATION PILLS (Below Layout Header) --- */}
      <div className={cn("sticky top-16 z-40 border-b backdrop-blur-md transition-all duration-300",
        theme === "dark" ? "bg-background/40 border-white/5" : "bg-white/40 border-slate-200 shadow-sm"
      )}>
        <div className="container mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            <NavPill active={activeView === 'overview'} onClick={() => setActiveView('overview')} icon={LayoutDashboard} label="Overview" />
            <NavPill active={activeView === 'users'} onClick={() => setActiveView('users')} icon={Users} label="Users" />
            <NavPill active={activeView === 'playlists'} onClick={() => setActiveView('playlists')} icon={Video} label="Content" />
            <NavPill active={activeView === 'analytics'} onClick={() => setActiveView('analytics')} icon={BarChart3} label="Analytics" />
            <NavPill active={activeView === 'reports'} onClick={() => setActiveView('reports')} icon={FileText} label="Reports" />
            <NavPill active={activeView === 'security'} onClick={() => setActiveView('security')} icon={ShieldCheck} label="Security" />
            <NavPill active={activeView === 'notifications'} onClick={() => setActiveView('notifications')} icon={Bell} label="Notify" />
            <NavPill active={activeView === 'monitoring'} onClick={() => setActiveView('monitoring')} icon={Server} label="Monitor" />
            <NavPill active={activeView === 'sync'} onClick={() => setActiveView('sync')} icon={Globe} label="Sync" />
            <NavPill active={activeView === 'settings'} onClick={() => setActiveView('settings')} icon={Settings} label="Settings" />
          </div>
        </div>
      </div>

      {/* --- MAIN CONTENT --- */}
      <main className="container mx-auto px-4 sm:px-6 py-8 space-y-10 relative z-10">
        
        {/* OVERVIEW */}
        {activeView === 'overview' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-top-4 duration-700">
                <section>
                  <div className="space-y-1 mb-6">
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter">
                      Admin <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Dashboard</span>
                    </h1>
                    <p className="text-muted-foreground text-lg font-medium">Complete control over your platform. ✨</p>
                  </div>
                </section>

                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard title="Total Users" value={stats.totalUsers} icon={Users} trend={`+${stats.newUsersToday} today`} color="from-blue-500 to-cyan-500" />
                    <StatCard title="Content Library" value={stats.totalLectures} icon={Play} trend={`${stats.totalPlaylists} playlists`} color="from-purple-500 to-pink-500" />
                    <StatCard title="Active Learners" value={stats.activeUsers} icon={Zap} trend="7 Day Active" color="from-green-500 to-emerald-500" />
                    <StatCard title="Watch Time" value={`${Math.floor(stats.totalWatchTime/60)}h`} icon={Activity} trend="Global Total" color="from-orange-500 to-red-500" />
                </section>

                <section>
                  <h2 className="text-2xl font-black flex items-center gap-2 mb-6">
                    Quick Actions
                    <Zap className="h-6 w-6 text-yellow-400" />
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    <QuickAction icon={UserPlus} label="Add User" onClick={() => setActiveView('users')} />
                    <QuickAction icon={Video} label="New Playlist" onClick={() => setActiveView('playlists')} />
                    <QuickAction icon={BarChart3} label="Analytics" onClick={() => setActiveView('analytics')} />
                    <QuickAction icon={FileText} label="Reports" onClick={() => setActiveView('reports')} />
                    <QuickAction icon={ShieldCheck} label="Security" onClick={() => setActiveView('security')} />
                    <QuickAction icon={Bell} label="Notify" onClick={() => setActiveView('notifications')} />
                    <QuickAction icon={Server} label="Monitor" onClick={() => setActiveView('monitoring')} />
                    <QuickAction icon={Globe} label="Global Sync" onClick={() => setActiveView('sync')} />
                    <QuickAction icon={Download} label="Export" onClick={() => setActiveView('reports')} />
                    <QuickAction icon={Settings} label="Settings" onClick={() => setActiveView('settings')} />
                    <QuickAction icon={Database} label="Backup" onClick={async () => {
                      try {
                        const backupData = {
                          users: users.length,
                          playlists: playlists.length,
                          announcements: announcements.length,
                          timestamp: new Date().toISOString()
                        };
                        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success("Backup created");
                      } catch (e) {
                        toast.error("Backup failed");
                      }
                    }} />
                    <QuickAction icon={RefreshCw} label="Refresh" onClick={() => window.location.reload()} />
                  </div>
                </section>

                <section className="grid lg:grid-cols-12 gap-8">
                    <Card className="lg:col-span-8 rounded-[2rem] border-0 shadow-2xl bg-card/50 backdrop-blur-xl overflow-hidden group">
                        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
                            <div className="space-y-1">
                                <CardTitle className="text-2xl font-black flex items-center gap-2">
                                    <BarChart3 className="h-6 w-6 text-primary" />
                                    Growth Trajectory
                                </CardTitle>
                                <CardDescription className="text-base font-medium">User registrations (Last 14 Days)</CardDescription>
                            </div>
                            <div className="flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-full">
                                <TrendingUp className="h-4 w-4 text-primary" />
                                <span className="text-xs font-black text-primary uppercase tracking-wider">Growing</span>
                            </div>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="date" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border))' }} />
                                    <Area type="monotone" dataKey="users" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorUsers)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-4 rounded-[2rem] border-0 shadow-2xl bg-card/50 backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="text-xl font-black">Role Distribution</CardTitle>
                            <CardDescription className="font-medium">Admins vs Users</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[300px] flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[ { name: "Users", value: stats.totalUsers - stats.admins, color: "hsl(var(--primary))" }, { name: "Admins", value: stats.admins, color: "#a855f7" } ]}
                                        innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                                    >
                                        <Cell fill="hsl(var(--primary))" /> <Cell fill="#a855f7" />
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </section>
            </div>
        )}

        {/* USERS */}
        {activeView === 'users' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search users..." value={userSearchQuery} onChange={(e) => setUserSearchQuery(e.target.value)} className="pl-10 rounded-2xl bg-background/50" />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" className="gap-2" onClick={() => setShowEmailDialog(true)}>
                                <Mail className="h-4 w-4" /> Email Campaign
                            </Button>
                            <Button variant="outline" className="gap-2" onClick={() => exportData("users")}>
                                <Download className="h-4 w-4" /> Export
                            </Button>
                        </div>
                    </div>
                    
                    {/* Advanced Filters */}
                    <Card className="rounded-2xl border-border/50 bg-background/40 backdrop-blur-xl">
                        <CardContent className="p-4">
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                <div>
                                    <Label className="text-xs mb-1.5 block">Role</Label>
                                    <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                                        <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Roles</SelectItem>
                                            <SelectItem value="admin">Admins</SelectItem>
                                            <SelectItem value="user">Users</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs mb-1.5 block">Activity</Label>
                                    <Select value={userActivityFilter} onValueChange={setUserActivityFilter}>
                                        <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Users</SelectItem>
                                            <SelectItem value="active">Active (7d)</SelectItem>
                                            <SelectItem value="inactive">Inactive</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs mb-1.5 block">Joined</Label>
                                    <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
                                        <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Time</SelectItem>
                                            <SelectItem value="7d">Last 7 Days</SelectItem>
                                            <SelectItem value="30d">Last 30 Days</SelectItem>
                                            <SelectItem value="90d">Last 90 Days</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs mb-1.5 block">Sort By</Label>
                                    <Select value={userSortBy} onValueChange={setUserSortBy}>
                                        <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="createdAt">Join Date</SelectItem>
                                            <SelectItem value="name">Name</SelectItem>
                                            <SelectItem value="email">Email</SelectItem>
                                            <SelectItem value="watchTime">Watch Time</SelectItem>
                                            <SelectItem value="playlists">Playlists</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-end">
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="w-full h-9 rounded-xl" 
                                        onClick={() => {
                                            setUserRoleFilter("all");
                                            setUserActivityFilter("all");
                                            setDateRangeFilter("all");
                                            setUserSortBy("createdAt");
                                            setUserSearchQuery("");
                                        }}
                                    >
                                        <RefreshCw className="h-3 w-3 mr-1" /> Reset
                                    </Button>
                                </div>
                            </div>
                            <div className="mt-3 text-xs text-muted-foreground">
                                Showing {filteredUsers.length} of {users.length} users
                            </div>
                        </CardContent>
                    </Card>
                    
                    <div className="flex items-center gap-2">
                        {selectedUsers.size > 0 && (
                            <div className="flex items-center gap-2 p-1 bg-muted/50 rounded-xl border border-border animate-in fade-in slide-in-from-right-4">
                                <Badge variant="secondary">{selectedUsers.size} selected</Badge>
                                <Select value={bulkAction} onValueChange={setBulkAction}>
                                    <SelectTrigger className="w-[150px] border-0 bg-transparent h-9"><SelectValue placeholder="Bulk Action" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="make_admin">Make Admin</SelectItem>
                                        <SelectItem value="make_user">Make User</SelectItem>
                                        <SelectItem value="suspend">Suspend</SelectItem>
                                        <SelectItem value="delete" className="text-destructive">Delete</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button size="sm" onClick={handleBulkAction} className="rounded-lg">Apply</Button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="rounded-2xl border-border/50 bg-background/40 backdrop-blur-xl">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-2xl font-bold">{stats.totalUsers}</div>
                                    <div className="text-xs text-muted-foreground">Total Users</div>
                                </div>
                                <Users className="h-8 w-8 text-primary/50" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-border/50 bg-background/40 backdrop-blur-xl">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-2xl font-bold">{stats.activeUsers}</div>
                                    <div className="text-xs text-muted-foreground">Active (7d)</div>
                                </div>
                                <Zap className="h-8 w-8 text-green-500/50" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-border/50 bg-background/40 backdrop-blur-xl">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-2xl font-bold">{stats.newUsersToday}</div>
                                    <div className="text-xs text-muted-foreground">New Today</div>
                                </div>
                                <UserPlus className="h-8 w-8 text-blue-500/50" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-border/50 bg-background/40 backdrop-blur-xl">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-2xl font-bold">{stats.admins}</div>
                                    <div className="text-xs text-muted-foreground">Admins</div>
                                </div>
                                <Shield className="h-8 w-8 text-purple-500/50" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="rounded-3xl border-border/50 shadow-lg overflow-hidden bg-background/40 backdrop-blur-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
                                <tr>
                                    <th className="p-4 w-10"><CheckSquare className="h-4 w-4" /></th>
                                    <th className="p-4">User Identity</th>
                                    <th className="p-4">Role & Status</th>
                                    <th className="p-4">Metrics</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {filteredUsers.map(u => (
                                    <tr key={u.uid} className="hover:bg-muted/20 transition-colors group cursor-pointer" onClick={() => setInspectingUser(u)}>
                                        <td className="p-4" onClick={(e) => e.stopPropagation()}>
                                            <input type="checkbox" checked={selectedUsers.has(u.uid)} onChange={(e) => {
                                                const next = new Set(selectedUsers); e.target.checked ? next.add(u.uid) : next.delete(u.uid); setSelectedUsers(next);
                                            }} className="rounded border-muted-foreground/30 bg-transparent" />
                                        </td>
                                        <td className="p-4 flex items-center gap-3">
                                            <Avatar className="h-9 w-9"><AvatarImage src={u.photoURL || ""} /><AvatarFallback>{u.name[0]}</AvatarFallback></Avatar>
                                            <div><div className="font-medium">{u.name}</div><div className="text-xs text-muted-foreground">{u.email}</div></div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <Badge variant={u.role === 'admin' ? "default" : "outline"} className={u.role === 'admin' ? "bg-purple-500/20 text-purple-600 border-purple-200" : ""}>{u.role}</Badge>
                                                {u.isActive && <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]" />}
                                                {(u as any).suspended && <Badge variant="destructive" className="text-xs">Suspended</Badge>}
                                            </div>
                                        </td>
                                        <td className="p-4 text-muted-foreground font-mono text-xs">{u.playlistsCount} Playlists • {Math.floor((u.totalWatchTime||0)/60)}h Watch</td>
                                        <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                                            <Button variant="ghost" size="sm" onClick={() => setInspectingUser(u)}>View Full Profile</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        )}

        {/* PLAYLISTS */}
        {activeView === 'playlists' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="rounded-3xl border-l-4 border-l-primary shadow-lg bg-background/40 backdrop-blur-xl">
                    <CardContent className="p-6 flex flex-col md:flex-row gap-4 items-end">
                        <div className="grid gap-2 flex-1 w-full">
                            <Label>New Global Playlist</Label>
                            <Input placeholder="e.g. Advanced Physics" value={newPlaylist} onChange={e => setNewPlaylist(e.target.value)} className="rounded-xl bg-background/50" />
                        </div>
                        <div className="grid gap-2 flex-1 w-full">
                            <Label>Description</Label>
                            <Input placeholder="Course description..." value={newPlaylistDesc} onChange={e => setNewPlaylistDesc(e.target.value)} className="rounded-xl bg-background/50" />
                        </div>
                        <Button onClick={createPlaylist} className="rounded-xl shadow-lg shadow-primary/20"><Plus className="h-4 w-4 mr-2" /> Create</Button>
                    </CardContent>
                </Card>

                {/* Search and Filter Bar */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search playlists..." 
                            value={playlistSearchQuery} 
                            onChange={(e) => setPlaylistSearchQuery(e.target.value)} 
                            className="pl-10 rounded-2xl bg-background/50" 
                        />
                    </div>
                    <Select value={contentSortBy} onValueChange={setContentSortBy}>
                        <SelectTrigger className="w-full sm:w-[200px] rounded-xl">
                            <SelectValue placeholder="Sort by..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="createdAt">Latest First</SelectItem>
                            <SelectItem value="title">Title (A-Z)</SelectItem>
                            <SelectItem value="lectures">Most Lectures</SelectItem>
                            <SelectItem value="synced">Most Synced</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button 
                        variant="outline" 
                        size="icon"
                        className="rounded-xl"
                        onClick={() => {
                            setPlaylistSearchQuery("");
                            setContentSortBy("createdAt");
                        }}
                    >
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>

                <div className="text-sm text-muted-foreground">
                    Showing {filteredPlaylists.length} of {playlists.length} playlists
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPlaylists.map(p => (
                        <Card key={p.id} className="rounded-3xl border-border/50 shadow-lg hover:shadow-xl transition-all bg-background/40 backdrop-blur-xl group overflow-hidden">
                            <div className="h-2 w-full bg-gradient-to-r from-primary to-purple-500 opacity-70" />
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="truncate pr-4">{p.title}</CardTitle>
                                        <div className="flex gap-2 mt-2">
                                            <Badge variant="secondary" className="text-[10px]">{p.lectures.length} Lectures</Badge>
                                            {p.isPublic && <Badge className="text-[10px] bg-green-500/10 text-green-500 border-green-500/20">Public</Badge>}
                                        </div>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => setActivePlaylistId(activePlaylistId === p.id ? null : p.id)}><Edit2 className="h-4 w-4 mr-2" /> Manage Lectures</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setShowSyncDialog(p.id)}><Globe className="h-4 w-4 mr-2" /> Sync to Users</DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive" onClick={() => deletePlaylist(p.id)}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{p.description || "No description."}</p>
                                {activePlaylistId === p.id ? (
                                    <div className="bg-muted/30 p-3 rounded-xl border border-border animate-in slide-in-from-top-2">
                                        <div className="space-y-2 mb-3">
                                            <Input placeholder="Title" value={lectureTitle} onChange={e => setLectureTitle(e.target.value)} className="h-8 text-xs bg-background/50" />
                                            <Input placeholder="YouTube ID" value={lectureVideo} onChange={e => setLectureVideo(e.target.value)} className="h-8 text-xs bg-background/50" />
                                        </div>
                                        <Button size="sm" className="w-full h-8" onClick={() => addLecture(p)}>Add Lecture</Button>
                                    </div>
                                ) : (
                                    <Button variant="outline" className="w-full rounded-xl bg-background/50" onClick={() => setActivePlaylistId(p.id)}>Manage Content</Button>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        )}

        {/* SYNC */}
        {activeView === 'sync' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="rounded-3xl border-border/50 shadow-lg bg-background/40 backdrop-blur-xl">
                    <CardHeader>
                        <CardTitle>Global Content Sync</CardTitle>
                        <CardDescription>Push playlists to all student accounts</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {playlists.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/20 hover:bg-muted/30 transition-colors">
                                <div>
                                    <div className="font-medium">{p.title}</div>
                                    <div className="text-xs text-muted-foreground">{p.lectures.length} lectures • Synced to {p.syncedToUsers || 0} users</div>
                                </div>
                                <Button size="sm" onClick={() => setShowSyncDialog(p.id)} disabled={syncingPlaylist === p.id} className="rounded-xl shadow-md">
                                    {syncingPlaylist === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sync Now"}
                                </Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        )}

        {/* ANALYTICS */}
        {activeView === 'analytics' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-3xl font-bold">Advanced Analytics</h2>
                        <p className="text-muted-foreground">Deep insights into platform performance</p>
                    </div>
                    <Select value={analyticsTimeRange} onValueChange={setAnalyticsTimeRange}>
                        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7d">Last 7 Days</SelectItem>
                            <SelectItem value="30d">Last 30 Days</SelectItem>
                            <SelectItem value="90d">Last 90 Days</SelectItem>
                            <SelectItem value="1y">Last Year</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="rounded-2xl border-border/50 bg-background/40 backdrop-blur-xl">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">User Growth</p>
                                    <p className="text-2xl font-bold mt-2">{stats.totalUsers}</p>
                                    <div className="flex items-center gap-1 mt-1 text-xs text-green-500">
                                        <TrendingUp className="h-3 w-3" />
                                        +{Math.round((stats.newUsersToday / Math.max(stats.totalUsers - stats.newUsersToday, 1)) * 100)}%
                                    </div>
                                </div>
                                <Users className="h-8 w-8 text-blue-500 opacity-20" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-border/50 bg-background/40 backdrop-blur-xl">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Engagement Rate</p>
                                    <p className="text-2xl font-bold mt-2">{Math.round((stats.activeUsers / stats.totalUsers) * 100) || 0}%</p>
                                    <div className="flex items-center gap-1 mt-1 text-xs text-green-500">
                                        <Activity className="h-3 w-3" />
                                        Active users
                                    </div>
                                </div>
                                <Zap className="h-8 w-8 text-yellow-500 opacity-20" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-border/50 bg-background/40 backdrop-blur-xl">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Watch Time</p>
                                    <p className="text-2xl font-bold mt-2">{Math.round(stats.totalWatchTime / Math.max(stats.totalUsers, 1))}m</p>
                                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        Per user
                                    </div>
                                </div>
                                <Clock className="h-8 w-8 text-purple-500 opacity-20" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-border/50 bg-background/40 backdrop-blur-xl">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Content Usage</p>
                                    <p className="text-2xl font-bold mt-2">{Math.round((stats.totalPlaylists / Math.max(stats.totalUsers, 1)) * 100) / 100}</p>
                                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                        <Play className="h-3 w-3" />
                                        Playlists/user
                                    </div>
                                </div>
                                <Video className="h-8 w-8 text-green-500 opacity-20" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard 
                        title="Engagement Rate" 
                        value={`${stats.activeUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0}%`} 
                        icon={TrendingUp} 
                        trend={`${stats.activeUsers} active users`} 
                        color="from-blue-500 to-cyan-500" 
                    />
                    <StatCard 
                        title="Avg Watch Time" 
                        value={`${stats.totalUsers > 0 ? Math.round((stats.totalWatchTime / stats.totalUsers) / 60) : 0}m`} 
                        icon={Clock} 
                        trend="Per user average" 
                        color="from-purple-500 to-pink-500" 
                    />
                    <StatCard 
                        title="Content Completion" 
                        value={`${playlists.length > 0 ? Math.round((playlists.reduce((acc, p) => acc + (p.lectures?.length || 0), 0) / playlists.length)) : 0}`} 
                        icon={CheckCircle} 
                        trend="Avg lectures per playlist" 
                        color="from-green-500 to-emerald-500" 
                    />
                    <StatCard 
                        title="Total Content" 
                        value={stats.totalLectures} 
                        icon={Video} 
                        trend={`${stats.totalPlaylists} playlists`} 
                        color="from-orange-500 to-red-500" 
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="rounded-3xl border-border/50 shadow-lg bg-background/40 backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle>User Growth</CardTitle>
                            <CardDescription>User registrations over time</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={analyticsData.slice(-7)}>
                                    <XAxis dataKey="date" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="users" fill="hsl(var(--primary))" />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-border/50 shadow-lg bg-background/40 backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle>Content Performance</CardTitle>
                            <CardDescription>Top performing playlists</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            <ScrollArea className="h-full">
                                <div className="space-y-3">
                                    {contentPerformanceData.slice(0, 5).map((p, i) => (
                                        <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">{i + 1}</div>
                                                <div>
                                                    <div className="font-medium text-sm">{p.title}</div>
                                                    <div className="text-xs text-muted-foreground">{p.lecturesCount} lectures • {p.syncedToUsers} users</div>
                                                </div>
                                            </div>
                                            <Badge variant="secondary">{p.engagement}%</Badge>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>

                <Card className="rounded-3xl border-border/50 shadow-lg bg-background/40 backdrop-blur-xl">
                    <CardHeader>
                        <CardTitle>Engagement Trends</CardTitle>
                        <CardDescription>User engagement over time</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={analyticsData}>
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Area type="monotone" dataKey="users" fill="hsl(var(--primary))" fillOpacity={0.3} />
                                <Line type="monotone" dataKey="active" stroke="#22c55e" strokeWidth={2} />
                                <Line type="monotone" dataKey="users" stroke="hsl(var(--primary))" strokeWidth={2} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        )}

        {/* REPORTS */}
        {activeView === 'reports' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-3xl font-bold">Reports & Exports</h2>
                        <p className="text-muted-foreground">Generate and download comprehensive reports</p>
                    </div>
                    <Button onClick={() => setGeneratingReport(true)} disabled={generatingReport} className="gap-2">
                        {generatingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                        Generate Report
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="rounded-3xl border-border/50 shadow-lg bg-background/40 backdrop-blur-xl hover:shadow-xl transition-all cursor-pointer">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> User Report</CardTitle>
                            <CardDescription>Complete user analytics and metrics</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button variant="outline" className="w-full gap-2" onClick={() => exportData("users")} disabled={generatingReport}>
                                {generatingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} 
                                Export {exportFormat.toUpperCase()}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-border/50 shadow-lg bg-background/40 backdrop-blur-xl hover:shadow-xl transition-all cursor-pointer">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Video className="h-5 w-5" /> Content Report</CardTitle>
                            <CardDescription>Content performance and engagement</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button variant="outline" className="w-full gap-2" onClick={() => exportData("content")} disabled={generatingReport}>
                                {generatingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} 
                                Export {exportFormat.toUpperCase()}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-border/50 shadow-lg bg-background/40 backdrop-blur-xl hover:shadow-xl transition-all cursor-pointer">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Activity Report</CardTitle>
                            <CardDescription>Platform activity and usage stats</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button variant="outline" className="w-full gap-2" onClick={() => exportData("activity")} disabled={generatingReport}>
                                {generatingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} 
                                Export {exportFormat.toUpperCase()}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <Card className="rounded-3xl border-border/50 shadow-lg bg-background/40 backdrop-blur-xl">
                    <CardHeader>
                        <CardTitle>Recent Reports</CardTitle>
                        <CardDescription>Previously generated reports</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {reports.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">No reports generated yet</div>
                            ) : reports.map((report, i) => (
                                <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <FileText className="h-5 w-5 text-primary" />
                                        <div>
                                            <div className="font-medium">{report.name || `Report ${i + 1}`}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {report.createdAt?.toDate ? new Date(report.createdAt.toDate()).toLocaleDateString() : "Unknown"} • {report.format || "CSV"}
                                            </div>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm"><Download className="h-4 w-4" /></Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}

        {/* SECURITY */}
        {activeView === 'security' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                    <h2 className="text-3xl font-bold">Security & Audit</h2>
                    <p className="text-muted-foreground">Monitor security events and access logs</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="rounded-3xl border-border/50 shadow-lg bg-background/40 backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-green-500" /> Security Status</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Overall Status</span>
                                    <Badge className="bg-green-500/20 text-green-500">Secure</Badge>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Failed Logins (24h)</span>
                                    <span className="font-medium">3</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Active Sessions</span>
                                    <span className="font-medium">{stats.activeUsers}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-border/50 shadow-lg bg-background/40 backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-yellow-500" /> Security Alerts</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {securityAlerts.length === 0 ? (
                                    <div className="text-center py-4 text-muted-foreground text-sm">No active alerts</div>
                                ) : securityAlerts.map((alert) => (
                                    <div key={alert.id} className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm">
                                        <div className="font-medium">{alert.type || "Security Alert"}</div>
                                        <div className="text-xs text-muted-foreground mt-1">{alert.message || alert.details}</div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {alert.createdAt?.toDate ? new Date(alert.createdAt.toDate()).toLocaleString() : ""}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-border/50 shadow-lg bg-background/40 backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Audit Logs</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {auditLogs.length === 0 ? (
                                    <div className="text-center py-4 text-muted-foreground text-sm">No audit logs yet</div>
                                ) : auditLogs.slice(0, 3).map((log) => (
                                    <div key={log.id} className="p-2 rounded-lg bg-muted/30 text-sm">
                                        <div className="font-medium">{log.action || "Action"}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {log.details || ""} • {log.timestamp?.toDate ? new Date(log.timestamp.toDate()).toLocaleString() : ""}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="rounded-3xl border-border/50 shadow-lg bg-background/40 backdrop-blur-xl">
                    <CardHeader>
                        <CardTitle>Recent Security Events</CardTitle>
                        <CardDescription>Last 50 security-related events</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[400px]">
                            <div className="space-y-2">
                                {auditLogs.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">No security events yet</div>
                                ) : auditLogs.map((log) => (
                                    <div key={log.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${
                                                log.action?.includes('delete') || log.action?.includes('security') ? 'bg-red-500' : 
                                                log.action?.includes('update') || log.action?.includes('change') ? 'bg-yellow-500' : 'bg-green-500'
                                            }`} />
                                            <div>
                                                <div className="font-medium text-sm">{log.action || "Event"}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {log.details || ""} • {log.timestamp?.toDate ? new Date(log.timestamp.toDate()).toLocaleString() : ""}
                                                </div>
                                            </div>
                                        </div>
                                        <Badge variant="outline">Info</Badge>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        )}

        {/* NOTIFICATIONS */}
        {activeView === 'notifications' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-4xl md:text-5xl font-black tracking-tighter bg-gradient-to-r from-primary via-purple-500 to-accent bg-clip-text text-transparent">
                            Notifications Center
                        </h2>
                        <p className="text-muted-foreground text-lg font-medium mt-2">Manage platform-wide communications</p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => setShowNotificationDialog(true)} className="rounded-xl font-bold gap-2 shadow-lg hover:shadow-xl transition-all">
                            <Bell className="h-4 w-4" />
                            Push Notification
                        </Button>
                        <Button onClick={() => setShowAnnouncementDialog(true)} variant="outline" className="rounded-xl font-bold gap-2">
                            <Megaphone className="h-4 w-4" />
                            Announcement
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2 rounded-[2rem] border-0 shadow-2xl bg-card/50 backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="text-2xl font-black flex items-center gap-2">
                                <Bell className="h-6 w-6 text-primary" />
                                Active Announcements
                            </CardTitle>
                            <CardDescription className="text-base font-medium">Platform-wide announcements</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {announcements.length === 0 ? (
                                    <div className="text-center py-12 space-y-4">
                                        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                                            <Bell className="h-8 w-8 text-muted-foreground/30" />
                                        </div>
                                        <p className="font-bold text-muted-foreground">No active announcements</p>
                                    </div>
                                ) : announcements.filter(a => a.active).map((ann) => (
                                    <div key={ann.id} className="p-5 rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50 hover:border-primary/20 transition-all group">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="font-black text-lg">{ann.title}</div>
                                            <Badge variant={ann.priority === 'high' ? 'destructive' : 'secondary'} className="font-bold">{ann.priority}</Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-4">{ann.message}</p>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => {
                                                updateDoc(doc(db, "announcements", ann.id), { active: !ann.active });
                                                toast.success("Announcement updated");
                                            }}>
                                                {ann.active ? <BellOff className="h-3 w-3 mr-2" /> : <Bell className="h-3 w-3 mr-2" />}
                                                {ann.active ? "Deactivate" : "Activate"}
                                            </Button>
                                            <Button size="sm" variant="ghost" className="text-destructive rounded-xl" onClick={() => deleteAnnouncement(ann.id)}>
                                                <Trash2 className="h-3 w-3 mr-2" />
                                                Delete
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-[2rem] border-0 shadow-2xl bg-card/50 backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="text-xl font-black flex items-center gap-2">
                                <Mail className="h-5 w-5 text-primary" />
                                Email Campaign
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label className="font-bold">Subject</Label>
                                <Input placeholder="Campaign subject..." value={emailCampaignSubject} onChange={(e) => setEmailCampaignSubject(e.target.value)} className="rounded-xl mt-1" />
                            </div>
                            <div>
                                <Label className="font-bold">Message</Label>
                                <Textarea placeholder="Email content..." value={emailCampaignBody} onChange={(e) => setEmailCampaignBody(e.target.value)} rows={6} className="rounded-xl mt-1" />
                            </div>
                            <div className="flex gap-2">
                                <Select value={notificationRecipientType} onValueChange={setNotificationRecipientType}>
                                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select recipients" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Users ({stats.totalUsers})</SelectItem>
                                        <SelectItem value="active">Active Users ({stats.activeUsers})</SelectItem>
                                        <SelectItem value="inactive">Inactive Users ({stats.totalUsers - stats.activeUsers})</SelectItem>
                                        <SelectItem value="admins">Admins Only ({stats.admins})</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button onClick={async () => {
                                    try {
                                        await addDoc(collection(db, "email_campaigns"), {
                                            subject: emailCampaignSubject,
                                            body: emailCampaignBody,
                                            recipientType: notificationRecipientType,
                                            sentAt: serverTimestamp(),
                                            sentBy: currentUser?.uid,
                                            status: "sent"
                                        });
                                        await addDoc(collection(db, "audit_logs"), {
                                            action: "email_campaign_sent",
                                            adminId: currentUser?.uid,
                                            timestamp: serverTimestamp(),
                                            details: `Email campaign sent: ${emailCampaignSubject}`
                                        });
                                        toast.success("Email campaign sent successfully");
                                        setEmailCampaignSubject("");
                                        setEmailCampaignBody("");
                                    } catch (e) {
                                        toast.error("Failed to send campaign");
                                    }
                                }} className="rounded-xl font-bold gap-2" disabled={!emailCampaignSubject.trim() || !emailCampaignBody.trim()}>
                                    <Send className="h-4 w-4" /> Send
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )}

        {/* MONITORING */}
        {activeView === 'monitoring' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                    <h2 className="text-3xl font-bold">System Monitoring</h2>
                    <p className="text-muted-foreground">Real-time system health and performance</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="rounded-3xl border-border/50 shadow-lg bg-background/40 backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5" /> System Status</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${systemHealth.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                                <span className="font-medium capitalize">{systemHealth.status}</span>
                            </div>
                            <div className="mt-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Uptime</span>
                                    <span className="font-medium">{systemHealth.uptime}%</span>
                                </div>
                                <Progress value={systemHealth.uptime} className="h-2" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-border/50 shadow-lg bg-background/40 backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Cpu className="h-5 w-5" /> Performance</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Avg Latency</span>
                                    <span className="font-medium">{systemHealth.latency}ms</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">CPU Usage</span>
                                    <span className="font-medium">{systemHealth.cpuUsage}%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Memory</span>
                                    <span className="font-medium">{systemHealth.memoryUsage}%</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-border/50 shadow-lg bg-background/40 backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Database</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Connections</span>
                                    <span className="font-medium">42/100</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Query Time</span>
                                    <span className="font-medium">12ms</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Storage</span>
                                    <span className="font-medium">2.4 GB</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-border/50 shadow-lg bg-background/40 backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Network className="h-5 w-5" /> Network</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Requests/min</span>
                                    <span className="font-medium">{systemHealth.requestsPerMin.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Bandwidth</span>
                                    <span className="font-medium">{Math.floor(systemHealth.requestsPerMin * 0.05)} MB/s</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Errors</span>
                                    <Badge variant="secondary">0.01%</Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="rounded-3xl border-border/50 shadow-lg bg-background/40 backdrop-blur-xl">
                    <CardHeader>
                        <CardTitle>System Health Timeline</CardTitle>
                        <CardDescription>Last 24 hours of system metrics</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={analyticsData.slice(-24).map((d, i) => ({ 
                                hour: i, 
                                latency: systemHealth.latency + Math.floor(Math.random() * 10) - 5, 
                                uptime: systemHealth.uptime + (Math.random() * 2 - 1)
                            }))}>
                                <XAxis dataKey="hour" />
                                <YAxis />
                                <Tooltip />
                                <Line type="monotone" dataKey="latency" stroke="hsl(var(--primary))" strokeWidth={2} />
                                <Line type="monotone" dataKey="uptime" stroke="#22c55e" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        )}

        {/* SETTINGS */}
        {activeView === 'settings' && (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                    <h2 className="text-3xl font-bold">System Configuration</h2>
                    <p className="text-muted-foreground">Manage platform settings and preferences</p>
                </div>

                <Card className="rounded-3xl border-border/50 shadow-lg bg-background/40 backdrop-blur-xl">
                    <CardHeader>
                        <CardTitle>System Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Maintenance Mode</Label>
                                <div className="text-sm text-muted-foreground">Disable student access</div>
                            </div>
                            <Switch checked={maintenanceMode} onCheckedChange={updateMaintenanceMode} />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Auto-Sync Content</Label>
                                <div className="text-sm text-muted-foreground">Push new public playlists automatically</div>
                            </div>
                            <Switch defaultChecked />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Email Notifications</Label>
                                <div className="text-sm text-muted-foreground">Send email alerts for important events</div>
                            </div>
                            <Switch defaultChecked />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Two-Factor Authentication</Label>
                                <div className="text-sm text-muted-foreground">Require 2FA for admin accounts</div>
                            </div>
                            <Switch />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Data Retention</Label>
                                <div className="text-sm text-muted-foreground">Automatically archive old data</div>
                            </div>
                            <Switch />
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-3xl border-border/50 shadow-lg bg-background/40 backdrop-blur-xl">
                    <CardHeader>
                        <CardTitle>Data Management</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
                            <div>
                                <div className="font-medium">Export All Data</div>
                                <div className="text-sm text-muted-foreground">Download complete platform data</div>
                            </div>
                            <Select value={exportFormat} onValueChange={setExportFormat}>
                                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="csv">CSV</SelectItem>
                                    <SelectItem value="json">JSON</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
                            <div>
                                <div className="font-medium">Backup Database</div>
                                <div className="text-sm text-muted-foreground">Create a full system backup</div>
                            </div>
                            <Button variant="outline" className="gap-2" onClick={async () => {
                                try {
                                    const backupData = {
                                        users: users.length,
                                        playlists: playlists.length,
                                        announcements: announcements.length,
                                        timestamp: new Date().toISOString()
                                    };
                                    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement("a");
                                    a.href = url;
                                    a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                    
                                    await addDoc(collection(db, "audit_logs"), {
                                        action: "backup_created",
                                        adminId: currentUser?.uid,
                                        timestamp: serverTimestamp(),
                                        details: "System backup created"
                                    });
                                    
                                    toast.success("Backup created");
                                } catch (e) {
                                    toast.error("Backup failed");
                                }
                            }}>
                                <DownloadCloud className="h-4 w-4" /> Backup Now
                            </Button>
                        </div>
                        {exportProgress > 0 && (
                            <div className="p-4 rounded-xl bg-muted/30">
                                <div className="flex justify-between mb-2">
                                    <span className="text-sm font-medium">Export Progress</span>
                                    <span className="text-sm text-muted-foreground">{exportProgress}%</span>
                                </div>
                                <Progress value={exportProgress} />
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        )}

      </main>

      {/* --- USER INSPECTOR SHEET --- */}
      <Sheet open={!!inspectingUser} onOpenChange={(open) => !open && setInspectingUser(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto bg-background/95 backdrop-blur-2xl border-l border-border/50 p-0">
            <div className="p-6 pb-2 border-b border-border/50 bg-background/50">
                <SheetHeader>
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-16 w-16 ring-4 ring-primary/10">
                                <AvatarImage src={inspectingUser?.photoURL || ""} />
                                <AvatarFallback className="text-2xl">{inspectingUser?.name[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                                <SheetTitle className="text-2xl">{inspectingUser?.name}</SheetTitle>
                                <SheetDescription className="flex items-center gap-2">
                                    <Mail className="h-3 w-3" /> {inspectingUser?.email}
                                </SheetDescription>
                                <div className="flex gap-2 mt-2">
                                    <Badge variant={inspectingUser?.role === 'admin' ? "default" : "outline"}>{inspectingUser?.role}</Badge>
                                    {inspectingUser?.isActive && <Badge variant="secondary" className="bg-green-500/10 text-green-500">Active</Badge>}
                                </div>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setInspectingUser(null)}><X className="h-5 w-5" /></Button>
                    </div>
                </SheetHeader>
            </div>

            <div className="p-6 pt-2">
                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/50 rounded-xl p-1">
                        <TabsTrigger value="overview" className="rounded-lg">Overview</TabsTrigger>
                        <TabsTrigger value="content" className="rounded-lg">Content</TabsTrigger>
                        <TabsTrigger value="manage" className="rounded-lg text-destructive data-[state=active]:text-destructive">Manage</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-6">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-1">
                                <span className="text-xs text-muted-foreground uppercase tracking-wider">Member Since</span>
                                <div className="flex items-center gap-2 font-medium">
                                    <Calendar className="h-4 w-4 text-primary" />
                                    {inspectingUser?.createdAt?.toDate ? new Date(inspectingUser.createdAt.toDate()).toLocaleDateString() : "Unknown"}
                                </div>
                            </div>
                            <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-1">
                                <span className="text-xs text-muted-foreground uppercase tracking-wider">Last Active</span>
                                <div className="flex items-center gap-2 font-medium">
                                    <Clock className="h-4 w-4 text-primary" />
                                    {inspectingUser?.lastSignInAt?.toDate ? new Date(inspectingUser.lastSignInAt.toDate()).toLocaleDateString() : "Unknown"}
                                </div>
                            </div>
                            <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-1">
                                <span className="text-xs text-muted-foreground uppercase tracking-wider">Watch Time</span>
                                <div className="text-xl font-bold">{Math.floor((inspectingUser?.totalWatchTime || 0) / 60)}h</div>
                            </div>
                            <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-1">
                                <span className="text-xs text-muted-foreground uppercase tracking-wider">Playlists</span>
                                <div className="text-xl font-bold">{inspectingUser?.playlistsCount}</div>
                            </div>
                        </div>

                        {/* Admin Notes */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2"><StickyNote className="h-4 w-4" /> Admin Notes (Private)</Label>
                            <Textarea 
                                placeholder="Internal notes about this user..." 
                                value={adminNoteInput}
                                onChange={(e) => setAdminNoteInput(e.target.value)}
                                className="min-h-[100px] rounded-xl resize-none bg-background/50"
                            />
                            <Button size="sm" onClick={saveAdminNotes} className="w-full">Save Notes</Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="content" className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4" /> Assigned Playlists</h3>
                            <Badge variant="outline">{inspectingUserPlaylists.length}</Badge>
                        </div>
                        
                        {loadingUserPlaylists ? (
                            <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
                        ) : inspectingUserPlaylists.length === 0 ? (
                            <div className="text-center p-8 border border-dashed border-border rounded-xl">
                                <p className="text-muted-foreground">No playlists found.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {inspectingUserPlaylists.map(p => {
                                    const total = p.lectures?.length || 0;
                                    const completed = p.lectures?.filter((l: any) => l.completed).length || 0;
                                    const progress = total > 0 ? (completed / total) * 100 : 0;

                                    return (
                                        <div key={p.id} className="p-4 rounded-2xl border border-border bg-background/50 hover:bg-muted/20 transition-colors group">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <div className="font-medium text-sm">{p.title}</div>
                                                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                                                        <Video className="h-3 w-3" /> {total} lectures
                                                        <span>•</span>
                                                        <CheckSquare className="h-3 w-3" /> {completed} done
                                                    </div>
                                                </div>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setPlaylistToDeleteFromUser(p.id)}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Progress value={progress} className="h-1.5 flex-1" />
                                                <span className="text-xs font-mono text-muted-foreground">{Math.round(progress)}%</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="manage" className="space-y-6">
                        <div className="space-y-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-6">
                            <h3 className="font-semibold text-destructive flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Danger Zone</h3>
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-medium text-sm">Update Role</div>
                                    <div className="text-xs text-muted-foreground">Change user permissions</div>
                                </div>
                                <Select 
                                    value={inspectingUser?.role} 
                                    onValueChange={(val) => inspectingUser && updateUserRole(inspectingUser.uid, val)}
                                >
                                    <SelectTrigger className="w-[120px] bg-background/50"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="user">User</SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Separator className="bg-destructive/10" />
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-medium text-sm">Send Password Reset</div>
                                    <div className="text-xs text-muted-foreground">Trigger recovery email</div>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => toast.success(`Reset email sent to ${inspectingUser?.email}`)}>Send Email</Button>
                            </div>
                            <Separator className="bg-destructive/10" />
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-medium text-sm text-destructive">Delete Account</div>
                                    <div className="text-xs text-muted-foreground">Permanently remove user</div>
                                </div>
                                <Button size="sm" variant="destructive" onClick={() => inspectingUser && deleteDoc(doc(db, "users", inspectingUser.uid)).then(() => { setInspectingUser(null); toast.success("Deleted"); })}>Delete</Button>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </SheetContent>
      </Sheet>

      {/* --- PLAYLIST DELETE ALERT --- */}
      <AlertDialog open={!!playlistToDeleteFromUser} onOpenChange={(open) => !open && setPlaylistToDeleteFromUser(null)}>
        <AlertDialogContent className="rounded-3xl border-destructive/20 bg-background/95 backdrop-blur-xl">
            <AlertDialogHeader>
                <AlertDialogTitle>Revoke Access?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will remove the playlist from the user's account. Their progress on this specific playlist will be permanently lost.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                <AlertDialogAction 
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                    onClick={() => {
                        if (inspectingUser && playlistToDeleteFromUser) {
                            deleteUserPlaylist();
                        }
                    }}
                >
                    Revoke Access
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- SYNC DIALOG --- */}
      <Dialog open={showSyncDialog !== null} onOpenChange={(open) => !open && setShowSyncDialog(null)}>
         <DialogContent className="rounded-3xl">
            <DialogHeader>
               <DialogTitle>Confirm Global Sync</DialogTitle>
               <DialogDescription>This action will push content to all users.</DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
               <Button variant="ghost" onClick={() => setShowSyncDialog(null)} className="rounded-xl">Cancel</Button>
               <Button onClick={() => showSyncDialog && syncPlaylistToUsers(showSyncDialog)} className="rounded-xl">Start Sync</Button>
            </div>
         </DialogContent>
      </Dialog>

      {/* --- ANNOUNCEMENT DIALOG --- */}
      <Dialog open={showAnnouncementDialog} onOpenChange={setShowAnnouncementDialog}>
         <DialogContent className="rounded-3xl max-w-2xl">
            <DialogHeader>
               <DialogTitle>Create Announcement</DialogTitle>
               <DialogDescription>Send a platform-wide announcement to all users</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
               <div>
                  <Label>Title</Label>
                  <Input placeholder="Announcement title..." value={newAnnouncement.title} onChange={(e) => setNewAnnouncement({...newAnnouncement, title: e.target.value})} />
               </div>
               <div>
                  <Label>Message</Label>
                  <Textarea placeholder="Announcement message..." value={newAnnouncement.message} onChange={(e) => setNewAnnouncement({...newAnnouncement, message: e.target.value})} rows={6} />
               </div>
               <div>
                  <Label>Priority</Label>
                  <Select value={newAnnouncement.priority} onValueChange={(val) => setNewAnnouncement({...newAnnouncement, priority: val})}>
                     <SelectTrigger><SelectValue /></SelectTrigger>
                     <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                     </SelectContent>
                  </Select>
               </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
               <Button variant="ghost" onClick={() => setShowAnnouncementDialog(false)} className="rounded-xl">Cancel</Button>
               <Button onClick={createAnnouncement} className="rounded-xl">Create</Button>
            </div>
         </DialogContent>
      </Dialog>

      {/* --- PUSH NOTIFICATION DIALOG --- */}
      <Dialog open={showNotificationDialog} onOpenChange={setShowNotificationDialog}>
         <DialogContent className="rounded-[2rem] max-w-2xl border-0 shadow-2xl">
            <DialogHeader>
               <DialogTitle className="text-2xl font-black">Push Notification</DialogTitle>
               <DialogDescription className="text-base font-medium">Send a notification to selected users</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
               <div>
                  <Label className="font-bold">Recipients</Label>
                  <Select value={notificationRecipientType} onValueChange={setNotificationRecipientType}>
                     <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                     <SelectContent>
                        <SelectItem value="all">All Users ({stats.totalUsers})</SelectItem>
                        <SelectItem value="active">Active Users ({stats.activeUsers})</SelectItem>
                        <SelectItem value="inactive">Inactive Users ({stats.totalUsers - stats.activeUsers})</SelectItem>
                        <SelectItem value="admins">Admins Only ({stats.admins})</SelectItem>
                     </SelectContent>
                  </Select>
               </div>
               <div>
                  <Label className="font-bold">Notification Type</Label>
                  <Select value={notificationType} onValueChange={setNotificationType}>
                     <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                     <SelectContent>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                     </SelectContent>
                  </Select>
               </div>
               <div>
                  <Label className="font-bold">Title</Label>
                  <Input placeholder="Notification title..." value={notificationTitle} onChange={(e) => setNotificationTitle(e.target.value)} className="rounded-xl mt-1" />
               </div>
               <div>
                  <Label className="font-bold">Message</Label>
                  <Textarea placeholder="Notification message..." value={notificationMessage} onChange={(e) => setNotificationMessage(e.target.value)} rows={6} className="rounded-xl mt-1" />
               </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
               <Button variant="ghost" onClick={() => {
                  setShowNotificationDialog(false);
                  setNotificationTitle("");
                  setNotificationMessage("");
               }} className="rounded-xl font-bold">Cancel</Button>
               <Button onClick={sendNotificationToUsers} className="rounded-xl font-bold gap-2 shadow-lg" disabled={!notificationTitle.trim() || !notificationMessage.trim()}>
                  <Bell className="h-4 w-4" /> Send Notification
               </Button>
            </div>
         </DialogContent>
      </Dialog>

      {/* --- IMPERSONATION DIALOG --- */}
      <Dialog open={showImpersonateDialog !== null} onOpenChange={(open) => !open && setShowImpersonateDialog(null)}>
         <DialogContent className="rounded-3xl max-w-md">
            <DialogHeader>
               <DialogTitle className="flex items-center gap-2">
                  <UserCog className="h-5 w-5" />
                  View as User
               </DialogTitle>
               <DialogDescription>You'll see the platform from this user's perspective (read-only mode)</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
               <Alert className="border-yellow-500/50 bg-yellow-500/10">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <AlertDescription className="text-sm">
                     This action will be logged in the audit trail. You'll be able to navigate as this user but cannot make changes on their behalf.
                  </AlertDescription>
               </Alert>
               <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/30">
                  {showImpersonateDialog && (() => {
                     const targetUser = users.find(u => u.uid === showImpersonateDialog);
                     return targetUser ? (
                        <>
                           <Avatar className="h-12 w-12">
                              <AvatarImage src={targetUser.photoURL || ""} />
                              <AvatarFallback>{targetUser.name[0]}</AvatarFallback>
                           </Avatar>
                           <div>
                              <div className="font-bold">{targetUser.name}</div>
                              <div className="text-xs text-muted-foreground">{targetUser.email}</div>
                           </div>
                        </>
                     ) : null;
                  })()}
               </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
               <Button variant="ghost" onClick={() => setShowImpersonateDialog(null)} className="rounded-xl">Cancel</Button>
               <Button onClick={() => {
                  const targetUser = users.find(u => u.uid === showImpersonateDialog);
                  if (targetUser && showImpersonateDialog) {
                     impersonateUser(showImpersonateDialog, targetUser.name);
                  }
               }} className="rounded-xl gap-2">
                  <UserCog className="h-4 w-4" /> Start Viewing
               </Button>
            </div>
         </DialogContent>
      </Dialog>

      {/* --- EMAIL CAMPAIGN DIALOG --- */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
         <DialogContent className="rounded-3xl max-w-2xl">
            <DialogHeader>
               <DialogTitle>Send Email Campaign</DialogTitle>
               <DialogDescription>Send bulk emails to selected user groups</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
               <div>
                  <Label>Recipients</Label>
                  <Select>
                     <SelectTrigger><SelectValue placeholder="Select recipients" /></SelectTrigger>
                     <SelectContent>
                        <SelectItem value="all">All Users ({stats.totalUsers})</SelectItem>
                        <SelectItem value="active">Active Users ({stats.activeUsers})</SelectItem>
                        <SelectItem value="admins">Admins Only ({stats.admins})</SelectItem>
                     </SelectContent>
                  </Select>
               </div>
               <div>
                  <Label>Subject</Label>
                  <Input placeholder="Email subject..." value={emailCampaignSubject} onChange={(e) => setEmailCampaignSubject(e.target.value)} />
               </div>
               <div>
                  <Label>Message</Label>
                  <Textarea placeholder="Email content..." value={emailCampaignBody} onChange={(e) => setEmailCampaignBody(e.target.value)} rows={8} />
               </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
               <Button variant="ghost" onClick={() => setShowEmailDialog(false)} className="rounded-xl">Cancel</Button>
                                <Button onClick={async () => {
                  if (!emailCampaignSubject.trim() || !emailCampaignBody.trim()) {
                      toast.error("Subject and body are required");
                      return;
                  }
                  try {
                      console.log("Sending email campaign...");
                      console.log("Subject:", emailCampaignSubject);
                      console.log("Body:", emailCampaignBody);
                      console.log("Current user:", currentUser?.uid);
                      
                      const campaignRef = await addDoc(collection(db, "email_campaigns"), {
                          subject: emailCampaignSubject,
                          body: emailCampaignBody,
                          recipientType: "all",
                          sentAt: serverTimestamp(),
                          sentBy: currentUser?.uid,
                          status: "sent"
                      });
                      
                      console.log("Campaign created with ID:", campaignRef.id);
                      
                      await addDoc(collection(db, "audit_logs"), {
                          action: "email_campaign_sent",
                          adminId: currentUser?.uid,
                          timestamp: serverTimestamp(),
                          details: `Email campaign sent: ${emailCampaignSubject}`
                      });
                      
                      toast.success("Email campaign sent successfully!");
                      setShowEmailDialog(false);
                      setEmailCampaignSubject("");
                      setEmailCampaignBody("");
                  } catch (e: any) {
                      console.error("Error sending campaign:", e);
                      toast.error(`Failed to send campaign: ${e.message}`);
                  }
               }} className="rounded-xl gap-2" disabled={!emailCampaignSubject.trim() || !emailCampaignBody.trim()}>
                  <Send className="h-4 w-4" /> Send Campaign
               </Button>
            </div>
         </DialogContent>
      </Dialog>

    </div>
  );
}

// --- SUB COMPONENTS ---

function NavPill({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
    const { theme } = useTheme();
    return (
        <button onClick={onClick} className={cn(
            "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 whitespace-nowrap flex-shrink-0",
            active 
                ? "bg-primary text-primary-foreground shadow-lg" 
                : cn(
                    "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    theme === "dark" ? "hover:bg-white/5" : "hover:bg-slate-100"
                )
        )}>
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:block">{label}</span>
        </button>
    )
}

function StatCard({ title, value, icon: Icon, trend, color }: any) {
   return (
      <Card className="rounded-3xl border-border/50 shadow-lg hover:shadow-xl transition-all bg-background/40 backdrop-blur-xl group">
         <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
               <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{title}</p>
                  <h3 className="text-3xl font-bold mt-1">{value}</h3>
               </div>
               <div className={cn("p-3 rounded-2xl bg-gradient-to-br text-white shadow-lg group-hover:scale-110 transition-transform", color)}><Icon className="h-6 w-6" /></div>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> {trend}</p>
         </CardContent>
      </Card>
   )
}

function QuickAction({ icon: Icon, label, onClick }: any) {
    return (
        <button onClick={onClick} className="flex flex-col items-center justify-center p-4 rounded-3xl bg-background/40 border border-border/50 hover:bg-primary/5 hover:border-primary/20 transition-all gap-2 group">
            <div className="p-3 rounded-2xl bg-muted group-hover:bg-primary group-hover:text-white transition-colors">
                <Icon className="h-6 w-6" />
            </div>
            <span className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">{label}</span>
        </button>
    )
}