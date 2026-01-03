import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Trophy, Medal } from "lucide-react";

type LeaderboardUser = {
  id: string;
  displayName: string;
  photoURL: string;
  studyHours: number;
};

export default function Leaderboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      // Note: In a real app, you'd need a Cloud Function to aggregate 
      // study hours onto the user document to query them efficiently.
      // For now, we simulate this by fetching users.
      try {
        const q = query(collection(db, "users"), limit(10));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({
          id: d.id,
          displayName: d.data().displayName || d.data().email?.split('@')[0] || "User",
          photoURL: d.data().photoURL,
          // Randomize hours for demo since aggregation isn't set up yet
          studyHours: Math.floor(Math.random() * 50) + 10 
        }));
        setUsers(data.sort((a, b) => b.studyHours - a.studyHours));
      } catch (error) {
        console.error("Error fetching leaderboard", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 1: return <Medal className="h-6 w-6 text-gray-400" />;
      case 2: return <Medal className="h-6 w-6 text-amber-600" />;
      default: return <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-primary" /> Leaderboard
          </h1>
        </header>

        <Card className="border-2 shadow-xl">
          <CardHeader>
            <CardTitle>Top Students This Week</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="text-center py-8">Loading rankings...</div>
            ) : (
              users.map((user, index) => (
                <div 
                  key={user.id} 
                  className={`flex items-center gap-4 p-4 rounded-xl transition-colors ${index === 0 ? 'bg-yellow-500/10 border border-yellow-500/20' : 'hover:bg-muted'}`}
                >
                  <div className="w-10 flex justify-center shrink-0">
                    {getRankIcon(index)}
                  </div>
                  <Avatar className="h-12 w-12 border-2 border-background">
                    <AvatarImage src={user.photoURL} />
                    <AvatarFallback>{user.displayName[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{user.displayName}</p>
                    <p className="text-xs text-muted-foreground">Level {Math.floor(user.studyHours / 5) + 1}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-lg">{user.studyHours}h</p>
                    <p className="text-xs text-muted-foreground">studied</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}