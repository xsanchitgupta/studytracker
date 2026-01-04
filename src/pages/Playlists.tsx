import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
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
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

import {
  ArrowLeft,
  Plus,
  Trash2,
  Settings,
  PlayCircle,
  Check,
  Maximize,
  Minimize,
  Focus,
  Flame,
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
  Copy,
  Download,
  Upload,
  FileText,
  Archive,
  Calendar,
  HelpCircle,
  BarChart3,
  Bookmark,
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
  const navigate = useNavigate();
  const symbolButtonRef = useRef<HTMLButtonElement | null>(null);
  const symbolPopupRef = useRef<HTMLDivElement | null>(null);

  /* ===== PATCH: TAG + PDF + AI STATES ===== */
  const [activeTags, setActiveTags] = useState<NoteTag[]>([]);
  const [showMathPad, setShowMathPad] = useState(false);
  const [aiError, setAiError] = useState("");

  const watchStartRef = useRef<number | null>(null);
  const notesSaveTimer = useRef<NodeJS.Timeout | null>(null);

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [active, setActive] = useState<{ pid: string; lid: string } | null>(null);

  const [newPlaylist, setNewPlaylist] = useState("");
  const [newLectureTitle, setNewLectureTitle] = useState("");
  const [newLectureUrl, setNewLectureUrl] = useState("");

  const [theatre, setTheatre] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [streak] = useState(3);
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
  const [showArchived, setShowArchived] = useState(false);

  // Sort
  const [sortOption, setSortOption] = useState<SortOption>("custom");

  // Statistics
  const [showStats, setShowStats] = useState(false);

  // Timer
  const [timerActive, setTimerActive] = useState(false);
  const [timerMode, setTimerMode] = useState<"pomodoro" | "break">("pomodoro");
  const [timerSeconds, setTimerSeconds] = useState(25 * 60); // 25 minutes default
  const [sessionMinutes, setSessionMinutes] = useState(0);
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

  // Notes templates
  const noteTemplates: NoteTemplate[] = [
    { name: "Summary", content: "## Summary\n\nKey Points:\n- \n- \n- \n\nTakeaways:\n- " },
    { name: "Problem Set", content: "## Problem Set\n\nProblem 1:\nSolution:\n\nProblem 2:\nSolution:\n" },
    { name: "Definitions", content: "## Definitions\n\n\n" },
    { name: "Formulas", content: "## Formulas\n\n\n" },
  ];

  // Keyboard shortcuts help
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Loading states
  const [loading, setLoading] = useState(false);

  // Playlist dialogs
  const [showPlaylistDescriptionDialog, setShowPlaylistDescriptionDialog] = useState(false);
  const [playlistDescriptionInput, setPlaylistDescriptionInput] = useState("");
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [dueDatePopoverOpen, setDueDatePopoverOpen] = useState<{ [key: string]: boolean }>({});
  
  // Global search
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);

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
      const snap = await getDocs(
        collection(db, "users", user.uid, "playlists")
      );
      setPlaylists(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Playlist, "id">),
        }))
      );
    };

    load();
  }, [user]);

  /* ---------- CLEANUP ---------- */
  useEffect(() => {
    return () => {
      if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
    };
  }, []);

  const current =
    active &&
    playlists
      .find((p) => p.id === active.pid)
      ?.lectures.find((l) => l.id === active.lid);

  /* ---------- SYNC NOTES & AUTO-SAVE LOGIC ---------- */
  
  // Immediate Save Function
  const saveNotesImmediate = useCallback(async (lectureId: string, playlistId: string, content: string) => {
    if (!content.trim() && !isDirtyRef.current) return;
    
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
    if (!user || !newPlaylist.trim()) return;

    try {
      const ref = await addDoc(
        collection(db, "users", user.uid, "playlists"),
        { title: newPlaylist, lectures: [] }
      );

      setPlaylists((p) => [
        ...p,
        { id: ref.id, title: newPlaylist, lectures: [] },
      ]);

      setNewPlaylist("");
    } catch (error) {
      console.error("Error creating playlist:", error);
    }
  };

  const addLecture = async (p: Playlist) => {
    if (!user) return;

    const vid = extractVideoId(newLectureUrl);
    if (!vid || !newLectureTitle.trim()) return;

    const updated = [
      ...p.lectures,
      {
        id: crypto.randomUUID(),
        title: newLectureTitle,
        videoId: vid,
        completed: false,
        notes: "",
        watchTime: 0,
        createdAt: Date.now(),
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
    } catch (error) {
      console.error("Error adding lecture:", error);
    }
  };

  const toggleComplete = async (p: Playlist, lid: string) => {
    if (!user) return;

    const updated = p.lectures.map((l) =>
      l.id === lid ? { ...l, completed: !l.completed } : l
    );

    try {
      await updateDoc(
        doc(db, "users", user.uid, "playlists", p.id),
        { lectures: updated }
      );

      setPlaylists((ps) =>
        ps.map((x) => (x.id === p.id ? { ...x, lectures: updated } : x))
      );
    } catch (error) {
      console.error("Error toggling completion:", error);
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
    try {
      await deleteDoc(doc(db, "users", user.uid, "playlists", pid));
      setPlaylists((ps) => ps.filter((p) => p.id !== pid));
      // Clear active if deleted playlist was active
      if (active?.pid === pid) {
        setActive(null);
      }
    } catch (error) {
      console.error("Error deleting playlist:", error);
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
      setPlaylists((currentPlaylists) => {
        const p = currentPlaylists.find((p) => p.id === active.pid);
        if (!p) return currentPlaylists;

        const newTimestampNote: TimestampNote = {
          id: crypto.randomUUID(),
          timestamp,
          note: note.trim(),
          createdAt: Date.now(),
        };

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
    } catch (error) {
      console.error("Error adding timestamp note:", error);
    }
  };

  const deleteTimestampNote = async (timestampId: string) => {
    if (!active || !user) return;

    try {
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
                setSessionMinutes((prev) => prev + 25);
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

  // DUPLICATE PLAYLIST
  const duplicatePlaylist = useCallback(async (p: Playlist) => {
    if (!user) return;
    try {
      setLoading(true);
      const newTitle = `${p.title} (Copy)`;
      const ref = await addDoc(
        collection(db, "users", user.uid, "playlists"),
        {
          ...p,
          title: newTitle,
          createdAt: Date.now(),
        }
      );
      setPlaylists((ps) => [...ps, { ...p, id: ref.id, title: newTitle }]);
      toast({ title: "Playlist duplicated", description: `${newTitle} has been created.` });
    } catch (error) {
      console.error("Error duplicating playlist:", error);
      toast({ title: "Error", description: "Failed to duplicate playlist.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  // IMPORT/EXPORT PLAYLISTS
  const exportPlaylists = useCallback(() => {
    try {
      const data = playlists.map((p) => ({
        title: p.title,
        description: p.description,
        lectures: p.lectures.map((l) => ({
          title: l.title,
          videoId: l.videoId,
          notes: l.notes,
          tags: l.tags,
        })),
      }));
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `playlists-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Exported", description: "Playlists exported successfully." });
    } catch (error) {
      console.error("Error exporting playlists:", error);
      toast({ title: "Error", description: "Failed to export playlists.", variant: "destructive" });
    }
  }, [playlists, toast]);

  const importPlaylists = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !event.target.files?.[0]) return;
    try {
      setLoading(true);
      const file = event.target.files[0];
      const text = await file.text();
      const data = JSON.parse(text);

      if (!Array.isArray(data)) {
        throw new Error("Invalid file format");
      }

      for (const playlistData of data) {
        const lectures = (playlistData.lectures || []).map((l: any) => ({
          id: crypto.randomUUID(),
          title: l.title,
          videoId: l.videoId,
          completed: false,
          notes: l.notes || "",
          watchTime: 0,
          createdAt: Date.now(),
          tags: l.tags || [],
          timestampNotes: [],
        }));

        await addDoc(collection(db, "users", user.uid, "playlists"), {
          title: playlistData.title,
          description: playlistData.description || "",
          lectures,
          createdAt: Date.now(),
        });
      }

      const snap = await getDocs(collection(db, "users", user.uid, "playlists"));
      setPlaylists(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Playlist, "id">),
        }))
      );

      toast({ title: "Imported", description: `${data.length} playlist(s) imported successfully.` });
      event.target.value = "";
    } catch (error) {
      console.error("Error importing playlists:", error);
      toast({ title: "Error", description: "Failed to import playlists. Please check the file format.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

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

  // ARCHIVE PLAYLIST
  const archivePlaylist = useCallback(async (pid: string, archive: boolean) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid, "playlists", pid), { archived: archive });
      setPlaylists((ps) => ps.map((p) => (p.id === pid ? { ...p, archived: archive } : p)));
      toast({ title: archive ? "Archived" : "Unarchived", description: `Playlist ${archive ? "archived" : "unarchived"} successfully.` });
    } catch (error) {
      console.error("Error archiving playlist:", error);
      toast({ title: "Error", description: "Failed to archive playlist.", variant: "destructive" });
    }
  }, [user, toast]);

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

  // STATISTICS
  const stats = useMemo(() => {
    const allLectures = playlists.flatMap((p) => p.lectures);
    const totalLectures = allLectures.length;
    const completedLectures = allLectures.filter((l) => l.completed).length;
    const totalWatchTime = allLectures.reduce((sum, l) => sum + (l.watchTime || 0), 0);
    const totalPlaylists = playlists.length;

    // Weekly stats (last 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentLectures = allLectures.filter(
      (l) => (l.createdAt || 0) > sevenDaysAgo
    );
    const weeklyWatchTime = recentLectures.reduce(
      (sum, l) => sum + (l.watchTime || 0),
      0
    );

    // Monthly stats (last 30 days)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const monthlyLectures = allLectures.filter(
      (l) => (l.createdAt || 0) > thirtyDaysAgo
    );
    const monthlyWatchTime = monthlyLectures.reduce(
      (sum, l) => sum + (l.watchTime || 0),
      0
    );

    // Completion rate by playlist
    const playlistCompletion = playlists.map((p) => ({
      title: p.title,
      progress: getPlaylistProgress(p),
    }));

    // Watch time by day (last 7 days)
    const dailyWatchTime = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      date.setHours(0, 0, 0, 0);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      // This is a simplified version - in a real app, you'd track daily watch time
      return {
        date: date.toLocaleDateString("en-US", { weekday: "short" }),
        minutes: Math.floor(Math.random() * 60) + 10, // Placeholder
      };
    });

    return {
      totalLectures,
      completedLectures,
      totalWatchTime,
      totalPlaylists,
      weeklyWatchTime,
      monthlyWatchTime,
      playlistCompletion,
      dailyWatchTime,
      completionRate: totalLectures > 0 ? (completedLectures / totalLectures) * 100 : 0,
    };
  }, [playlists]);

  /* ================= UI ================= */

  const filteredPlaylists = useMemo(() => {
    return playlists.filter((p) => showArchived || !p.archived);
  }, [playlists, showArchived]);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-indigo-900/5 dark:to-indigo-950/10">
        {/* HEADER */}
        <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">

              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowArchived((s) => !s)}
              >
                {showArchived ? "Hide Archived" : "Show Archived"}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/dashboard")}
                className="hover:bg-primary/10 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <PlayCircle className="text-primary h-6 w-6" />
              <span className="text-xl font-bold bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                Playlists
              </span>
            </div>

            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowGlobalSearch(true)}
                      className="hover:bg-primary/10 transition-colors"
                    >
                      <Search className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Global Search (Ctrl+K)</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={exportPlaylists}
                      className="hover:bg-primary/10 transition-colors"
                    >
                      <Download className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Export Playlists</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <label>
                      <input
                        type="file"
                        accept=".json"
                        onChange={importPlaylists}
                        className="hidden"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="hover:bg-primary/10 transition-colors cursor-pointer"
                      >
                        <span><Upload className="h-5 w-5" /></span>
                      </Button>
                    </label>
                  </TooltipTrigger>
                  <TooltipContent>Import Playlists</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Dialog open={showShortcutsHelp} onOpenChange={setShowShortcutsHelp}>
                <DialogTrigger asChild>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="hover:bg-primary/10 transition-colors">
                          <HelpCircle className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Keyboard Shortcuts (?)</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Keyboard Shortcuts</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 py-4">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Next lecture</span>
                      <kbd className="px-2 py-1 bg-muted border rounded text-xs">J</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Previous lecture</span>
                      <kbd className="px-2 py-1 bg-muted border rounded text-xs">K</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Toggle focus mode</span>
                      <kbd className="px-2 py-1 bg-muted border rounded text-xs">Ctrl + F</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Toggle theatre mode</span>
                      <kbd className="px-2 py-1 bg-muted border rounded text-xs">Ctrl + T</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Show shortcuts</span>
                      <kbd className="px-2 py-1 bg-muted border rounded text-xs">?</kbd>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={showStats} onOpenChange={setShowStats}>
                <DialogTrigger asChild>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="hover:bg-primary/10 transition-colors">
                          <BarChart3 className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Statistics</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">Study Statistics</DialogTitle>
                  </DialogHeader>
                  <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="weekly">Weekly</TabsTrigger>
                      <TabsTrigger value="playlists">Playlists</TabsTrigger>
                    </TabsList>
                    <TabsContent value="overview" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                          <CardContent className="p-4">
                            <p className="text-sm text-muted-foreground">Total Lectures</p>
                            <p className="text-2xl font-bold">{stats.totalLectures}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <p className="text-sm text-muted-foreground">Completed</p>
                            <p className="text-2xl font-bold">{stats.completedLectures}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <p className="text-sm text-muted-foreground">Total Watch Time</p>
                            <p className="text-2xl font-bold">{stats.totalWatchTime}m</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <p className="text-sm text-muted-foreground">Completion Rate</p>
                            <p className="text-2xl font-bold">{stats.completionRate.toFixed(0)}%</p>
                          </CardContent>
                        </Card>
                      </div>
                      <Card>
                        <CardHeader>
                          <CardTitle>Daily Watch Time (Last 7 Days)</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[200px] flex items-end justify-between gap-2">
                            {stats.dailyWatchTime.map((day, i) => (
                              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                                <div className="w-full bg-muted rounded-t relative" style={{ height: `${Math.max((day.minutes / 60) * 100, 5)}%` }}>
                                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
                                    {day.minutes}m
                                  </div>
                                </div>
                                <span className="text-xs text-muted-foreground">{day.date}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                    <TabsContent value="weekly" className="space-y-4 mt-4">
                      <Card>
                        <CardContent className="p-6">
                          <div className="space-y-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Weekly Watch Time</p>
                              <p className="text-3xl font-bold">{stats.weeklyWatchTime} minutes</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Monthly Watch Time</p>
                              <p className="text-3xl font-bold">{stats.monthlyWatchTime} minutes</p>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-500 dark:text-orange-400 text-sm font-medium w-fit">
                              <Flame className="h-4 w-4" />
                              <span>{streak}-day streak</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                    <TabsContent value="playlists" className="space-y-4 mt-4">
                      <div className="space-y-3">
                        {stats.playlistCompletion.map((pc, i) => (
                          <Card key={i}>
                            <CardContent className="p-4">
                              <div className="flex justify-between items-center mb-2">
                                <p className="font-medium">{pc.title}</p>
                                <p className="text-sm text-muted-foreground">{pc.progress}%</p>
                              </div>
                              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-primary to-purple-500 transition-all"
                                  style={{ width: `${pc.progress}%` }}
                                />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-500 dark:text-orange-400 text-sm font-medium">
                <Flame className="h-4 w-4" />
                <span>{streak}-day streak</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setFocusMode(!focusMode)}
                className="hover:bg-primary/10 transition-colors"
              >
                <Focus className="h-5 w-5" />
              </Button>
              <ThemeToggle />
              <Button variant="ghost" size="icon" className="hover:bg-primary/10 transition-colors">
                <Settings className="h-5 w-5" />
              </Button>
              <Avatar
                className="h-9 w-9 cursor-pointer ring-2 ring-primary/20 hover:ring-primary/40 transition-all"
                onClick={() => navigate("/profile")}
              >
                <AvatarImage src={user?.photoURL || ""} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-purple-500 text-primary-foreground font-semibold">
                  {user?.email?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        {/* MAIN */}
        <main className="container mx-auto px-4 py-8 max-w-7xl">
          <div className={`grid gap-8 ${focusMode ? "grid-cols-1" : "lg:grid-cols-[380px_minmax(0,1fr)]"}`}>
            {/* SIDEBAR */}
            {!focusMode && (
              <div className={cn("space-y-4 lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pb-4",
                "scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent"
              )}>
                {/* SEARCH & FILTER */}
                <Card className={cn("border-2 shadow-lg backdrop-blur-xl transition-all duration-300",
                  theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
                )}>
                  <CardContent className="p-4 space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search lectures..."
                        className="pl-9"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Select value={filterOption} onValueChange={(v) => setFilterOption(v as FilterOption)}>
                        <SelectTrigger className="flex-1">
                          <Filter className="h-4 w-4 mr-2" />
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
                        <SelectTrigger className="flex-1">
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

                <Card className={cn("border-2 shadow-lg hover:shadow-xl transition-all duration-300 backdrop-blur-xl",
                  theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
                )}>
                  <CardContent className="flex gap-2 p-4">
                    <Input
                      value={newPlaylist}
                      onChange={(e) => setNewPlaylist(e.target.value)}
                      placeholder="Create playlist"
                      className="flex-1"
                      onKeyDown={(e) => e.key === "Enter" && addPlaylist()}
                    />
                    <Button
                      onClick={addPlaylist}
                      className="shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>

                {filteredPlaylists.map((p) => {
                  const filteredLectures = filteredAndSortedLectures(p);
                  return (
                    <Card
                      key={p.id}
                      className={cn("border-2 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden backdrop-blur-xl",
                        theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
                      )}
                    >
                      <CardHeader className="space-y-3 pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-lg font-bold">{p.title}</CardTitle>
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
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => duplicatePlaylist(p)}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Duplicate</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => archivePlaylist(p.id, !p.archived)}
                                  >
                                    <Archive className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{p.archived ? "Unarchive" : "Archive"}</TooltipContent>
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

                      <CardContent className="space-y-3 pt-3">
                        {filteredLectures.length === 0 && p.lectures.length > 0 && (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            No lectures match your filters
                          </div>
                        )}
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                          {filteredLectures.map((l, index) => (
                            <div
                              key={l.id}
                              className={`relative group flex gap-3 p-3 rounded-xl transition-all duration-200 ${active?.lid === l.id
                                ? "bg-gradient-to-r from-primary/10 to-purple-500/10 ring-2 ring-primary/30 shadow-md"
                                : "hover:bg-muted/60 hover:shadow-sm"
                                }`}
                            >
                              {sortOption === "custom" && (
                                <div className="flex flex-col gap-1 justify-center">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveLecture(p, l.id, "up");
                                    }}
                                    disabled={index === 0}
                                  >
                                    <ArrowUp className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveLecture(p, l.id, "down");
                                    }}
                                    disabled={index === filteredLectures.length - 1}
                                  >
                                    <ArrowDown className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                              <div
                                onClick={() => setActive({ pid: p.id, lid: l.id })}
                                className="flex-1 flex gap-3 cursor-pointer"
                              >
                                <div className="relative w-28 aspect-video bg-black rounded-lg overflow-hidden shrink-0 shadow-md group-hover:shadow-lg transition-shadow">
                                  <img
                                    src={`https://img.youtube.com/vi/${l.videoId}/mqdefault.jpg`}
                                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                    alt={l.title}
                                  />
                                  {/* HOVER ACTIONS */}
                                  <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1.5">
                                    <Button
                                      size="icon"
                                      variant="secondary"
                                      className="h-7 w-7 bg-background/90 backdrop-blur-sm hover:bg-background shadow-lg"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleComplete(p, l.id);
                                      }}
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                    </Button>

                                    <Button
                                      size="icon"
                                      variant="secondary"
                                      className="h-7 w-7 bg-background/90 backdrop-blur-sm hover:bg-background shadow-lg"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setFocusMode(true);
                                        setActive({ pid: p.id, lid: l.id });
                                      }}
                                    >
                                      <Focus className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>

                                  {l.completed && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg backdrop-blur-[1px]">
                                      <div className="bg-primary rounded-full p-1.5">
                                        <Check className="text-primary-foreground h-5 w-5" />
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium line-clamp-2 leading-snug">{l.title}</p>
                                  {l.watchTime && (
                                    <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                                      <span>⏱️</span>
                                      <span>Watched: {l.watchTime} min</span>
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-2 pt-2 border-t">
                          <Input
                            placeholder="Lecture title"
                            value={newLectureTitle}
                            onChange={(e) => setNewLectureTitle(e.target.value)}
                            className="text-sm"
                          />
                          <Input
                            placeholder="YouTube link"
                            value={newLectureUrl}
                            onChange={(e) => setNewLectureUrl(e.target.value)}
                            className="text-sm"
                          />
                          <Button
                            onClick={() => addLecture(p)}
                            className="w-full"
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

            {/* PLAYER + NOTES */}
            <div className={cn(`${theatre ? "fixed inset-0 z-[100] bg-black p-4 md:p-8" : "sticky top-24"}`)}>
              <Card className={cn(`shadow-2xl border-2 backdrop-blur-xl transition-all duration-300`,
                theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border",
                theatre ? "h-full flex flex-col" : ""
              )}>
                {current ? (
                  <>
                    <div className={cn(`aspect-video bg-black ${theatre ? "flex-1 min-h-0" : ""} rounded-t-lg overflow-hidden relative`)}>
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
                        <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm border-2 rounded-lg p-3 shadow-lg">
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

                    <CardContent className="space-y-5 p-6">
                      <div className="flex justify-between items-start gap-4">
                        <h2 className="text-xl font-bold leading-tight flex-1">{current.title}</h2>
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
                        <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20">
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
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <h3 className="text-base font-bold flex items-center gap-2">
                            <span className="text-xl">📝</span>
                            Study Notes
                          </h3>
                          <div className="flex items-center gap-3">
                            <div className="text-xs font-medium text-muted-foreground">
                              {saveStatus === "typing" && "✍️ Typing…"}
                              {saveStatus === "saving" && "💾 Saving…"}
                              {saveStatus === "saved" && "✅ Saved"}
                              {saveStatus === "idle" && ""}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!localNotes.trim()}
                              onClick={exportNotesPdf}
                              className="gap-2"
                            >
                              <span>📄</span>
                              Export PDF
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {notesWordCount.words > 0 && (
                              <span>{notesWordCount.words} words • {notesWordCount.characters} chars</span>
                            )}
                          </div>
                        </div>

                        {/* NOTES TEMPLATES */}
                        <div className="flex gap-2 flex-wrap">
                          {noteTemplates.map((template) => (
                            <Button
                              key={template.name}
                              size="sm"
                              variant="outline"
                              onClick={() => insertTemplate(template)}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              {template.name}
                            </Button>
                          ))}
                        </div>

                        {/* TAG BUTTONS */}
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant={activeTags.includes("important") ? "default" : "outline"}
                            onClick={() => toggleTag("important")}
                            className={`transition-all ${activeTags.includes("important") ? "shadow-md" : ""}`}
                          >
                            ⭐ Important
                          </Button>

                          <Button
                            size="sm"
                            variant={activeTags.includes("formula") ? "default" : "outline"}
                            onClick={() => toggleTag("formula")}
                            className={`transition-all ${activeTags.includes("formula") ? "shadow-md" : ""}`}
                          >
                            ➕ Formula
                          </Button>

                          <Button
                            size="sm"
                            variant={activeTags.includes("doubt") ? "default" : "outline"}
                            onClick={() => toggleTag("doubt")}
                            className={`transition-all ${activeTags.includes("doubt") ? "shadow-md" : ""}`}
                          >
                            ❓ Doubt
                          </Button>
                        </div>

                        {showMathPad && (
                          <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-muted/50 border">
                            <Button size="sm" variant="outline" onClick={() => insertAtCursor("$F = ma$")}>
                              F = ma
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => insertAtCursor("$\\frac{a}{b}$")}>
                              a / b
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => insertAtCursor("$\\sqrt{x}$")}>
                              √x
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => insertAtCursor("$x^2$")}>
                              x²
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => insertAtCursor("$\\pi$")}>
                              π
                            </Button>
                          </div>
                        )}

                        {/* TIMESTAMP NOTES */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                              <Bookmark className="h-4 w-4" />
                              Timestamp Bookmarks
                            </h4>
                            <Dialog open={showTimestampDialog} onOpenChange={setShowTimestampDialog}>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline">
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Bookmark
                                </Button>
                              </DialogTrigger>
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
                                        if (parts.length === 2) {
                                          seconds = parts[0] * 60 + parts[1];
                                        }
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
                          </div>
                          {current && (current.timestampNotes || []).length > 0 && (
                            <div className="space-y-2 p-3 rounded-lg bg-muted/30 border max-h-48 overflow-y-auto">
                              {current.timestampNotes?.map((tn) => (
                                <div
                                  key={tn.id}
                                  className="flex items-start justify-between gap-2 p-2 rounded bg-background border hover:bg-muted/50 transition-colors"
                                >
                                  <div className="flex-1 min-w-0">
                                    <button
                                      onClick={() => jumpToTimestamp(tn.timestamp)}
                                      className="text-sm font-medium text-primary hover:underline mb-1 block"
                                    >
                                      {formatTimestamp(tn.timestamp)}
                                    </button>
                                    <p className="text-xs text-muted-foreground line-clamp-2">{tn.note}</p>
                                  </div>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 shrink-0"
                                    onClick={() => deleteTimestampNote(tn.id)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* NOTES INPUT WITH SYMBOL KEYBOARD */}
                        <div className="relative">
                          <Textarea
                            id="notes-area"
                            value={localNotes}
                            onChange={(e) => updateNotesDebounced(e.target.value)}
                            className="min-h-[280px] pr-12 text-sm leading-relaxed resize-none font-mono"
                            placeholder={`Write notes normally.

Examples:
force = mass × acceleration
angle = 90°
area = πr²`}
                          />

                          {/* Keyboard icon (bottom-right) */}
                          <button
                            ref={symbolButtonRef}
                            type="button"
                            onClick={() => setShowSymbolPad(true)}
                            className="absolute bottom-4 right-4 p-2 rounded-lg bg-background border shadow-md hover:bg-muted hover:scale-110 transition-all text-muted-foreground hover:text-primary"
                            title="Symbol keyboard"
                          >
                            <span className="text-xl">⌨️</span>
                          </button>
                        </div>

                        {/* SYMBOL PICKER */}
                        {showSymbolPad && (
                          <div
                            ref={symbolPopupRef}
                            className="absolute bottom-20 right-0 z-50 w-[340px] max-h-[320px] overflow-y-auto rounded-xl border-2 bg-background shadow-2xl p-4 animate-in fade-in slide-in-from-bottom-2"
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

                        {aiError && (
                          <div className="p-4 rounded-xl border-2 border-red-500/50 bg-red-500/10">
                            <p className="text-sm font-medium text-red-600 dark:text-red-400">{aiError}</p>
                          </div>
                        )}

                        {aiSummary && (
                          <div className="p-4 rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-purple-500/5 whitespace-pre-line text-sm leading-relaxed">
                            {aiSummary}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-3 pt-2 border-t">
                        <Button
                          onClick={() =>
                            toggleComplete(
                              playlists.find((p) => p.id === active!.pid)!,
                              active!.lid
                            )
                          }
                          className="w-full"
                          variant={current.completed ? "outline" : "default"}
                        >
                          {current.completed ? "✓ Mark as unwatched" : "✓ Mark as watched"}
                        </Button>

                        {nextLecture && (
                          <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20">
                            <Sparkles className="h-5 w-5 text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                                Next up
                              </p>
                              <p className="text-sm font-medium text-foreground truncate">
                                {nextLecture.title}
                              </p>
                            </div>
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