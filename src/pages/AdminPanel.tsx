import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Lecture = {
  id: string;
  title: string;
  videoId: string;
};

type Playlist = {
  id: string;
  title: string;
  lectures: Lecture[];
};

export default function AdminPanel() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [newPlaylist, setNewPlaylist] = useState("");
  const [lectureTitle, setLectureTitle] = useState("");
  const [lectureVideo, setLectureVideo] = useState("");
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const snap = await getDocs(collection(db, "playlists_global"));
    setPlaylists(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
    );
  };

  const createPlaylist = async () => {
    if (!newPlaylist.trim()) return;
    await addDoc(collection(db, "playlists_global"), {
      title: newPlaylist,
      createdBy: "admin",
      lectures: [],
    });
    setNewPlaylist("");
    load();
  };

  const deletePlaylist = async (id: string) => {
    await deleteDoc(doc(db, "playlists_global", id));
    load();
  };

  const addLecture = async (p: Playlist) => {
    if (!lectureTitle || !lectureVideo) return;

    const updated = [
      ...p.lectures,
      {
        id: crypto.randomUUID(),
        title: lectureTitle,
        videoId: lectureVideo,
      },
    ];

    await updateDoc(doc(db, "playlists_global", p.id), {
      lectures: updated,
    });

    setLectureTitle("");
    setLectureVideo("");
    load();
  };

  const removeLecture = async (p: Playlist, lid: string) => {
    const updated = p.lectures.filter((l) => l.id !== lid);
    await updateDoc(doc(db, "playlists_global", p.id), {
      lectures: updated,
    });
    load();
  };

  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-3xl font-bold">Admin Panel – Suggested Playlists</h1>

      {/* CREATE PLAYLIST */}
      <Card>
        <CardContent className="flex gap-2 p-4">
          <Input
            placeholder="New playlist title"
            value={newPlaylist}
            onChange={(e) => setNewPlaylist(e.target.value)}
          />
          <Button onClick={createPlaylist}>Create</Button>
        </CardContent>
      </Card>

      {/* PLAYLISTS */}
      {playlists.map((p) => (
        <Card key={p.id}>
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle>{p.title}</CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActive(active === p.id ? null : p.id)}
              >
                Add Lecture
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => deletePlaylist(p.id)}
              >
                Delete
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {p.lectures.map((l) => (
              <div
                key={l.id}
                className="flex justify-between items-center border p-2 rounded"
              >
                <span>{l.title}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeLecture(p, l.id)}
                >
                  ❌
                </Button>
              </div>
            ))}

            {active === p.id && (
              <div className="flex gap-2 pt-2">
                <Input
                  placeholder="Lecture title"
                  value={lectureTitle}
                  onChange={(e) => setLectureTitle(e.target.value)}
                />
                <Input
                  placeholder="YouTube video ID"
                  value={lectureVideo}
                  onChange={(e) => setLectureVideo(e.target.value)}
                />
                <Button onClick={() => addLecture(p)}>Add</Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
