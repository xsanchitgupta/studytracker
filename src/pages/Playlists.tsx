import { MathJax, MathJaxContext } from "better-react-mathjax";
import jsPDF from "jspdf";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
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

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  ArrowLeft,
  Plus,
  Trash2,
  Bell,
  Settings,
  PlayCircle,
  Check,
  Maximize,
  Minimize,
  Focus,
  Flame,
  Sparkles,
} from "lucide-react";

/* ================= TYPES ================= */

type NoteTag = "important" | "formula" | "doubt";

type Lecture = {
  id: string;
  title: string;
  videoId: string;
  completed: boolean;
  notes?: string;
  watchTime?: number;

  /* ===== PATCH 7 ===== */
  tags?: NoteTag[];
  aiSummary?: string;
};

type Playlist = {
  id: string;
  title: string;
  lectures: Lecture[];
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
/* ===== PATCH 9: NOTES SANITIZER ===== */
function sanitizeNotes(input: string): string {
  return input
    // remove zero-width & invisible chars
    .replace(/[\u200B-\u200D\uFEFF]/g, "")

    // normalize weird quotes
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")

    // remove control characters except newline & tab
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")

    // limit repeated symbols
    .replace(/([*_=~`]){4,}/g, "$1$1$1")

    // trim trailing spaces per line
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n");
}

/* ===== PATCH: MATHJAX CONFIG ===== */
const mathJaxConfig = {
  loader: { load: ["input/tex", "output/chtml"] },
  tex: {
    inlineMath: [["$", "$"]],
    displayMath: [["$$", "$$"]],
  },
};

/* ================= PAGE ================= */
export default function Playlists() {
  const { user } = useAuth();
  const navigate = useNavigate();
  /* ===== PATCH: TAG + PDF + AI STATES ===== */
  const [activeTags, setActiveTags] = useState<NoteTag[]>([]);
  const [showMathPad, setShowMathPad] = useState(false);

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
  /* ===== PATCH 10: AUTOSAVE STATUS ===== */
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "typing" | "saving" | "saved"
  >("idle");

  const isDirtyRef = useRef(false);

  const [localNotes, setLocalNotes] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  /* ---------- LOAD PLAYLISTS ---------- */
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

  /* ---------- SYNC NOTES ON LECTURE CHANGE ---------- */
  useEffect(() => {
    if (!current) return;
    setLocalNotes(current.notes || "");
    setAiSummary(current.aiSummary || "");
    setActiveTags(current.tags || []);
  }, [active]);


  /* ---------- WATCH TIME (SAFE) ---------- */
  const stopWatchTimer = async () => {
    if (!active || !watchStartRef.current) return;

    const seconds = Math.floor(
      (Date.now() - watchStartRef.current) / 1000
    );
    watchStartRef.current = null;

    if (seconds < 30) return;

    const minutes = Math.round(seconds / 60);
    const p = playlists.find((p) => p.id === active.pid);
    if (!p) return;

    const updated = p.lectures.map((l) =>
      l.id === active.lid
        ? { ...l, watchTime: (l.watchTime || 0) + minutes }
        : l
    );

    await updateDoc(
      doc(db, "users", user!.uid, "playlists", p.id),
      { lectures: updated }
    );

    setPlaylists((ps) =>
      ps.map((x) => (x.id === p.id ? { ...x, lectures: updated } : x))
    );
  };

  useEffect(() => {
    return () => {
      stopWatchTimer();
    };
  }, [active]);

  /* ---------- KEYBOARD SHORTCUTS ---------- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "j") goNext();
      if (e.key === "k" && !e.ctrlKey) goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  /* ---------- LOGIC ---------- */

  const addPlaylist = async () => {
    if (!user || !newPlaylist.trim()) return;

    const ref = await addDoc(
      collection(db, "users", user.uid, "playlists"),
      { title: newPlaylist, lectures: [] }
    );

    setPlaylists((p) => [
      ...p,
      { id: ref.id, title: newPlaylist, lectures: [] },
    ]);

    setNewPlaylist("");
  };

  const addLecture = async (p: Playlist) => {
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
      },
    ];

    await updateDoc(
      doc(db, "users", user!.uid, "playlists", p.id),
      { lectures: updated }
    );

    setPlaylists((ps) =>
      ps.map((x) => (x.id === p.id ? { ...x, lectures: updated } : x))
    );

    setNewLectureTitle("");
    setNewLectureUrl("");
  };

  const toggleComplete = async (p: Playlist, lid: string) => {
    const updated = p.lectures.map((l) =>
      l.id === lid ? { ...l, completed: !l.completed } : l
    );

    await updateDoc(
      doc(db, "users", user!.uid, "playlists", p.id),
      { lectures: updated }
    );

    setPlaylists((ps) =>
      ps.map((x) => (x.id === p.id ? { ...x, lectures: updated } : x))
    );
  };

  const updateNotesDebounced = (text: string) => {
    setLocalNotes(text);

    if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);

    notesSaveTimer.current = setTimeout(async () => {
      if (!active) return;

      const p = playlists.find((p) => p.id === active.pid);
      if (!p) return;

      const updated = p.lectures.map((l) =>
        l.id === active.lid
          ? { ...l, notes: sanitizeNotes(text) }
          : l
      );

      await updateDoc(
        doc(db, "users", user!.uid, "playlists", p.id),
        { lectures: updated }
      );

      setPlaylists((ps) =>
        ps.map((x) => (x.id === p.id ? { ...x, lectures: updated } : x))
      );
    }, 600);
  };


  const autoMathify = (text: string) => {
    if (!text) return text;

    let t = text;

    // Normalize spacing
    t = t.replace(/\s*=\s*/g, " = ");

    // Detect equations (a = b, v = u + at, etc.)
    t = t.replace(
      /\b([a-zA-Z][a-zA-Z0-9]*)\s*=\s*([^\n]+)/g,
      (_, lhs, rhs) => `$${lhs} = ${rhs}$`
    );

    // Fractions: 1/2 → \frac{1}{2}
    t = t.replace(/\b(\d+)\s*\/\s*(\d+)\b/g, "\\\\frac{$1}{$2}");

    // Variables / powers: x^2
    t = t.replace(/\b([a-zA-Z])\s*\^\s*(\d+)\b/g, "$1^{$2}");

    // sqrt(x)
    t = t.replace(/\bsqrt\((.*?)\)/gi, "\\\\sqrt{$1}");

    // constants
    t = t.replace(/\bpi\b/gi, "\\pi");

    return t;
  };


  const normalizeFormulas = (text: string) => {
    return text
      .replace(/\bforce formula\b/gi, "$F = ma$")
      .replace(/\ba\/b\b/gi, "$\\frac{a}{b}$")
      .replace(/\bsqrt\((.*?)\)/gi, "$\\\\sqrt{$1}$")
      .replace(/\bpi\b/gi, "$\\pi$");
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
  /* ===== PATCH 7: TAG TOGGLE (SAFE) ===== */
  const toggleTag = async (tag: NoteTag) => {
    if (!active || !user) return;

    const p = playlists.find((p) => p.id === active.pid);
    if (!p) return;

    const updatedLectures = p.lectures.map((l) => {
      if (l.id !== active.lid) return l;

      const tags = l.tags ?? [];
      const newTags = tags.includes(tag)
        ? tags.filter((t) => t !== tag)
        : [...tags, tag];

      return { ...l, tags: newTags };
    });

    await updateDoc(
      doc(db, "users", user.uid, "playlists", p.id),
      { lectures: updatedLectures }
    );

    setPlaylists((ps) =>
      ps.map((x) => (x.id === p.id ? { ...x, lectures: updatedLectures } : x))
    );

    setActiveTags(
      updatedLectures.find((l) => l.id === active.lid)?.tags || []
    );
  };


  /* ===== PATCH 8: AI SUMMARY V2 (TAG AWARE) ===== */
  const generateAiSummary = async () => {
    if (!active || !user || !localNotes.trim()) return;

    setAiLoading(true);

    // simulate AI delay (future: OpenAI / Gemini)
    await new Promise((r) => setTimeout(r, 1200));

    const lines = localNotes
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const important: string[] = [];
    const formulas: string[] = [];
    const doubts: string[] = [];
    const general: string[] = [];

    for (const line of lines) {
      if (activeTags.includes("formula") && line.includes("$")) {
        formulas.push(line);
      } else if (activeTags.includes("doubt") && line.endsWith("?")) {
        doubts.push(line);
      } else if (activeTags.includes("important")) {
        important.push(line);
      } else {
        general.push(line);
      }
    }

    const summaryBlocks: string[] = [];

    if (important.length)
      summaryBlocks.push("⭐ Important\n" + important.slice(0, 4).map(l => `• ${l}`).join("\n"));

    if (formulas.length)
      summaryBlocks.push("➕ Formulas\n" + formulas.slice(0, 3).map(l => `• ${l}`).join("\n"));

    if (doubts.length)
      summaryBlocks.push("❓ Doubts\n" + doubts.slice(0, 3).map(l => `• ${l}`).join("\n"));

    if (!summaryBlocks.length)
      summaryBlocks.push("📌 Summary\n" + general.slice(0, 5).map(l => `• ${l}`).join("\n"));

    const finalSummary = summaryBlocks.join("\n\n");

    // 🔒 SAVE TO FIRESTORE
    const p = playlists.find((p) => p.id === active.pid);
    if (!p) return;

    const updatedLectures = p.lectures.map((l) =>
      l.id === active.lid ? { ...l, aiSummary: finalSummary } : l
    );

    await updateDoc(
      doc(db, "users", user.uid, "playlists", p.id),
      { lectures: updatedLectures }
    );

    setPlaylists((ps) =>
      ps.map((x) => (x.id === p.id ? { ...x, lectures: updatedLectures } : x))
    );

    setAiSummary(finalSummary);
    setAiLoading(false);
  };


  /* ===== PATCH: EXPORT NOTES TO PDF ===== */
  const exportNotesPdf = () => {
    if (!current) return;

    const pdf = new jsPDF();
    pdf.setFontSize(14);
    pdf.text(current.title, 10, 15);

    pdf.setFontSize(10);
    const text = pdf.splitTextToSize(localNotes || "No notes", 180);
    pdf.text(text, 10, 30);

    pdf.save(`${current.title}-notes.pdf`);
  };

  const deletePlaylist = async (pid: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "playlists", pid));
    setPlaylists((ps) => ps.filter((p) => p.id !== pid));
  };

  /* ---------- NAV HELPERS ---------- */

  const flatLectures = playlists.flatMap((p) =>
    p.lectures.map((l) => ({ ...l, pid: p.id }))
  );

  const goNext = () => {
    if (!active) return;
    watchStartRef.current = null;

    const idx = flatLectures.findIndex(
      (l) => l.id === active.lid && l.pid === active.pid
    );

    if (idx >= 0 && idx < flatLectures.length - 1) {
      setActive({
        pid: flatLectures[idx + 1].pid,
        lid: flatLectures[idx + 1].id,
      });
    }
  };

  const goPrev = () => {
    if (!active) return;
    watchStartRef.current = null;

    const idx = flatLectures.findIndex(
      (l) => l.id === active.lid && l.pid === active.pid
    );

    if (idx > 0) {
      setActive({
        pid: flatLectures[idx - 1].pid,
        lid: flatLectures[idx - 1].id,
      });
    }
  };

  const nextLecture = flatLectures.find((l) => !l.completed);

  const current =
    active &&
    playlists
      .find((p) => p.id === active.pid)
      ?.lectures.find((l) => l.id === active.lid);

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-indigo-900/5">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft />
            </Button>
            <PlayCircle className="text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              Playlists
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-orange-400 text-sm">
              <Flame /> {streak}-day streak
            </div>
            <Button variant="ghost" size="icon" onClick={() => setFocusMode(!focusMode)}>
              <Focus />
            </Button>
            <ThemeToggle />
            <Button variant="ghost" size="icon">
              <Settings />
            </Button>
            <Avatar className="h-9 w-9 cursor-pointer" onClick={() => navigate("/profile")}>
              <AvatarImage src={user?.photoURL || ""} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {user?.email?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className={`grid gap-10 ${focusMode ? "grid-cols-1" : "lg:grid-cols-[360px_minmax(0,1fr)]"}`}>
          {/* SIDEBAR */}
          {!focusMode && (
            <div className="space-y-4">
              <Card>
                <CardContent className="flex gap-2 p-3">
                  <Input
                    value={newPlaylist}
                    onChange={(e) =>
                      updateNotesDebounced(sanitizeNotes(e.target.value))
                    }

                    placeholder="Create playlist"
                  />
                  <Button onClick={addPlaylist}><Plus /></Button>
                </CardContent>
              </Card>

              {playlists.map((p) => (
                <Card key={p.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{p.title}</CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-2">
                    {p.lectures.map((l) => (
                      <div
                        key={l.id}
                        onClick={() => setActive({ pid: p.id, lid: l.id })}
                        className={`group flex gap-3 p-3 rounded-xl cursor-pointer transition-all ${active?.lid === l.id
                          ? "bg-muted ring-1 ring-primary/30"
                          : "hover:bg-muted/50"
                          }`}
                      >
                        <div className="relative w-28 aspect-video bg-black rounded overflow-hidden">
                          <img
                            src={`https://img.youtube.com/vi/${l.videoId}/mqdefault.jpg`}
                            className="w-full h-full object-cover"
                          />
                          {l.completed && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <Check className="text-white" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1">
                          <p className="text-sm font-medium line-clamp-2">{l.title}</p>
                          {l.watchTime && (
                            <p className="text-xs text-muted-foreground">
                              Watched: {l.watchTime} min
                            </p>
                          )}
                        </div>
                      </div>
                    ))}

                    <Input
                      placeholder="Lecture title"
                      value={newLectureTitle}
                      onChange={(e) => setNewLectureTitle(e.target.value)}
                    />
                    <Input
                      placeholder="YouTube link"
                      value={newLectureUrl}
                      onChange={(e) => setNewLectureUrl(e.target.value)}
                    />
                    <Button onClick={() => addLecture(p)}>Add lecture</Button>

                    <Button size="sm" variant="destructive" onClick={() => deletePlaylist(p.id)}>
                      Delete playlist
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* PLAYER + NOTES */}
          <div className={`sticky top-24 ${theatre ? "fixed inset-0 z-50 bg-black p-8" : ""}`}>
            <Card className="shadow-2xl">
              {current ? (
                <>
                  <div className="aspect-video bg-black">
                    <iframe
                      src={`https://www.youtube.com/embed/${current.videoId}`}
                      className="w-full h-full"
                      allowFullScreen
                      onLoad={() => (watchStartRef.current = Date.now())}
                    />
                  </div>

                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h2 className="font-semibold">{current.title}</h2>
                      <Button onClick={() => setTheatre(!theatre)}>
                        {theatre ? <Minimize /> : <Maximize />}
                      </Button>
                    </div>

                    {showFocusTip && (
                      <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                        💡 Press <b>J / K</b> to navigate
                        <Button variant="link" size="sm" onClick={() => setShowFocusTip(false)}>
                          Got it
                        </Button>
                      </div>
                    )}

                    {/* NOTES */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">📝 Study Notes</h3>
                        {/* ===== PATCH 10: SAVE STATUS UI ===== */}
                        <div className="text-xs text-muted-foreground">
                          {saveStatus === "typing" && "✍️ Typing…"}
                          {saveStatus === "saving" && "💾 Saving…"}
                          {saveStatus === "saved" && "✅ All changes saved"}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={exportNotesPdf}
                          >
                            📄 Export PDF
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setPreviewMode(!previewMode)}>
                            {previewMode ? "Edit" : "Preview"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={generateAiSummary} disabled={aiLoading}>
                            {aiLoading ? "Summarizing…" : "✨ AI Summary"}
                          </Button>
                        </div>
                      </div>

                      {/* ===== PATCH 9: TAG BUTTONS ===== */}
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant={activeTags.includes("important") ? "default" : "outline"}
                          onClick={() => toggleTag("important")}
                        >
                          ⭐ Important
                        </Button>

                        <Button
                          size="sm"
                          variant={activeTags.includes("formula") ? "default" : "outline"}
                          onClick={() => toggleTag("formula")}
                        >
                          ➕ Formula
                        </Button>

                        <Button
                          size="sm"
                          variant={activeTags.includes("doubt") ? "default" : "outline"}
                          onClick={() => toggleTag("doubt")}
                        >
                          ❓ Doubt
                        </Button>
                      </div>

                      {/* ===== PATCH-11: MATH KEYBOARD ===== */}
                      <div className="mt-2 flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowMathPad(!showMathPad)}
                        >
                          ➕ Insert Formula
                        </Button>
                      </div>

                      {showMathPad && (
                        < div className="flex flex-wrap gap-2">
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


                      {!previewMode ? (
                        <Textarea
                          id="notes-area"
                          value={localNotes}
                          onChange={(e) => updateNotesDebounced(e.target.value)}
                          className="min-h-[200px]"
                          placeholder={`Markdown supported

• Concept:
• Formula: $F=ma$
• Example:
• Doubt:`}
                        />
                      ) : (
                        <div className="prose prose-invert max-w-none rounded-xl border p-4">
                          <MathJaxContext config={mathJaxConfig}>
                            <MathJax dynamic>
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {autoMathify(localNotes)}
                              </ReactMarkdown>
                            </MathJax>
                          </MathJaxContext>

                        </div>

                      )}

                      {aiSummary && (
                        <div className="rounded-xl border p-3 whitespace-pre-line text-sm bg-muted/40">
                          {aiSummary}
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={() =>
                        toggleComplete(
                          playlists.find((p) => p.id === active!.pid)!,
                          active!.lid
                        )
                      }
                    >
                      {current.completed ? "Unmark watched" : "Mark watched"}
                    </Button>

                    {nextLecture && (
                      <div className="flex items-center gap-2 text-sm text-primary">
                        <Sparkles />
                        Next best lecture: {nextLecture.title}
                      </div>
                    )}
                  </CardContent>
                </>
              ) : (
                <div className="aspect-video flex items-center justify-center text-muted-foreground">
                  Select a lecture
                </div>
              )}
            </Card>
          </div>
        </div>
      </main >
    </div >
  );
}
