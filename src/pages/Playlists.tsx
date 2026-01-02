// src/pages/Playlists.tsx
// Fully working YouTube-style playlist page with thumbnails + inline iframe player

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  ArrowLeft,
  Plus,
  Trash2,
  Bell,
  Settings,
  PlayCircle,
  Check,
} from "lucide-react";

// ---------- TYPES ----------
type Lecture = {
  id: string;
  title: string;
  videoId: string;
  completed: boolean;
};

type Playlist = {
  id: string;
  title: string;
  lectures: Lecture[];
};

// ---------- HELPERS ----------
function extractVideoId(url: string): string | null {
  try {
    if (url.includes("youtu.be/")) return url.split("youtu.be/")[1].split("?")[0];
    if (url.includes("watch?v=")) return new URL(url).searchParams.get("v");
    if (url.includes("embed/")) return url.split("embed/")[1].split("?")[0];
  } catch {}
  return null;
}

export default function Playlists() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [active, setActive] = useState<{ pid: string; lid: string } | null>(null);

  const [newPlaylist, setNewPlaylist] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newLectureTitle, setNewLectureTitle] = useState("");
  const [newLectureUrl, setNewLectureUrl] = useState("");

  // ---------- LOAD PLAYLISTS ----------
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const snap = await getDocs(collection(db, "users", user.uid, "playlists"));
      setPlaylists(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Playlist, "id">) })));
    };

    load();
  }, [user]);

  // ---------- LOGIC ----------
  const progress = (p: Playlist) =>
    p.lectures.length === 0
      ? 0
      : Math.round((p.lectures.filter(l => l.completed).length / p.lectures.length) * 100);

  const addPlaylist = async () => {
    if (!user || !newPlaylist.trim()) return;
    const ref = await addDoc(collection(db, "users", user.uid, "playlists"), {
      title: newPlaylist,
      lectures: [],
    });
    setPlaylists(p => [...p, { id: ref.id, title: newPlaylist, lectures: [] }]);
    setNewPlaylist("");
  };

  const addLecture = async (p: Playlist) => {
    if (!user) return;
    const vid = extractVideoId(newLectureUrl);
    if (!vid || !newLectureTitle.trim()) return;

    const updated = [...p.lectures, {
      id: crypto.randomUUID(),
      title: newLectureTitle,
      videoId: vid,
      completed: false,
    }];

    await updateDoc(doc(db, "users", user.uid, "playlists", p.id), { lectures: updated });
    setPlaylists(ps => ps.map(x => x.id === p.id ? { ...x, lectures: updated } : x));

    setNewLectureTitle("");
    setNewLectureUrl("");
  };

  const toggleComplete = async (p: Playlist, lid: string) => {
    if (!user) return;
    const updated = p.lectures.map(l =>
      l.id === lid ? { ...l, completed: !l.completed } : l
    );
    await updateDoc(doc(db, "users", user.uid, "playlists", p.id), { lectures: updated });
    setPlaylists(ps => ps.map(x => x.id === p.id ? { ...x, lectures: updated } : x));
  };

  const removeLecture = async (p: Playlist, lid: string) => {
    if (!user) return;
    const updated = p.lectures.filter(l => l.id !== lid);
    await updateDoc(doc(db, "users", user.uid, "playlists", p.id), { lectures: updated });
    setPlaylists(ps => ps.map(x => x.id === p.id ? { ...x, lectures: updated } : x));
  };

  const deletePlaylist = async (pid: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "playlists", pid));
    setPlaylists(ps => ps.filter(p => p.id !== pid));
    if (active?.pid === pid) setActive(null);
  };

  const current = active
    ? playlists.find(p => p.id === active.pid)?.lectures.find(l => l.id === active.lid)
    : null;

  // ================= UI =================
  return (
    <div className="min-h-screen bg-background">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <PlayCircle className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Playlists</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white">3</span>
            </Button>
            <ThemeToggle />
            <Button variant="ghost" size="icon"><Settings className="h-5 w-5" /></Button>
            <Avatar className="h-9 w-9">
              <AvatarImage src={user?.photoURL || ""} />
              <AvatarFallback>{user?.email?.[0]?.toUpperCase() || "U"}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-7xl grid lg:grid-cols-[3fr_2fr] gap-6">
        {/* PLAYER */}
        <Card>
          <CardContent className="p-0">
            {current ? (
              <div className="aspect-video">
                <iframe
                  src={`https://www.youtube.com/embed/${current.videoId}`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="aspect-video flex items-center justify-center text-muted-foreground">
                Select a lecture
              </div>
            )}
          </CardContent>
        </Card>

        {/* SIDEBAR */}
        <div className="space-y-4">
          <Card className="border-dashed border-2">
            <CardContent className="flex gap-2 p-3">
              <Input placeholder="Create playlist" value={newPlaylist} onChange={e => setNewPlaylist(e.target.value)} />
              <Button onClick={addPlaylist}><Plus className="h-4 w-4" /></Button>
            </CardContent>
          </Card>

          {playlists.map(p => (
            <Card key={p.id}>
              <CardHeader className="pb-2 space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{p.title}</CardTitle>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deletePlaylist(p.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                    Add video
                  </Button>
                </div>
                <Progress value={progress(p)} />
                {expanded === p.id && (
                  <div className="flex gap-2">
                    <Input placeholder="Lecture title" value={newLectureTitle} onChange={e => setNewLectureTitle(e.target.value)} />
                    <Input placeholder="YouTube link" value={newLectureUrl} onChange={e => setNewLectureUrl(e.target.value)} />
                    <Button onClick={() => addLecture(p)}><Plus className="h-4 w-4" /></Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                {p.lectures.map(l => (
                  <div
                    key={l.id}
                    onClick={() => setActive({ pid: p.id, lid: l.id })}
                    className={`flex gap-3 p-2 rounded-md cursor-pointer hover:bg-muted ${active?.lid === l.id ? "bg-muted" : ""}`}
                  >
                    <div className="relative w-28 aspect-video bg-black rounded overflow-hidden">
                      <img src={`https://img.youtube.com/vi/${l.videoId}/mqdefault.jpg`} className="w-full h-full object-cover" />
                      {l.completed && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Check className="text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium line-clamp-2">{l.title}</p>
                      {<Button
                        size="sm"
                        variant="link"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleComplete(p, l.id);
                        }}
                      >
                        {l.completed ? "Unmark" : "Mark watched"}
                      </Button>}
                    </div>
                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); removeLecture(p, l.id); }}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
