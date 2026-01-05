import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import jsPDF from "jspdf";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

import {
  Plus,
  Trash2,
  PlayCircle,
  Check,
  Maximize,
  Minimize,
  Focus,
  Sparkles,
  Search,
  Filter,
  Timer,
  Play,
  Pause,
  RotateCcw,
  X,
  ArrowUp,
  ArrowDown,
  FileText,
  Calendar,
  BarChart3,
  Bookmark,
  Shield,
  CheckCircle2,
  AlertCircle,
  Star,
  Loader2,
  BookOpen
} from "lucide-react";

/* ================= TYPES ================= */

type NoteTag = "important" | "formula" | "doubt";

type TimestampNote = {
  id: string;
  timestamp: number; // seconds
  note: string;
  createdAt: number;
};

type Lecture = {
  id: string;
  title: string;
  videoId: string;
  completed: boolean;
  notes?: string;
  watchTime?: number;
  createdAt?: number; // timestamp for sorting

  /* ===== PATCH 7 ===== */
  tags?: NoteTag[];
  aiSummary?: string;
  timestampNotes?: TimestampNote[]; // NEW: timestamp bookmarks
};

type SortOption = "title" | "date" | "watchTime" | "completed" | "custom";
type FilterOption = "all" | "completed" | "incomplete" | "tagged" | "watched";

type Playlist = {
  id: string;
  title: string;
  lectures: Lecture[];
  description?: string;
  dueDate?: number; // timestamp
  archived?: boolean;
  createdAt?: number;
  lastAccessed?: number;
};

type NoteTemplate = {
  name: string;
  content: string;
};

type RecentlyViewed = {
  pid: string;
  lid: string;
  timestamp: number;
};

/* ================= HELPERS ================= */

function extractVideoId(url: string): string | null {
  try {
    if (url.includes("youtu.be/"))
      return url.split("youtu.be/")[1].split("?")[0];
    if (url.includes("watch?v="))
      return new URL(url).searchParams.get("v");
  } catch { }
  return null;
}

/* ===== NOTES SANITIZER ===== */
function sanitizeNotes(input: string): string {
  return input
    // remove zero-width & invisible chars
    .replace(/[\u200B-\u200D\uFEFF]/g, "")

    // normalize weird quotes
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")

    // Allow Letters, Numbers, Punctuation, Symbols (Math), Separators, Newlines, Tabs AND Symbol Other (Emojis)
    .replace(/[^\p{L}\p{N}\p{P}\p{S}\p{Z}\p{So}\n\t]/gu, "")

    // limit repeated symbols
    .replace(/([*_=~`]){4,}/g, "$1$1$1")

    // trim trailing spaces per line
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n");
}

/* ================= PAGE ================= */
export default function Playlists() {
  const SYMBOL_GROUPS = {
    Operators: ["+", "−", "×", "÷", "=", "≠", "≈"],
    Relations: ["<", ">", "≤", "≥", "∈", "∉"],
    Constants: ["π", "∞", "°"],
    Calculus: ["∑", "∏", "∫", "∂"],
    Greek: ["α", "β", "γ", "Δ", "θ", "λ", "μ"],
    Arrows: ["→", "←", "↔"],
  };

  const [showSymbolPad, setShowSymbolPad] = useState(false);
  const { user } = useAuth();
  const { theme } = useTheme();
  const symbolButtonRef = useRef<HTMLButtonElement | null>(null);
  const symbolPopupRef = useRef<HTMLDivElement | null>(null);

  /* ===== PATCH: TAG + PDF + AI STATES ===== */
  const [activeTags, setActiveTags] = useState<NoteTag[]>([]);

  const watchStartRef = useRef<number | null>(null);
  const notesSaveTimer = useRef<NodeJS.Timeout | null>(null);

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [adminPlaylists, setAdminPlaylists] = useState<Playlist[]>([]);
  const [active, setActive] = useState<{ pid: string; lid: string; isAdmin?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [loadingAdminPlaylists, setLoadingAdminPlaylists] = useState(true);

  const [newPlaylist, setNewPlaylist] = useState("");
  const [newLectureTitle, setNewLectureTitle] = useState("");
  const [newLectureUrl, setNewLectureUrl] = useState("");

  const [theatre, setTheatre] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [showFocusTip, setShowFocusTip] = useState(true);

  /* ---------- NOTES STATES ---------- */
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "typing" | "saving" | "saved"
  >("idle");

  const isDirtyRef = useRef(false);
  const [localNotes, setLocalNotes] = useState("");
  const [aiSummary, setAiSummary] = useState("");

  /* ---------- BUG FIX: REFS FOR CLEANUP SAVING ---------- */
  const localNotesRef = useRef(localNotes);
  const activeRef = useRef(active);

  // Keep refs synced
  useEffect(() => {
    localNotesRef.current = localNotes;
  }, [localNotes]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  /* ---------- NEW FEATURES STATE ---------- */
  const { toast } = useToast();

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOption, setFilterOption] = useState<FilterOption>("all");
  const [selectedTagFilter, setSelectedTagFilter] = useState<NoteTag | "all">("all");

  // Sort
  const [sortOption, setSortOption] = useState<SortOption>("custom");

  // Statistics
  const [showStats, setShowStats] = useState(false);

  // Timer
  const [timerActive, setTimerActive] = useState(false);
  const [timerMode, setTimerMode] = useState<"pomodoro" | "break">("pomodoro");
  const [timerSeconds, setTimerSeconds] = useState(25 * 60); // 25 minutes default
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Timestamp Notes
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [showTimestampDialog, setShowTimestampDialog] = useState(false);
  const [timestampInput, setTimestampInput] = useState("");
  const [timestampNoteInput, setTimestampNoteInput] = useState("");

  // Playback & Auto-play
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [autoPlay, setAutoPlay] = useState(false);

  // Bulk operations
  const [selectedLectures, setSelectedLectures] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  // Recently viewed
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewed[]>([]);

  // Store user-specific data for admin playlists (notes, timestamps, watch time, tags)
  const [adminPlaylistUserData, setAdminPlaylistUserData] = useState<Record<string, Record<string, any>>>({});

  // Notes templates
  const noteTemplates: NoteTemplate[] = [
    { name: "Summary", content: "## Summary\n\nKey Points:\n- \n- \n- \n\nTakeaways:\n- " },
    { name: "Problem Set", content: "## Problem Set\n\nProblem 1:\nSolution:\n\nProblem 2:\nSolution:\n" },
    { name: "Definitions", content: "## Definitions\n\n\n" },
    { name: "Formulas", content: "## Formulas\n\n\n" },
  ];

  // Loading states
  const [loading, setLoading] = useState(false);

  // Playlist dialogs
  const [showPlaylistDescriptionDialog, setShowPlaylistDescriptionDialog] = useState(false);
  const [playlistDescriptionInput, setPlaylistDescriptionInput] = useState("");
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [dueDatePopoverOpen, setDueDatePopoverOpen] = useState<{ [key: string]: boolean }>({});

  // Per-playlist stats
  const [showPlaylistStats, setShowPlaylistStats] = useState<string | null>(null);

  /* ---------- LOAD PLAYLISTS ---------- */
  useEffect(() => {
    if (!playlists.length || active) return;

    for (const p of playlists) {
      const next = p.lectures.find(l => !l.completed);
      if (next) {
        setActive({ pid: p.id, lid: next.id });
        break;
      }
    }
  }, [playlists]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        symbolPopupRef.current &&
        !symbolPopupRef.current.contains(e.target as Node) &&
        symbolButtonRef.current &&
        !symbolButtonRef.current.contains(e.target as Node)
      ) {
        setShowSymbolPad(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setError(null);
      setLoadingPlaylists(true);
      setLoadingAdminPlaylists(true);

      try {
        // Load user's own playlists
        try {
          const snap = await getDocs(
            collection(db, "users", user.uid, "playlists")
          );
          setPlaylists(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<Playlist, "id">),
            }))
          );
        } catch (err: any) {
          console.error("Error loading user playlists:", err);
          toast({
            title: "Failed to load playlists",
            description: err.message || "Could not load your playlists. Please try again.",
            variant: "destructive",
          });
          setError("Failed to load your playlists");
        } finally {
          setLoadingPlaylists(false);
        }

        // Load admin playlists (public ones)
        try {
          const adminSnap = await getDocs(
            query(collection(db, "playlists_global"), where("isPublic", "==", true))
          );
          
          // Load user-specific data for admin playlists
          const userDataSnap = await getDocs(
            collection(db, "users", user.uid, "admin_playlist_data")
          );
          const userData: Record<string, any> = {};
          userDataSnap.forEach((d) => {
            userData[d.id] = d.data();
          });
          setAdminPlaylistUserData(userData);

          const adminPlaylistsData = adminSnap.docs.map((d) => {
            const data = d.data();
            const playlistUserData = userData[d.id] || {};
            
            // Convert admin format to user format with user-specific data merged
            return {
              id: d.id,
              title: data.title,
              description: data.description || "",
              lectures: (data.lectures || []).map((l: any) => {
                const lectureUserData = playlistUserData.lectures?.[l.id] || {};
                return {
                  id: l.id || crypto.randomUUID(),
                  title: l.title,
                  videoId: l.videoId,
                  completed: lectureUserData.completed || false,
                  notes: lectureUserData.notes || "",
                  watchTime: lectureUserData.watchTime || 0,
                  createdAt: Date.now(),
                  tags: lectureUserData.tags || [],
                  timestampNotes: lectureUserData.timestampNotes || [],
                };
              }),
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate().getTime() : Date.now(),
              isFromAdmin: true,
              adminPlaylistId: d.id,
            } as Playlist & { isFromAdmin?: boolean; adminPlaylistId?: string };
          });
          setAdminPlaylists(adminPlaylistsData);
        } catch (err: any) {
          console.error("Error loading admin playlists:", err);
          toast({
            title: "Failed to load recommended playlists",
            description: err.message || "Could not load recommended playlists.",
            variant: "destructive",
          });
          setError("Failed to load recommended playlists");
        } finally {
          setLoadingAdminPlaylists(false);
        }
      } catch (err: any) {
        console.error("Unexpected error:", err);
        setError("An unexpected error occurred. Please refresh the page.");
        toast({
          title: "Error",
          description: "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    };

    load();
  }, [user, toast]);

  /* ---------- CLEANUP ---------- */
  useEffect(() => {
    return () => {
      if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
    };
  }, []);

  const current = active && (() => {
    if (active.isAdmin) {
      return adminPlaylists
        .find((p) => p.id === active.pid)
        ?.lectures.find((l) => l.id === active.lid);
    } else {
      return playlists
        .find((p) => p.id === active.pid)
        ?.lectures.find((l) => l.id === active.lid);
    }
  })();

  /* ---------- SYNC NOTES & AUTO-SAVE LOGIC ---------- */

  // Immediate Save Function
  const saveNotesImmediate = useCallback(async (lectureId: string, playlistId: string, content: string) => {
    if (!content.trim() && !isDirtyRef.current) return;

    // Don't save notes for admin playlists (read-only)
    if (activeRef.current?.isAdmin) return;

    // Clear pending timer
    if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);

    try {
      setPlaylists((currentPlaylists) => {
        const pIndex = currentPlaylists.findIndex((p) => p.id === playlistId);
        if (pIndex === -1) return currentPlaylists;

        const p = currentPlaylists[pIndex];
        const lIndex = p.lectures.findIndex((l) => l.id === lectureId);
        if (lIndex === -1) return currentPlaylists;

        const updatedLectures = [...p.lectures];
        updatedLectures[lIndex] = { ...updatedLectures[lIndex], notes: sanitizeNotes(content) };
        const updatedPlaylist = { ...p, lectures: updatedLectures };

        // Fire and forget update
        updateDoc(doc(db, "users", user!.uid, "playlists", playlistId), {
          lectures: updatedLectures
        }).catch(err => console.error("Autosave error:", err));

        const newPlaylists = [...currentPlaylists];
        newPlaylists[pIndex] = updatedPlaylist;
        return newPlaylists;
      });

      setSaveStatus("saved");
      isDirtyRef.current = false;
    } catch (e) {
      console.error(e);
    }
  }, [user]);

  // Handle Active Lecture Change (Load new notes, save old ones)
  useEffect(() => {
    // Cleanup runs BEFORE the effect body, so we use it to save the *previous* lecture's notes
    return () => {
      if (isDirtyRef.current && activeRef.current) {
        saveNotesImmediate(activeRef.current.lid, activeRef.current.pid, localNotesRef.current);
      }
    };
  }, [active, saveNotesImmediate]);

  // Load new notes
  useEffect(() => {
    if (!current) {
      setLocalNotes("");
      setAiSummary("");
      setActiveTags([]);
      isDirtyRef.current = false;
      return;
    }
    setLocalNotes(current.notes || "");
    setAiSummary(current.aiSummary || "");
    setActiveTags(current.tags || []);
    isDirtyRef.current = false; // Reset dirty flag for new lecture
  }, [current?.id, current?.notes, current?.aiSummary, current?.tags]);


  /* ---------- WATCH TIME (SAFE) ---------- */
  useEffect(() => {
    return () => {
      const stopWatchTimer = async () => {
        if (!active || !watchStartRef.current || !user) return;

        const seconds = Math.floor(
          (Date.now() - watchStartRef.current) / 1000
        );
        watchStartRef.current = null;

        if (seconds < 30) return;

        const minutes = Math.round(seconds / 60);

        try {
          const p = playlists.find((p) => p.id === active.pid);
          if (!p) return;

          const updated = p.lectures.map((l) =>
            l.id === active.lid
              ? { ...l, watchTime: (l.watchTime || 0) + minutes }
              : l
          );

          await updateDoc(
            doc(db, "users", user.uid, "playlists", p.id),
            { lectures: updated }
          );

          setPlaylists((ps) =>
            ps.map((x) => (x.id === p.id ? { ...x, lectures: updated } : x))
          );
        } catch (error) {
          console.error("Error saving watch time:", error);
        }
      };

      stopWatchTimer();
    };
  }, [active, playlists, user]);


  /* ---------- LOGIC ---------- */

  const addPlaylist = async () => {
    if (!user || !newPlaylist.trim()) {
      toast({
        title: "Invalid input",
        description: "Please enter a playlist name",
        variant: "destructive",
      });
      return;
    }

    try {
      const ref = await addDoc(
        collection(db, "users", user.uid, "playlists"),
        { title: newPlaylist.trim(), lectures: [], createdAt: Date.now() }
      );

      setPlaylists((p) => [
        ...p,
        { id: ref.id, title: newPlaylist.trim(), lectures: [], createdAt: Date.now() },
      ]);

      setNewPlaylist("");
      toast({
        title: "Success",
        description: "Playlist created successfully",
      });
    } catch (error: any) {
      console.error("Error creating playlist:", error);
      toast({
        title: "Failed to create playlist",
        description: error.message || "Could not create playlist. Please try again.",
        variant: "destructive",
      });
    }
  };

  const addLecture = async (p: Playlist) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to add lectures",
        variant: "destructive",
      });
      return;
    }

    if (p.isFromAdmin) {
      toast({
        title: "Read-only playlist",
        description: "You cannot modify recommended playlists",
        variant: "destructive",
      });
      return;
    }

    const vid = extractVideoId(newLectureUrl);
    if (!vid || !newLectureTitle.trim()) {
      toast({
        title: "Invalid input",
        description: "Please provide both a title and a valid YouTube URL",
        variant: "destructive",
      });
      return;
    }

    const updated = [
      ...p.lectures,
      {
        id: crypto.randomUUID(),
        title: newLectureTitle.trim(),
        videoId: vid,
        completed: false,
        notes: "",
        watchTime: 0,
        createdAt: Date.now(),
        tags: [],
        timestampNotes: [],
      },
    ];

    try {
      await updateDoc(
        doc(db, "users", user.uid, "playlists", p.id),
        { lectures: updated }
      );

      setPlaylists((ps) =>
        ps.map((x) => (x.id === p.id ? { ...x, lectures: updated } : x))
      );

      setNewLectureTitle("");
      setNewLectureUrl("");
      toast({
        title: "Success",
        description: "Lecture added successfully",
      });
    } catch (error: any) {
      console.error("Error adding lecture:", error);
      toast({
        title: "Failed to add lecture",
        description: error.message || "Could not add lecture. Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleComplete = async (p: Playlist, lid: string) => {
    if (!user) return;

    const updated = p.lectures.map((l) =>
      l.id === lid ? { ...l, completed: !l.completed } : l
    );

    try {
      if (p.isFromAdmin) {
        // Handle admin playlist - save to user-specific data
        const userDataRef = doc(db, "users", user.uid, "admin_playlist_data", p.id);
        const lectureData: Record<string, any> = {};
        updated.forEach((l) => {
          lectureData[l.id] = {
            notes: l.notes || "",
            completed: l.completed || false,
            watchTime: l.watchTime || 0,
            tags: l.tags || [],
            timestampNotes: l.timestampNotes || [],
          };
        });

        await updateDoc(userDataRef, {
          lectures: lectureData,
          lastUpdated: Date.now(),
        }).catch(async (e) => {
          // If document doesn't exist, create it using setDoc
          if (e.code === "not-found") {
            const { setDoc } = await import("firebase/firestore");
            await setDoc(userDataRef, {
              lectures: lectureData,
              lastUpdated: Date.now(),
            });
          }
        });

        setAdminPlaylists((ps) =>
          ps.map((x) => (x.id === p.id ? { ...x, lectures: updated } : x))
        );
      } else {
        // Handle regular playlist
        await updateDoc(
          doc(db, "users", user.uid, "playlists", p.id),
          { lectures: updated }
        );

        setPlaylists((ps) =>
          ps.map((x) => (x.id === p.id ? { ...x, lectures: updated } : x))
        );
      }
    } catch (error: any) {
      console.error("Error toggling completion:", error);
      toast({
        title: "Failed to update",
        description: error.message || "Could not update lecture status.",
        variant: "destructive",
      });
    }
  };

  const updateNotesDebounced = useCallback((text: string) => {
    setLocalNotes(text);
    setSaveStatus("typing");
    isDirtyRef.current = true;

    if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);

    // Save logic
    notesSaveTimer.current = setTimeout(async () => {
      // Use refs to get latest values inside timeout to avoid stale closures
      const currentActive = activeRef.current;

      if (!currentActive || !user) {
        setSaveStatus("idle");
        return;
      }

      setSaveStatus("saving");

      try {
        // Check if this is an admin playlist
        if (currentActive.isAdmin) {
          // Save to user-specific admin playlist data
          const playlistId = currentActive.pid;
          const lectureId = currentActive.lid;
          
          // Get current admin playlist to update local state
          setAdminPlaylists((currentPlaylists) => {
            const p = currentPlaylists.find((p) => p.id === playlistId);
            if (!p) return currentPlaylists;

            const updated = p.lectures.map((l) =>
              l.id === lectureId ? { ...l, notes: sanitizeNotes(text) } : l
            );

            // Update Firestore - store in user's admin_playlist_data
            const userDataRef = doc(db, "users", user.uid, "admin_playlist_data", playlistId);
            const lectureData: Record<string, any> = {};
            updated.forEach((l) => {
              lectureData[l.id] = {
                notes: l.notes || "",
                completed: l.completed || false,
                watchTime: l.watchTime || 0,
                tags: l.tags || [],
                timestampNotes: l.timestampNotes || [],
              };
            });

            updateDoc(userDataRef, {
              lectures: lectureData,
              lastUpdated: Date.now(),
            }).catch((e) => {
              // If document doesn't exist, create it
              if (e.code === "not-found") {
                addDoc(collection(db, "users", user.uid, "admin_playlist_data"), {
                  playlistId,
                  lectures: lectureData,
                  lastUpdated: Date.now(),
                }).catch((err) => console.error("Create error", err));
              } else {
                console.error("Save error", e);
              }
              setSaveStatus("idle");
            });

            return currentPlaylists.map((x) => (x.id === playlistId ? { ...x, lectures: updated } : x));
          });
        } else {
          // Regular playlist - save normally
          setPlaylists((currentPlaylists) => {
            const p = currentPlaylists.find((p) => p.id === currentActive.pid);
            if (!p) return currentPlaylists;

            const updated = p.lectures.map((l) =>
              l.id === currentActive.lid
                ? { ...l, notes: sanitizeNotes(text) }
                : l
            );

            // Trigger Firestore update
            updateDoc(
              doc(db, "users", user.uid, "playlists", p.id),
              { lectures: updated }
            ).catch(e => {
              console.error("Save error", e);
              setSaveStatus("idle");
            });

            return currentPlaylists.map((x) => (x.id === p.id ? { ...x, lectures: updated } : x));
          });
        }

        setSaveStatus("saved");
        isDirtyRef.current = false;
      } catch (error) {
        console.error("Error saving notes:", error);
        setSaveStatus("idle");
      }
    }, 600);
  }, [user]);

  const insertSymbol = async (symbol: string) => {
    const textarea = document.getElementById("notes-area") as HTMLTextAreaElement;
    if (!textarea || !active || !user) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const updated =
      localNotes.slice(0, start) +
      symbol +
      localNotes.slice(end);

    setLocalNotes(updated);
    updateNotesDebounced(updated);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd =
        start + symbol.length;
    });
  };


  const insertAtCursor = (snippet: string) => {
    const textarea = document.getElementById("notes-area") as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const newText =
      localNotes.substring(0, start) +
      snippet +
      localNotes.substring(end);

    setLocalNotes(newText);
    updateNotesDebounced(newText);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd =
        start + snippet.length;
    });
  };

  /* ===== PATCH: TAG LOGIC ===== */
  const toggleTag = async (tag: NoteTag) => {
    if (!active || !user) return;

    try {
      setPlaylists((currentPlaylists) => {
        const p = currentPlaylists.find((p) => p.id === active.pid);
        if (!p) return currentPlaylists;

        const updatedLectures = p.lectures.map((l) => {
          if (l.id !== active.lid) return l;

          const tags = l.tags ?? [];
          const newTags = tags.includes(tag)
            ? tags.filter((t) => t !== tag)
            : [...tags, tag];

          return { ...l, tags: newTags };
        });

        updateDoc(
          doc(db, "users", user.uid, "playlists", p.id),
          { lectures: updatedLectures }
        ).catch((error) => {
          console.error("Error updating tags:", error);
        });

        const newTags = updatedLectures.find((l) => l.id === active.lid)?.tags || [];
        setActiveTags(newTags);

        return currentPlaylists.map((x) => (x.id === p.id ? { ...x, lectures: updatedLectures } : x));
      });
    } catch (error) {
      console.error("Error toggling tag:", error);
    }
  };

  /* ===== PATCH: EXPORT NOTES TO PDF ===== */
  const exportNotesPdf = () => {
    if (!current) return;

    const pdf = new jsPDF({
      unit: "pt",
      format: "a4",
    });

    const margin = 40;
    let y = margin;

    pdf.setFontSize(16);
    pdf.text(current.title, margin, y);
    y += 30;

    pdf.setFontSize(11);

    const safeText = (localNotes || "")
      .replace(/×/g, "x")
      .replace(/÷/g, "/")
      .replace(/√/g, "sqrt")
      .replace(/π/g, "pi")
      .replace(/≤/g, "<=")
      .replace(/≥/g, ">=")
      .replace(/≠/g, "!=")
      .replace(/≈/g, "~")
      .replace(/∞/g, "infinity");


    const lines = pdf.splitTextToSize(safeText || "No notes", 500);

    pdf.text(lines, margin, y);

    pdf.save(`${current.title}-notes.pdf`);
  };
  const getPlaylistProgress = (p: Playlist) => {
    if (p.lectures.length === 0) return 0;
    const done = p.lectures.filter(l => l.completed).length;
    return Math.round((done / p.lectures.length) * 100);
  };

  const deletePlaylist = async (pid: string) => {
    if (!user) return;

    const playlist = playlists.find(p => p.id === pid);
    if (playlist?.isFromAdmin) {
      toast({
        title: "Cannot delete",
        description: "You cannot delete recommended playlists",
        variant: "destructive",
      });
      return;
    }

    try {
      await deleteDoc(doc(db, "users", user.uid, "playlists", pid));
      setPlaylists((ps) => ps.filter((p) => p.id !== pid));
      // Clear active if deleted playlist was active
      if (active?.pid === pid) {
        setActive(null);
      }
      toast({
        title: "Success",
        description: "Playlist deleted successfully",
      });
    } catch (error: any) {
      console.error("Error deleting playlist:", error);
      toast({
        title: "Failed to delete playlist",
        description: error.message || "Could not delete playlist. Please try again.",
        variant: "destructive",
      });
    }
  };

  /* ---------- NAV HELPERS ---------- */

  const flatLectures = useMemo(
    () => playlists.flatMap((p) => p.lectures.map((l) => ({ ...l, pid: p.id }))),
    [playlists]
  );

  const goNext = useCallback(() => {
    if (!active) return;
    watchStartRef.current = null;

    const idx = flatLectures.findIndex(
      (l) => l.id === active.lid && l.pid === active.pid
    );

    if (idx >= 0 && idx < flatLectures.length - 1) {
      const next = flatLectures[idx + 1];
      setActive({ pid: next.pid, lid: next.id });

      // Track recently viewed
      setRecentlyViewed((prev) => {
        const filtered = prev.filter((rv) => !(rv.pid === next.pid && rv.lid === next.id));
        return [{ pid: next.pid, lid: next.id, timestamp: Date.now() }, ...filtered].slice(0, 10);
      });

      // Auto-play if enabled
      if (autoPlay) {
        setTimeout(() => {
          const iframe = document.querySelector("iframe[src*='youtube.com']") as HTMLIFrameElement;
          if (iframe && current) {
            iframe.src = `https://www.youtube.com/embed/${next.videoId}?autoplay=1`;
          }
        }, 100);
      }
    }
  }, [active, flatLectures, autoPlay]);

  const goPrev = useCallback(() => {
    if (!active) return;
    watchStartRef.current = null;

    const idx = flatLectures.findIndex(
      (l) => l.id === active.lid && l.pid === active.pid
    );

    if (idx > 0) {
      const prev = flatLectures[idx - 1];
      setActive({ pid: prev.pid, lid: prev.id });

      // Track recently viewed  
      const prevLecture = flatLectures[idx - 1];
      setRecentlyViewed((prev) => {
        const filtered = prev.filter((rv) => !(rv.pid === prevLecture.pid && rv.lid === prevLecture.id));
        return [{ pid: prevLecture.pid, lid: prevLecture.id, timestamp: Date.now() }, ...filtered].slice(0, 10);
      });
    }
  }, [active, flatLectures]);

  const nextLecture = useMemo(() => flatLectures.find((l) => !l.completed), [flatLectures]);

  /* ================= NEW FEATURES FUNCTIONS ================= */

  // SEARCH & FILTER
  const filteredAndSortedLectures = (playlist: Playlist) => {
    let lectures = [...playlist.lectures];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      lectures = lectures.filter(
        (l) =>
          l.title.toLowerCase().includes(query) ||
          (l.notes || "").toLowerCase().includes(query) ||
          l.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Apply completion filter
    if (filterOption === "completed") {
      lectures = lectures.filter((l) => l.completed);
    } else if (filterOption === "incomplete") {
      lectures = lectures.filter((l) => !l.completed);
    } else if (filterOption === "tagged") {
      lectures = lectures.filter((l) => l.tags && l.tags.length > 0);
    } else if (filterOption === "watched") {
      lectures = lectures.filter((l) => (l.watchTime || 0) > 0);
    }

    // Apply tag filter
    if (selectedTagFilter !== "all") {
      lectures = lectures.filter((l) => l.tags?.includes(selectedTagFilter));
    }

    // Apply sort
    if (sortOption === "title") {
      lectures.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortOption === "date") {
      lectures.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } else if (sortOption === "watchTime") {
      lectures.sort((a, b) => (b.watchTime || 0) - (a.watchTime || 0));
    } else if (sortOption === "completed") {
      lectures.sort((a, b) => (a.completed ? 1 : 0) - (b.completed ? 1 : 0));
    }
    // "custom" keeps original order

    return lectures;
  };

  // SORT & REORDER
  const moveLecture = async (p: Playlist, lid: string, direction: "up" | "down") => {
    if (!user) return;

    // Use current playlists state to ensure we have the latest data
    const currentPlaylist = playlists.find((pl) => pl.id === p.id);
    if (!currentPlaylist) return;

    const index = currentPlaylist.lectures.findIndex((l) => l.id === lid);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === currentPlaylist.lectures.length - 1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    const updated = [...currentPlaylist.lectures];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];

    try {
      await updateDoc(doc(db, "users", user.uid, "playlists", p.id), {
        lectures: updated,
      });

      setPlaylists((ps) =>
        ps.map((x) => (x.id === p.id ? { ...x, lectures: updated } : x))
      );
    } catch (error) {
      console.error("Error reordering lecture:", error);
    }
  };

  // TIMESTAMP NOTES
  const addTimestampNote = async (timestamp: number, note: string) => {
    if (!active || !user || !note.trim()) return;

    try {
      const newTimestampNote: TimestampNote = {
        id: crypto.randomUUID(),
        timestamp,
        note: note.trim(),
        createdAt: Date.now(),
      };

      if (active.isAdmin) {
        // Handle admin playlist
        setAdminPlaylists((currentPlaylists) => {
          const p = currentPlaylists.find((p) => p.id === active.pid);
          if (!p) return currentPlaylists;

          const updatedLectures = p.lectures.map((l) => {
            if (l.id !== active.lid) return l;
            return {
              ...l,
              timestampNotes: [...(l.timestampNotes || []), newTimestampNote].sort(
                (a, b) => a.timestamp - b.timestamp
              ),
            };
          });

          // Save to user-specific admin playlist data
          const userDataRef = doc(db, "users", user.uid, "admin_playlist_data", active.pid);
          const lectureData: Record<string, any> = {};
          updatedLectures.forEach((l) => {
            lectureData[l.id] = {
              notes: l.notes || "",
              completed: l.completed || false,
              watchTime: l.watchTime || 0,
              tags: l.tags || [],
              timestampNotes: l.timestampNotes || [],
            };
          });

          updateDoc(userDataRef, {
            lectures: lectureData,
            lastUpdated: Date.now(),
          }).catch((error) => {
            console.error("Error adding timestamp note:", error);
          });

          return currentPlaylists.map((x) => (x.id === active.pid ? { ...x, lectures: updatedLectures } : x));
        });
      } else {
        // Handle regular playlist
        setPlaylists((currentPlaylists) => {
          const p = currentPlaylists.find((p) => p.id === active.pid);
          if (!p) return currentPlaylists;

          const updatedLectures = p.lectures.map((l) => {
            if (l.id !== active.lid) return l;
            return {
              ...l,
              timestampNotes: [...(l.timestampNotes || []), newTimestampNote].sort(
                (a, b) => a.timestamp - b.timestamp
              ),
            };
          });

          updateDoc(doc(db, "users", user.uid, "playlists", p.id), {
            lectures: updatedLectures,
          }).catch((error) => {
            console.error("Error adding timestamp note:", error);
          });

          return currentPlaylists.map((x) => (x.id === p.id ? { ...x, lectures: updatedLectures } : x));
        });
      }
    } catch (error) {
      console.error("Error adding timestamp note:", error);
    }
  };

  const deleteTimestampNote = async (timestampId: string) => {
    if (!active || !user) return;

    try {
      if (active.isAdmin) {
        // Handle admin playlist
        setAdminPlaylists((currentPlaylists) => {
          const p = currentPlaylists.find((p) => p.id === active.pid);
          if (!p) return currentPlaylists;

          const updatedLectures = p.lectures.map((l) => {
            if (l.id !== active.lid) return l;
            return {
              ...l,
              timestampNotes: (l.timestampNotes || []).filter((tn) => tn.id !== timestampId),
            };
          });

          // Save to user-specific admin playlist data
          const userDataRef = doc(db, "users", user.uid, "admin_playlist_data", active.pid);
          const lectureData: Record<string, any> = {};
          updatedLectures.forEach((l) => {
            lectureData[l.id] = {
              notes: l.notes || "",
              completed: l.completed || false,
              watchTime: l.watchTime || 0,
              tags: l.tags || [],
              timestampNotes: l.timestampNotes || [],
            };
          });

          updateDoc(userDataRef, {
            lectures: lectureData,
            lastUpdated: Date.now(),
          }).catch((error) => {
            console.error("Error deleting timestamp note:", error);
          });

          return currentPlaylists.map((x) => (x.id === active.pid ? { ...x, lectures: updatedLectures } : x));
        });
      } else {
        // Handle regular playlist
        setPlaylists((currentPlaylists) => {
          const p = currentPlaylists.find((p) => p.id === active.pid);
          if (!p) return currentPlaylists;

          const updatedLectures = p.lectures.map((l) => {
            if (l.id !== active.lid) return l;
            return {
              ...l,
              timestampNotes: (l.timestampNotes || []).filter((tn) => tn.id !== timestampId),
            };
          });

          updateDoc(doc(db, "users", user.uid, "playlists", p.id), {
            lectures: updatedLectures,
          }).catch((error) => {
            console.error("Error deleting timestamp note:", error);
          });

          return currentPlaylists.map((x) => (x.id === p.id ? { ...x, lectures: updatedLectures } : x));
        });
      }
    } catch (error) {
      console.error("Error deleting timestamp note:", error);
    }
  };

  const jumpToTimestamp = (seconds: number) => {
    if (!current) return;
    const iframe = document.querySelector("iframe[src*='youtube.com']") as HTMLIFrameElement;
    if (iframe) {
      const baseUrl = `https://www.youtube.com/embed/${current.videoId}`;
      iframe.src = `${baseUrl}?start=${Math.floor(seconds)}&autoplay=1`;
    }
  };

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // TIMER
  useEffect(() => {
    if (timerActive && timerSeconds > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            // Switch mode when timer ends
            setTimerMode((currentMode) => {
              if (currentMode === "pomodoro") {
                setTimerSeconds(5 * 60); // 5 minute break
                return "break";
              } else {
                setTimerSeconds(25 * 60);
                return "pomodoro";
              }
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [timerActive]);

  const resetTimer = () => {
    setTimerActive(false);
    setTimerSeconds(timerMode === "pomodoro" ? 25 * 60 : 5 * 60);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // WORD COUNT
  const notesWordCount = useMemo(() => {
    if (!localNotes.trim()) return { words: 0, characters: 0, charactersNoSpaces: 0 };
    const words = localNotes.trim().split(/\s+/).filter(Boolean).length;
    const characters = localNotes.length;
    const charactersNoSpaces = localNotes.replace(/\s/g, "").length;
    return { words, characters, charactersNoSpaces };
  }, [localNotes]);

  // BULK OPERATIONS
  const toggleLectureSelection = useCallback((lid: string) => {
    setSelectedLectures((prev) => {
      const next = new Set(prev);
      if (next.has(lid)) {
        next.delete(lid);
      } else {
        next.add(lid);
      }
      return next;
    });
  }, []);

  const bulkMarkComplete = useCallback(async (p: Playlist) => {
    if (!user || selectedLectures.size === 0) return;
    try {
      setLoading(true);
      const updated = p.lectures.map((l) =>
        selectedLectures.has(l.id) ? { ...l, completed: true } : l
      );
      await updateDoc(doc(db, "users", user.uid, "playlists", p.id), { lectures: updated });
      setPlaylists((ps) => ps.map((x) => (x.id === p.id ? { ...x, lectures: updated } : x)));
      setSelectedLectures(new Set());
      setBulkMode(false);
      toast({ title: "Updated", description: `${selectedLectures.size} lecture(s) marked as complete.` });
    } catch (error) {
      console.error("Error bulk updating:", error);
      toast({ title: "Error", description: "Failed to update lectures.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, selectedLectures, toast]);

  const bulkDeleteLectures = useCallback(async (p: Playlist) => {
    if (!user || selectedLectures.size === 0) return;
    try {
      setLoading(true);
      const updated = p.lectures.filter((l) => !selectedLectures.has(l.id));
      await updateDoc(doc(db, "users", user.uid, "playlists", p.id), { lectures: updated });
      setPlaylists((ps) => ps.map((x) => (x.id === p.id ? { ...x, lectures: updated } : x)));
      setSelectedLectures(new Set());
      setBulkMode(false);
      toast({ title: "Deleted", description: `${selectedLectures.size} lecture(s) deleted.` });
    } catch (error) {
      console.error("Error bulk deleting:", error);
      toast({ title: "Error", description: "Failed to delete lectures.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, selectedLectures, toast]);

  // UPDATE PLAYLIST DESCRIPTION
  const updatePlaylistDescription = useCallback(async (pid: string, description: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid, "playlists", pid), { description });
      setPlaylists((ps) => ps.map((p) => (p.id === pid ? { ...p, description } : p)));
      setShowPlaylistDescriptionDialog(false);
      setEditingPlaylistId(null);
      setPlaylistDescriptionInput("");
      toast({ title: "Updated", description: "Playlist description updated." });
    } catch (error) {
      console.error("Error updating description:", error);
      toast({ title: "Error", description: "Failed to update description.", variant: "destructive" });
    }
  }, [user, toast]);

  // UPDATE PLAYLIST DUE DATE
  const updatePlaylistDueDate = useCallback(async (pid: string, dueDate: number | null) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid, "playlists", pid), { dueDate: dueDate || null });
      setPlaylists((ps) => ps.map((p) => (p.id === pid ? { ...p, dueDate: dueDate || undefined } : p)));
      toast({ title: "Updated", description: dueDate ? "Due date set." : "Due date removed." });
    } catch (error) {
      console.error("Error updating due date:", error);
      toast({ title: "Error", description: "Failed to update due date.", variant: "destructive" });
    }
  }, [user, toast]);

  // INSERT NOTES TEMPLATE
  const insertTemplate = useCallback((template: NoteTemplate) => {
    const textarea = document.getElementById("notes-area") as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = localNotes.substring(0, start) + template.content + localNotes.substring(end);
    setLocalNotes(newText);
    updateNotesDebounced(newText);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + template.content.length;
    });
  }, [localNotes, updateNotesDebounced]);

  // UPDATE PLAYBACK SPEED
  useEffect(() => {
    if (!current || !iframeRef.current) return;
    const iframe = iframeRef.current;
    const url = new URL(iframe.src);
    const baseUrl = url.origin + url.pathname;
    url.searchParams.set("playbackRate", playbackSpeed.toString());
    iframe.src = url.toString();
  }, [playbackSpeed, current?.videoId]);

  // TRACK RECENTLY VIEWED ON ACTIVE CHANGE
  useEffect(() => {
    if (!active || !user) return;
    setRecentlyViewed((prev) => {
      const filtered = prev.filter((rv) => !(rv.pid === active.pid && rv.lid === active.lid));
      return [{ pid: active.pid, lid: active.lid, timestamp: Date.now() }, ...filtered].slice(0, 10);
    });

    updateDoc(doc(db, "users", user.uid, "playlists", active.pid), {
      lastAccessed: Date.now(),
    }).catch(console.error);
  }, [active, user]);

  /* ================= UI ================= */

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100/20 via-background to-background dark:from-indigo-950/20 dark:via-background dark:to-background transition-colors duration-500 animate-in fade-in duration-700">
        {/* MAIN */}
        <main className="container mx-auto px-4 py-6 max-w-[1800px]">
          <div className={`grid gap-6 ${focusMode ? "grid-cols-1" : "lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)]"}`}>
            {/* SIDEBAR */}
            {!focusMode && (
              <div className={cn("space-y-6 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-2 pb-10",
                "scrollbar-thin scrollbar-thumb-primary/10 hover:scrollbar-thumb-primary/20 scrollbar-track-transparent transition-colors"
              )}>
                {/* SEARCH & FILTER */}
                <div className="space-y-4">
                  <div className="relative group z-10">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <Card className="relative border-0 shadow-sm bg-background/60 backdrop-blur-xl ring-1 ring-border/50 overflow-hidden">
                      <CardContent className="p-3 space-y-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search lectures..."
                        className="pl-9 bg-muted/30 border-transparent focus:bg-background focus:border-primary/20 focus:ring-2 focus:ring-primary/10 transition-all h-10"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Select value={filterOption} onValueChange={(v) => setFilterOption(v as FilterOption)}>
                        <SelectTrigger className="flex-1 h-9 bg-muted/30 border-transparent hover:bg-muted/50 focus:ring-primary/10 text-xs">
                          <Filter className="h-3.5 w-3.5 mr-2 opacity-70" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Lectures</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="incomplete">Incomplete</SelectItem>
                          <SelectItem value="tagged">Tagged</SelectItem>
                          <SelectItem value="watched">Watched</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                        <SelectTrigger className="flex-1 h-9 bg-muted/30 border-transparent hover:bg-muted/50 focus:ring-primary/10 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom">Custom Order</SelectItem>
                          <SelectItem value="title">Title (A-Z)</SelectItem>
                          <SelectItem value="date">Date Added</SelectItem>
                          <SelectItem value="watchTime">Watch Time</SelectItem>
                          <SelectItem value="completed">Completion Status</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
                  </div>

                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1 group">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <Input
                      value={newPlaylist}
                      onChange={(e) => setNewPlaylist(e.target.value)}
                      placeholder="New playlist name..."
                      className="relative bg-background/60 backdrop-blur-xl border-border/50 focus:border-primary/30 focus:ring-2 focus:ring-primary/10 h-10 transition-all"
                      onKeyDown={(e) => e.key === "Enter" && addPlaylist()}
                    />
                    </div>
                    <Button
                      onClick={addPlaylist}
                      className="shrink-0 h-10 w-10 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-105 transition-all"
                      size="icon"
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* Error Alert */}
                {error && (
                  <Alert variant="destructive" className={cn("backdrop-blur-xl border-0 ring-1 ring-destructive/30 shadow-lg",
                    theme === "dark" ? "bg-destructive/20 border-destructive/30" : "bg-destructive/10 border-destructive"
                  )}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* RECOMMENDED PLAYLISTS SECTION */}
                <div className={cn("space-y-4 mb-8 p-1 rounded-3xl transition-all duration-300",
                  theme === "dark"
                    ? "bg-gradient-to-b from-white/5 to-transparent"
                    : "bg-gradient-to-b from-black/5 to-transparent"
                )}>
                  <div className="flex items-center justify-between mb-4 px-2">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2.5 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 shadow-inner",
                        theme === "dark" ? "backdrop-blur-sm" : ""
                      )}>
                        <Sparkles className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className={cn("text-base font-bold tracking-tight", theme === "dark" ? "text-white" : "text-foreground")}>
                          Recommended Playlists
                        </h3>
                        <p className="text-xs text-muted-foreground">Curated by administrators</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                      <Shield className="h-3 w-3 mr-1" />
                      {adminPlaylists.length}
                    </Badge>
                  </div>

                  {loadingAdminPlaylists ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : adminPlaylists.length === 0 ? (
                    <div className="text-center py-8">
                      <Star className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No recommended playlists available</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {adminPlaylists.map((p, i) => {
                        const filteredLectures = p.lectures.filter(l => {
                          const matchesSearch = !searchQuery ||
                            l.title.toLowerCase().includes(searchQuery.toLowerCase());
                          if (!matchesSearch) return false;

                          if (filterOption === "completed") return l.completed;
                          if (filterOption === "incomplete") return !l.completed;
                          if (filterOption === "tagged") return (l.tags || []).length > 0;
                          if (filterOption === "watched") return (l.watchTime || 0) > 0;
                          return true;
                        });

                        return (
                          <Card
                            key={`admin-${p.id}`}
                            style={{ animationDelay: `${i * 100}ms` }}
                            className={cn("border-0 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden backdrop-blur-xl group ring-1 ring-border/50 animate-in slide-in-from-left-4 fade-in duration-500",
                              theme === "dark"
                                ? "bg-background/40 hover:bg-background/60"
                                : "bg-white/60 hover:bg-white/80",
                              active?.pid === p.id && active?.isAdmin && "ring-2 ring-primary/50 shadow-lg shadow-primary/10 scale-[1.01]"
                            )}
                          >
                            <CardHeader className="p-4 pb-2 space-y-2 relative">
                              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity -z-10 blur-xl" />
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <CardTitle className="text-base font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                                      {p.title}
                                    </CardTitle>
                                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 backdrop-blur-sm text-[10px] h-5 px-1.5">
                                      <Shield className="h-3 w-3 mr-1" />
                                      Recommended
                                    </Badge>
                                  </div>
                                  {p.description && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                                  )}
                                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Play className="h-3 w-3" />
                                      {p.lectures.length} lectures
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-1 p-4 pt-0">
                              {filteredLectures.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-4">No lectures match your filters</p>
                              ) : (
                                <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                                  {filteredLectures.map((l) => (
                                    <button
                                      key={l.id}
                                      onClick={() => setActive({ pid: p.id, lid: l.id, isAdmin: true })}
                                      className={cn(
                                        "w-full text-left p-2 rounded-lg transition-all text-sm group/item",
                                        theme === "dark"
                                          ? active?.pid === p.id && active?.lid === l.id && active?.isAdmin
                                            ? "bg-primary/20 text-primary-foreground shadow-sm ring-1 ring-primary/20"
                                            : "hover:bg-white/5 text-muted-foreground hover:text-foreground"
                                          : active?.pid === p.id && active?.lid === l.id && active?.isAdmin
                                            ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                                            : "hover:bg-black/5 text-muted-foreground hover:text-foreground"
                                      )}
                                    >
                                      <div className="flex items-center gap-3">
                                        {l.completed ? (
                                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                                        ) : (
                                          <div className="h-4 w-4 rounded-full border-2 border-current shrink-0 opacity-50 group-hover/item:opacity-100 transition-opacity" />
                                        )}
                                        <span className="truncate flex-1 font-medium">{l.title}</span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* CUSTOM PLAYLISTS SECTION */}
                <div className={cn("space-y-4 p-1 rounded-3xl transition-all duration-300",
                  theme === "dark"
                    ? "bg-gradient-to-b from-white/5 to-transparent"
                    : "bg-gradient-to-b from-black/5 to-transparent"
                )}>
                  <div className="flex items-center justify-between mb-4 px-2">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2.5 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 shadow-inner",
                        theme === "dark" ? "backdrop-blur-sm" : ""
                      )}>
                        <Bookmark className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <h3 className={cn("text-base font-bold tracking-tight", theme === "dark" ? "text-white" : "text-foreground")}>
                          My Custom Playlists
                        </h3>
                        <p className="text-xs text-muted-foreground">Your personal playlists</p>
                      </div>
                    </div>
                    {playlists.length > 0 && (
                      <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-0">
                        {playlists.length}
                      </Badge>
                    )}
                  </div>

                  {loadingPlaylists ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : playlists.length === 0 ? (
                    <div className="text-center py-8">
                      <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground mb-2">No custom playlists yet</p>
                      <p className="text-xs text-muted-foreground">Create your first playlist above</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {playlists.map((p, i) => {
                        const filteredLectures = filteredAndSortedLectures(p);
                        return (
                          <Card
                            key={p.id}
                            style={{ animationDelay: `${(i + adminPlaylists.length) * 100}ms` }}
                            className={cn("border-0 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden backdrop-blur-xl ring-1 ring-border/50 animate-in slide-in-from-left-4 fade-in duration-500",
                              theme === "dark" ? "bg-background/40 hover:bg-background/60" : "bg-white/60 hover:bg-white/80",
                              active?.pid === p.id && !active?.isAdmin && "ring-2 ring-primary/50 shadow-lg shadow-primary/10 scale-[1.01]"
                            )}
                          >
                            <CardHeader className="p-4 pb-2 space-y-2 relative">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-base font-bold">{p.title}</CardTitle>
                                  {p.description && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{p.description}</p>
                                  )}
                                  {p.dueDate && (
                                    <Badge variant="outline" className="mt-1 text-xs">
                                      <Calendar className="h-3 w-3 mr-1" />
                                      Due: {new Date(p.dueDate).toLocaleDateString()}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Popover
                                          open={dueDatePopoverOpen[p.id]}
                                          onOpenChange={(open) =>
                                            setDueDatePopoverOpen({ ...dueDatePopoverOpen, [p.id]: open })
                                          }
                                        >
                                          <PopoverTrigger asChild>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-8 w-8"
                                            >
                                              <Calendar className="h-4 w-4" />
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-auto p-0" align="end">
                                            <CalendarComponent
                                              mode="single"
                                              selected={p.dueDate ? new Date(p.dueDate) : undefined}
                                              onSelect={(date) => {
                                                if (date) {
                                                  updatePlaylistDueDate(p.id, date.getTime());
                                                } else {
                                                  updatePlaylistDueDate(p.id, null);
                                                }
                                                setDueDatePopoverOpen({ ...dueDatePopoverOpen, [p.id]: false });
                                              }}
                                              disabled={(date) => date < new Date()}
                                            />
                                            {p.dueDate && (
                                              <div className="p-3 border-t">
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  className="w-full"
                                                  onClick={() => {
                                                    updatePlaylistDueDate(p.id, null);
                                                    setDueDatePopoverOpen({ ...dueDatePopoverOpen, [p.id]: false });
                                                  }}
                                                >
                                                  Clear Due Date
                                                </Button>
                                              </div>
                                            )}
                                          </PopoverContent>
                                        </Popover>
                                      </TooltipTrigger>
                                      <TooltipContent>Set Due Date</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8"
                                          onClick={() => {
                                            setEditingPlaylistId(p.id);
                                            setPlaylistDescriptionInput(p.description || "");
                                            setShowPlaylistDescriptionDialog(true);
                                          }}
                                        >
                                          <FileText className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Edit Description</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8"
                                          onClick={() => setShowPlaylistStats(p.id)}
                                        >
                                          <BarChart3 className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Playlist Statistics</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-8 w-8 text-destructive hover:text-destructive"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Delete Playlist</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Playlist?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete "{p.title}"? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => deletePlaylist(p.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>

                              {(() => {
                                const progress = getPlaylistProgress(p);

                                return (
                                  <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-medium text-muted-foreground">
                                      <span>{progress}% completed</span>
                                      <span>
                                        {p.lectures.filter(l => l.completed).length}/{p.lectures.length}
                                      </span>
                                    </div>

                                    <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden shadow-inner">
                                      <div
                                        className="h-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-500 ease-out rounded-full"
                                        style={{ width: `${progress}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })()}
                            </CardHeader>

                            <CardContent className="space-y-2 p-4 pt-0">
                              {filteredLectures.length === 0 && p.lectures.length > 0 && (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                  No lectures match your filters
                                </div>
                              )}
                              <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
                                {filteredLectures.map((l, index) => (
                                  <div
                                    key={l.id}
                                    className={`relative group flex gap-2 p-2 rounded-lg transition-all duration-200 ${active?.lid === l.id
                                      ? "bg-primary/10 ring-1 ring-primary/20 shadow-sm"
                                      : "hover:bg-black/5 dark:hover:bg-white/5"
                                      }`}
                                  >
                                    {sortOption === "custom" && (
                                      <div className="flex flex-col gap-0.5 justify-center">
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-5 w-5"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            moveLecture(p, l.id, "up");
                                          }}
                                          disabled={index === 0}
                                        >
                                          <ArrowUp className="h-3 w-3 opacity-50" />
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-5 w-5"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            moveLecture(p, l.id, "down");
                                          }}
                                          disabled={index === filteredLectures.length - 1}
                                        >
                                          <ArrowDown className="h-3 w-3 opacity-50" />
                                        </Button>
                                      </div>
                                    )}
                                    <div
                                      onClick={() => setActive({ pid: p.id, lid: l.id })}
                                      className="flex-1 flex gap-2 cursor-pointer items-center"
                                    >
                                      <div className="relative w-24 aspect-video bg-black rounded-md overflow-hidden shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
                                        <img
                                          src={`https://img.youtube.com/vi/${l.videoId}/mqdefault.jpg`}
                                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                          alt={l.title}
                                        />
                                        {/* HOVER ACTIONS */}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                          <Button
                                            size="icon"
                                            variant="secondary"
                                            className="h-6 w-6 bg-background/90 backdrop-blur-sm hover:bg-background shadow-sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleComplete(p, l.id);
                                            }}
                                          >
                                            <Check className="h-3 w-3" />
                                          </Button>

                                          <Button
                                            size="icon"
                                            variant="secondary"
                                            className="h-6 w-6 bg-background/90 backdrop-blur-sm hover:bg-background shadow-sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setFocusMode(true);
                                              setActive({ pid: p.id, lid: l.id });
                                            }}
                                          >
                                            <Focus className="h-3 w-3" />
                                          </Button>
                                        </div>

                                        {l.completed && (
                                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg backdrop-blur-[1px]">
                                            <div className="bg-primary rounded-full p-1.5">
                                              <Check className="text-primary-foreground h-3 w-3" />
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium line-clamp-2 leading-tight">{l.title}</p>
                                        {l.watchTime && (
                                          <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                            <span>⏱️</span>
                                            <span>Watched: {l.watchTime} min</span>
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div className="space-y-2 pt-2 border-t px-1">
                                <Input
                                  placeholder="Lecture title"
                                  value={newLectureTitle}
                                  onChange={(e) => setNewLectureTitle(e.target.value)}
                                  className="h-8 text-xs bg-muted/30 border-transparent focus:bg-background focus:border-primary/20 focus:ring-2 focus:ring-primary/10"
                                />
                                <Input
                                  placeholder="YouTube link"
                                  value={newLectureUrl}
                                  onChange={(e) => setNewLectureUrl(e.target.value)}
                                  className="h-8 text-xs bg-muted/30 border-transparent focus:bg-background focus:border-primary/20 focus:ring-2 focus:ring-primary/10"
                                />
                                <Button
                                  onClick={() => addLecture(p)}
                                  className="w-full h-8 text-xs shadow-sm"
                                  size="sm"
                                >
                                  Add lecture
                                </Button>

                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setBulkMode(!bulkMode);
                                      setSelectedLectures(new Set());
                                    }}
                                    className="flex-1"
                                  >
                                    {bulkMode ? "Cancel" : "Bulk Select"}
                                  </Button>
                                  {bulkMode && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => bulkMarkComplete(p)}
                                        disabled={selectedLectures.size === 0}
                                        className="flex-1"
                                      >
                                        Mark Selected
                                      </Button>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button
                                            size="sm"
                                            variant="destructive"
                                            disabled={selectedLectures.size === 0}
                                            className="flex-1"
                                          >
                                            Delete Selected
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Delete Selected Lectures?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Are you sure you want to delete {selectedLectures.size} lecture(s)? This action cannot be undone.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => bulkDeleteLectures(p)}
                                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                              Delete
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </>
                                  )}
                                  {!bulkMode && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          className="flex-1"
                                        >
                                          Delete playlist
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete Playlist?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Are you sure you want to delete "{p.title}"? This action cannot be undone.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => deletePlaylist(p.id)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            Delete
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PLAYER + NOTES */}
            <div className={cn(`${theatre ? "fixed inset-0 z-[100] bg-black p-4 md:p-8" : "sticky top-6"} transition-all duration-500 ease-in-out`)}>
              <Card className={cn(`shadow-2xl border-0 ring-1 ring-white/10 backdrop-blur-xl transition-all duration-500 overflow-hidden`,
                theme === "dark" ? "bg-background/60" : "bg-white/70",
                theatre ? "h-full flex flex-col" : ""
              )}>
                {current ? (
                  <>
                    <div className={cn("w-full transition-all duration-500", !theatre && "p-4 pb-0")}>
                      <div className={cn(`mx-auto ${theatre ? "h-full w-full" : "max-w-4xl rounded-xl shadow-2xl ring-1 ring-white/10"} aspect-video bg-black overflow-hidden relative group transition-all duration-500`)}>
                      {/* Blur effect behind video */}
                      <div className={cn("absolute inset-0 -z-10 blur-3xl opacity-30 transition-opacity",
                        theme === "dark" ? "bg-gradient-to-br from-primary/40 via-purple-500/40 to-pink-500/40" : "bg-gradient-to-br from-primary/20 via-purple-500/20 to-pink-500/20"
                      )}
                        style={{
                          backgroundImage: `url(https://img.youtube.com/vi/${current.videoId}/maxresdefault.jpg)`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }}
                      />
                      <iframe
                        ref={iframeRef}
                        src={`https://www.youtube.com/embed/${current.videoId}`}
                        className="w-full h-full relative z-10"
                        allowFullScreen
                        onLoad={() => (watchStartRef.current = Date.now())}
                      />
                      {/* TIMER OVERLAY */}
                      {timerActive && (
                        <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm border-2 rounded-lg p-3 shadow-lg z-20 animate-in fade-in zoom-in duration-300">
                          <div className="flex items-center gap-3">
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">{timerMode === "pomodoro" ? "Study" : "Break"}</p>
                              <p className="text-2xl font-bold font-mono">{formatTimer(timerSeconds)}</p>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setTimerActive(!timerActive)}
                              >
                                {timerActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={resetTimer}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    </div>

                    <CardContent className="space-y-5 p-6 max-w-5xl mx-auto w-full">
                      <div className="flex justify-between items-start gap-4">
                        <h2 className="text-2xl font-bold leading-tight flex-1 tracking-tight">{current.title}</h2>
                        <div className="flex gap-2">
                          <Button
                            variant={timerActive ? "default" : "outline"}
                            size="sm"
                            onClick={() => setTimerActive(!timerActive)}
                          >
                            <Timer className="h-4 w-4 mr-2" />
                            {timerActive ? "Pause" : "Start Timer"}
                          </Button>
                          <Button
                            onClick={() => setTheatre(!theatre)}
                            variant="outline"
                            size="icon"
                            className="shrink-0"
                          >
                            {theatre ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      {showFocusTip && (
                        <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-gradient-to-r from-primary/5 to-purple-500/5 border border-primary/10">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-2xl">💡</span>
                            <span className="text-muted-foreground">
                              Press <kbd className="px-2 py-1 bg-background border rounded font-mono text-xs font-semibold">J</kbd> / <kbd className="px-2 py-1 bg-background border rounded font-mono text-xs font-semibold">K</kbd> to navigate
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowFocusTip(false)}
                            className="shrink-0"
                          >
                            Got it
                          </Button>
                        </div>
                      )}

                      {/* NOTES */}
                      <div className="space-y-4">
                        {/* EDITOR CONTAINER */}
                        <div className="flex flex-col border rounded-xl bg-background/50 shadow-sm transition-all focus-within:border-primary/30 focus-within:ring-4 focus-within:ring-primary/5 relative overflow-hidden">
                          {/* TOOLBAR */}
                          <div className="flex items-center justify-between p-2 bg-muted/30 border-b gap-2 overflow-x-auto scrollbar-none rounded-t-xl">
                            <div className="flex items-center gap-1">
                              {/* Templates */}
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground">
                                    <FileText className="h-4 w-4 mr-1.5" />
                                    Templates
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent align="start" className="w-48 p-1">
                                  <div className="flex flex-col gap-1">
                                    {noteTemplates.map((t) => (
                                      <Button key={t.name} variant="ghost" size="sm" className="justify-start h-8 font-normal" onClick={() => insertTemplate(t)}>
                                        {t.name}
                                      </Button>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>

                              <div className="w-px h-4 bg-border mx-1" />

                              {/* Tags */}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant={activeTags.includes("important") ? "secondary" : "ghost"}
                                      size="icon"
                                      className={cn("h-8 w-8", activeTags.includes("important") && "text-yellow-500 bg-yellow-500/10")}
                                      onClick={() => toggleTag("important")}
                                    >
                                      <Star className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Mark as Important</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant={activeTags.includes("formula") ? "secondary" : "ghost"}
                                      size="icon"
                                      className={cn("h-8 w-8", activeTags.includes("formula") && "text-blue-500 bg-blue-500/10")}
                                      onClick={() => toggleTag("formula")}
                                    >
                                      <Sparkles className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Mark as Formula</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant={activeTags.includes("doubt") ? "secondary" : "ghost"}
                                      size="icon"
                                      className={cn("h-8 w-8", activeTags.includes("doubt") && "text-red-500 bg-red-500/10")}
                                      onClick={() => toggleTag("doubt")}
                                    >
                                      <AlertCircle className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Mark as Doubt</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <div className="w-px h-4 bg-border mx-1" />

                              {/* Timestamp Trigger */}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowTimestampDialog(true)}>
                                      <Bookmark className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Add Timestamp Bookmark</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              {/* Symbol Pad Toggle */}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant={showSymbolPad ? "secondary" : "ghost"}
                                      size="icon"
                                      className="h-8 w-8"
                                      ref={symbolButtonRef}
                                      onClick={() => setShowSymbolPad(!showSymbolPad)}
                                    >
                                      <span className="text-lg leading-none font-serif">∑</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Math Symbols</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>

                            <div className="flex items-center gap-3">
                              {/* Save Status */}
                              <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground hidden sm:inline-block">
                                {saveStatus === "typing" && "Typing..."}
                                {saveStatus === "saving" && "Saving..."}
                                {saveStatus === "saved" && "Saved"}
                              </span>
                              {/* Export */}
                              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={exportNotesPdf}>
                                Export PDF
                              </Button>
                            </div>
                          </div>

                          {/* TEXTAREA */}
                          <div className="relative bg-card">
                          <Textarea
                            id="notes-area"
                            value={localNotes}
                            onChange={(e) => updateNotesDebounced(e.target.value)}
                            className="min-h-[300px] border-0 focus-visible:ring-0 rounded-none resize-y p-4 font-mono text-sm leading-relaxed bg-transparent"
                            placeholder={`Write notes normally.

Examples:
force = mass × acceleration
angle = 90°
area = πr²`}
                          />
                          </div>

                          {/* FOOTER INFO */}
                          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/20 border-t text-[10px] text-muted-foreground rounded-b-xl">
                            <span>{notesWordCount.words} words • {notesWordCount.characters} chars</span>
                            <span>Markdown supported</span>
                          </div>
                        </div>

                        {/* SYMBOL PICKER */}
                        {showSymbolPad && (
                          <div
                            ref={symbolPopupRef}
                            className="absolute bottom-24 right-4 z-50 w-[340px] max-h-[320px] overflow-y-auto rounded-xl border-2 bg-background shadow-2xl p-4 animate-in fade-in slide-in-from-bottom-2"
                          >
                            <div className="space-y-4">
                              {Object.entries(SYMBOL_GROUPS).map(([group, symbols]) => (
                                <div key={group}>
                                  <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">
                                    {group}
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {symbols.map((s) => (
                                      <button
                                        key={s}
                                        onClick={() => insertSymbol(s)}
                                        className="h-10 min-w-[40px] px-3 rounded-lg border-2 bg-muted hover:bg-primary hover:text-primary-foreground hover:border-primary hover:scale-110 text-base font-medium transition-all duration-200 active:scale-95"
                                      >
                                        {s}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* TIMESTAMP CHIPS */}
                        {current.timestampNotes && current.timestampNotes.length > 0 && (
                          <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2">
                            {current.timestampNotes.map((tn) => (
                              <Badge
                                key={tn.id}
                                variant="outline"
                                className="pl-2 pr-1 py-1 h-auto gap-2 hover:bg-muted cursor-pointer transition-colors group"
                                onClick={() => jumpToTimestamp(tn.timestamp)}
                              >
                                <span className="font-mono text-xs text-primary font-bold">{formatTimestamp(tn.timestamp)}</span>
                                <span className="max-w-[200px] truncate font-normal text-muted-foreground">{tn.note}</span>
                                <Button size="icon" variant="ghost" className="h-4 w-4 ml-1 hover:text-destructive hover:bg-destructive/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); deleteTimestampNote(tn.id); }}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* TIMESTAMP DIALOG */}
                        <Dialog open={showTimestampDialog} onOpenChange={setShowTimestampDialog}>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Add Timestamp Bookmark</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div>
                                <label className="text-sm font-medium mb-2 block">
                                  Timestamp (format: MM:SS or seconds)
                                </label>
                                <Input
                                  value={timestampInput}
                                  onChange={(e) => setTimestampInput(e.target.value)}
                                  placeholder="e.g., 5:30 or 330"
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium mb-2 block">Note</label>
                                <Textarea
                                  value={timestampNoteInput}
                                  onChange={(e) => setTimestampNoteInput(e.target.value)}
                                  placeholder="Add a note for this timestamp..."
                                  rows={3}
                                />
                              </div>
                              <Button
                                onClick={() => {
                                  const timeStr = timestampInput.trim();
                                  let seconds = 0;
                                  if (timeStr.includes(":")) {
                                    const parts = timeStr.split(":").map(Number);
                                    if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
                                  } else {
                                    seconds = parseInt(timeStr) || 0;
                                  }
                                  if (seconds > 0 && timestampNoteInput.trim()) {
                                    addTimestampNote(seconds, timestampNoteInput);
                                    setTimestampInput("");
                                    setTimestampNoteInput("");
                                    setShowTimestampDialog(false);
                                  }
                                }}
                                className="w-full"
                              >
                                Add Bookmark
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        {aiSummary && (
                          <div className="p-4 rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-purple-500/5 whitespace-pre-line text-sm leading-relaxed">
                            {aiSummary}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t mt-4">
                        <Button
                          onClick={() => {
                            const p = active?.isAdmin
                              ? adminPlaylists.find((p) => p.id === active.pid)
                              : playlists.find((p) => p.id === active.pid);
                            if (p) toggleComplete(p, active!.lid);
                          }}
                          className={cn(
                            "flex-1 h-auto py-3 px-4 justify-start gap-3 relative overflow-hidden group",
                            current.completed
                              ? "border-2 bg-background hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                              : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                          )}
                          variant={current.completed ? "outline" : "default"}
                        >
                          <div className={cn(
                            "p-2 rounded-full transition-colors",
                            current.completed ? "bg-muted group-hover:bg-muted/80" : "bg-white/20"
                          )}>
                            <Check className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col items-start text-left">
                            <span className="text-[10px] uppercase tracking-wider font-medium opacity-80">
                              {current.completed ? "Completed" : "Current Lecture"}
                            </span>
                            <span className="text-sm font-bold">
                              {current.completed ? "Mark as Unwatched" : "Mark as Watched"}
                            </span>
                          </div>
                        </Button>

                        {nextLecture ? (
                          <div
                            className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg border bg-card hover:bg-accent/50 transition-all cursor-pointer group relative overflow-hidden hover:scale-[1.02] active:scale-[0.98] duration-200"
                            onClick={goNext}
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="p-2 rounded-full bg-primary/10 text-primary shrink-0 group-hover:scale-110 transition-transform">
                              <Sparkles className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col items-start">
                              <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
                                Up Next
                              </span>
                              <span className="text-sm font-bold truncate w-full">
                                {nextLecture.title}
                              </span>
                            </div>
                            <ArrowUp className="h-4 w-4 text-muted-foreground rotate-90 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed text-muted-foreground bg-muted/20">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-sm font-medium">Playlist Completed</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </>
                ) : (
                  <div className="aspect-video flex flex-col items-center justify-center text-muted-foreground bg-muted/30 rounded-lg">
                    <PlayCircle className="h-16 w-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium">Select a lecture to get started</p>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </main>

        {/* PLAYLIST DESCRIPTION DIALOG */}
        <Dialog open={showPlaylistDescriptionDialog} onOpenChange={setShowPlaylistDescriptionDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Playlist Description</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Textarea
                value={playlistDescriptionInput}
                onChange={(e) => setPlaylistDescriptionInput(e.target.value)}
                placeholder="Add a description for this playlist..."
                rows={4}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPlaylistDescriptionDialog(false);
                    setEditingPlaylistId(null);
                    setPlaylistDescriptionInput("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (editingPlaylistId) {
                      updatePlaylistDescription(editingPlaylistId, playlistDescriptionInput);
                    }
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* PER-PLAYLIST STATISTICS DIALOG */}
        {showPlaylistStats && (() => {
          const playlist = playlists.find((p) => p.id === showPlaylistStats);
          if (!playlist) return null;

          const totalLectures = playlist.lectures.length;
          const completedLectures = playlist.lectures.filter((l) => l.completed).length;
          const totalWatchTime = playlist.lectures.reduce((sum, l) => sum + (l.watchTime || 0), 0);
          const completionRate = totalLectures > 0 ? (completedLectures / totalLectures) * 100 : 0;
          const avgWatchTime = totalLectures > 0 ? totalWatchTime / totalLectures : 0;
          const notesCount = playlist.lectures.filter((l) => l.notes && l.notes.trim()).length;

          return (
            <Dialog open={!!showPlaylistStats} onOpenChange={(open) => !open && setShowPlaylistStats(null)}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{playlist.title} - Statistics</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Total Lectures</p>
                        <p className="text-2xl font-bold">{totalLectures}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Completed</p>
                        <p className="text-2xl font-bold">{completedLectures}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Total Watch Time</p>
                        <p className="text-2xl font-bold">{totalWatchTime}m</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Completion Rate</p>
                        <p className="text-2xl font-bold">{completionRate.toFixed(0)}%</p>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Average Watch Time</p>
                        <p className="text-xl font-bold">{avgWatchTime.toFixed(1)}m</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Lectures with Notes</p>
                        <p className="text-xl font-bold">{notesCount}</p>
                      </CardContent>
                    </Card>
                  </div>
                  {playlist.lastAccessed && (
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Last Accessed</p>
                        <p className="text-lg font-bold">{new Date(playlist.lastAccessed).toLocaleString()}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          );
        })()}
      </div>
    </TooltipProvider>
  );
}