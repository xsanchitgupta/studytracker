import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { ArrowLeft, LogOut, Save, GraduationCap, School, Camera } from "lucide-react";

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [college, setCollege] = useState("");
  const [semester, setSemester] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // -------- LOAD PROFILE --------
  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setCollege(data.college || "");
        setSemester(data.semester || "");
      }
      setLoading(false);
    };

    loadProfile();
  }, [user]);

  // -------- SAVE PROFILE --------
  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);

    await setDoc(
      doc(db, "users", user.uid),
      {
        college,
        semester,
        email: user.email,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="text-xl font-bold">Profile</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Avatar className="h-9 w-9">
              <AvatarImage src={user?.photoURL || ""} />
              <AvatarFallback>{user?.email?.[0]?.toUpperCase() || "U"}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="container mx-auto px-4 py-10 max-w-xl">
        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <div className="relative w-fit mx-auto mb-3">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user?.photoURL || ""} />
                <AvatarFallback className="text-2xl">
                  {user?.email?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <label className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-2 rounded-full cursor-pointer shadow">
                <Camera className="h-4 w-4" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    if (!user || !e.target.files?.[0]) return;
                    setUploading(true);

                    const file = e.target.files[0];
                    const { getStorage, ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
                    const { updateProfile } = await import("firebase/auth");

                    const storage = getStorage();
                    const imgRef = ref(storage, `avatars/${user.uid}`);
                    await uploadBytes(imgRef, file);
                    const url = await getDownloadURL(imgRef);

                    await updateProfile(user, { photoURL: url });
                    await setDoc(doc(db, "users", user.uid), { photoURL: url }, { merge: true });

                    setUploading(false);
                    window.location.reload();
                  }}
                />
              </label>
            </div>
            <CardTitle>{user?.email}</CardTitle>
            <CardDescription>Manage your academic profile</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* College */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <School className="h-4 w-4" /> College
              </Label>
              <Input
                placeholder="e.g. IIT Bombay"
                value={college}
                onChange={(e) => setCollege(e.target.value)}
              />
            </div>

            {/* Semester */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" /> Semester
              </Label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3"
                value={semester}
                onChange={(e) => setSemester(Number(e.target.value))}
              >
                <option value="">Select semester</option>
                {[1,2,3,4,5,6,7,8].map(s => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button className="flex-1" onClick={saveProfile} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={async () => {
                  await logout();
                  navigate("/auth");
                }}
              >
                <LogOut className="h-4 w-4 mr-2" /> Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
