import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { calculateNextReview, INITIAL_CARD_DATA, SRSCardData, SRSRating } from "@/lib/srs";
import ReactMarkdown from "react-markdown";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Icons
import { 
  ArrowLeft, Plus, Trash2, Brain, 
  Layers, CheckCircle2, XCircle, 
  Play
} from "lucide-react";

// Charts
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

/* --- TYPES --- */
type Flashcard = {
  id: string;
  front: string;
  back: string;
  deckId: string;
  srs: SRSCardData;
  createdAt: number;
};

type Deck = {
  id: string;
  name: string;
  color: string;
};

/* --- MOCK DATA --- */
const DEFAULT_DECKS: Deck[] = [
  { id: "general", name: "General Knowledge", color: "bg-blue-500" },
  { id: "math", name: "Mathematics", color: "bg-red-500" },
  { id: "cs", name: "Computer Science", color: "bg-green-500" },
];

export default function Flashcards() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Data State
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [decks, setDecks] = useState<Deck[]>(DEFAULT_DECKS);
  
  // UI State
  const [activeDeckId, setActiveDeckId] = useState<string>("all");
  const [isStudyMode, setIsStudyMode] = useState(false);
  
  // Creation State
  const [newCardFront, setNewCardFront] = useState("");
  const [newCardBack, setNewCardBack] = useState("");
  const [newCardDeck, setNewCardDeck] = useState("general");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // --- FIREBASE SYNC ---
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "flashcards"));
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => {
        const raw = d.data();
        return {
          id: d.id,
          front: raw.front,
          back: raw.back,
          deckId: raw.deckId || "general",
          createdAt: raw.createdAt || Date.now(),
          srs: raw.srs || INITIAL_CARD_DATA 
        } as Flashcard;
      });
      setCards(data);
    });
    return () => unsub();
  }, [user]);

  // --- ACTIONS ---
  const addCard = async () => {
    if (!user || !newCardFront.trim() || !newCardBack.trim()) return;
    
    await addDoc(collection(db, "users", user.uid, "flashcards"), { 
      front: newCardFront, 
      back: newCardBack,
      deckId: newCardDeck,
      srs: INITIAL_CARD_DATA,
      createdAt: Date.now()
    });
    
    setNewCardFront("");
    setNewCardBack("");
    setIsDialogOpen(false);
  };

  const deleteCard = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "flashcards", id));
  };

  // --- STATISTICS ---
  const stats = useMemo(() => {
    const total = cards.length;
    const due = cards.filter(c => c.srs.nextReview <= Date.now()).length;
    const learning = cards.filter(c => c.srs.repetition === 0).length;
    const mastered = cards.filter(c => c.srs.interval > 21).length; 
    
    const retentionData = [
      { name: "Learning", value: learning, fill: "#3b82f6" },
      { name: "Reviewing", value: total - learning - mastered, fill: "#eab308" },
      { name: "Mastered", value: mastered, fill: "#22c55e" },
    ];

    return { total, due, learning, mastered, retentionData };
  }, [cards]);

  // --- RENDER STUDY MODE ---
  if (isStudyMode) {
    // PASS A COPY of the relevant cards to prevent real-time shifting issues
    const studySet = activeDeckId === "all" ? cards : cards.filter(c => c.deckId === activeDeckId);
    
    return (
      <StudySession 
        initialCards={studySet} 
        onExit={() => setIsStudyMode(false)}
        userUid={user?.uid}
      />
    );
  }

  // --- RENDER DASHBOARD ---
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      {/* HEADER */}
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Brain className="h-8 w-8 text-primary" /> Flashcards
            </h1>
            <p className="text-muted-foreground">Spaced Repetition System • {stats.due} cards due today</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button 
            size="lg" 
            className="shadow-lg shadow-primary/20"
            onClick={() => setIsStudyMode(true)}
            disabled={cards.length === 0}
          >
            <Play className="h-4 w-4 mr-2" /> Study Now
          </Button>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="lg"><Plus className="h-4 w-4 mr-2" /> New Card</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Create Flashcard</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Front</label>
                    <Textarea 
                      placeholder="Question or Term..." 
                      className="h-32 resize-none font-mono text-sm"
                      value={newCardFront}
                      onChange={e => setNewCardFront(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Back</label>
                    <Textarea 
                      placeholder="Answer or Definition..." 
                      className="h-32 resize-none font-mono text-sm"
                      value={newCardBack}
                      onChange={e => setNewCardBack(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Deck</label>
                  <Select value={newCardDeck} onValueChange={setNewCardDeck}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {decks.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button onClick={addCard} className="w-full">Save Card</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT: Stats & Decks */}
        <div className="space-y-6">
          {/* STATS CARD */}
          <Card className="border-2 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Retention Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.retentionData} layout="vertical" margin={{ left: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={70} tick={{fontSize: 12}} />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px' }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                <div className="bg-blue-500/10 p-2 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{stats.learning}</p>
                  <p className="text-xs text-muted-foreground">New</p>
                </div>
                <div className="bg-yellow-500/10 p-2 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">{stats.due}</p>
                  <p className="text-xs text-muted-foreground">Due</p>
                </div>
                <div className="bg-green-500/10 p-2 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{stats.mastered}</p>
                  <p className="text-xs text-muted-foreground">Mastered</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* DECKS LIST */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Your Decks</h3>
            <button 
              onClick={() => setActiveDeckId("all")}
              className={`w-full flex items-center justify-between p-3 rounded-lg text-sm font-medium transition-all ${activeDeckId === "all" ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-muted"}`}
            >
              <span className="flex items-center gap-2"><Layers className="h-4 w-4" /> All Cards</span>
              <Badge variant="secondary" className="bg-background/20 hover:bg-background/30 text-current">{cards.length}</Badge>
            </button>
            {decks.map(deck => {
              const count = cards.filter(c => c.deckId === deck.id).length;
              return (
                <button 
                  key={deck.id}
                  onClick={() => setActiveDeckId(deck.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-sm font-medium transition-all ${activeDeckId === deck.id ? "bg-muted ring-2 ring-primary" : "hover:bg-muted"}`}
                >
                  <span className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${deck.color}`} />
                    {deck.name}
                  </span>
                  <Badge variant="outline">{count}</Badge>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Card Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">
              {activeDeckId === "all" ? "All Cards" : decks.find(d => d.id === activeDeckId)?.name}
            </h2>
            <div className="flex gap-2">
              <Input placeholder="Search cards..." className="h-8 w-[200px]" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cards
              .filter(c => activeDeckId === "all" || c.deckId === activeDeckId)
              .map(card => (
              <Card key={card.id} className="group hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      Next: {new Date(card.srs.nextReview).toLocaleDateString()}
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteCard(card.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                  
                  <div className="prose prose-sm dark:prose-invert max-w-none line-clamp-2">
                    <ReactMarkdown>{card.front}</ReactMarkdown>
                  </div>
                  <Separator />
                  <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground line-clamp-2">
                    <ReactMarkdown>{card.back}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {cards.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed rounded-xl">
              <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No cards yet</p>
              <p className="text-sm text-muted-foreground mb-4">Create your first card to start learning</p>
              <Button onClick={() => setIsDialogOpen(true)}>Create Card</Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ================= STUDY SESSION COMPONENT ================= */

function StudySession({ initialCards, onExit, userUid }: { initialCards: Flashcard[], onExit: () => void, userUid?: string }) {
  // CRITICAL FIX: Initialize the queue ONCE using useState instead of deriving it from props.
  // This prevents the queue from shifting under the user's feet when Firestore updates the `cards` prop.
  const [sessionQueue] = useState(() => {
    const now = Date.now();
    const due = initialCards.filter(c => c.srs.nextReview <= now).sort((a, b) => a.srs.nextReview - b.srs.nextReview);
    // If fewer than 5 due cards, mix in some random review cards to make it a worthwhile session (up to 10 total)
    if (due.length < 5) {
        const notDue = initialCards.filter(c => c.srs.nextReview > now).sort(() => 0.5 - Math.random());
        return [...due, ...notDue.slice(0, 10 - due.length)];
    }
    return due.slice(0, 20); // Cap at 20 per session for sanity
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, wrong: 0 });

  const currentCard = sessionQueue[currentIndex];
  const isFinished = currentIndex >= sessionQueue.length || !currentCard;

  const handleRate = async (rating: SRSRating) => {
    if (!currentCard || !userUid) return;

    // 1. Calculate new SRS data
    const newSRS = calculateNextReview(currentCard.srs, rating);

    // 2. Update Firestore (Background update, won't affect current `sessionQueue` because we used useState)
    await updateDoc(doc(db, "users", userUid, "flashcards", currentCard.id), {
      srs: newSRS
    });

    // 3. Update Stats
    if (rating === "again") {
      setSessionStats(p => ({ ...p, wrong: p.wrong + 1 }));
    } else {
      setSessionStats(p => ({ ...p, correct: p.correct + 1 }));
    }

    // 4. Move Next
    setIsFlipped(false);
    setCurrentIndex(p => p + 1);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished) return;
      
      if (e.code === "Space") {
        e.preventDefault(); 
        if (!isFlipped) setIsFlipped(true);
      }
      
      if (!isFlipped) return;

      switch(e.key) {
        case "1": handleRate("again"); break;
        case "2": handleRate("hard"); break;
        case "3": handleRate("good"); break;
        case "4": handleRate("easy"); break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFlipped, isFinished, currentCard]); 

  if (isFinished) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center shadow-2xl border-2">
          <CardHeader>
            <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
              <CheckCircle2 className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">Session Complete!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-green-500/10 rounded-xl">
                <p className="text-2xl font-bold text-green-600">{sessionStats.correct}</p>
                <p className="text-sm text-muted-foreground">Remembered</p>
              </div>
              <div className="p-4 bg-red-500/10 rounded-xl">
                <p className="text-2xl font-bold text-red-600">{sessionStats.wrong}</p>
                <p className="text-sm text-muted-foreground">Needs Work</p>
              </div>
            </div>
          </CardContent>
          <div className="p-6">
            <Button size="lg" className="w-full" onClick={onExit}>Back to Dashboard</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-neutral-950 to-neutral-950 pointer-events-none" />

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10">
        <Button variant="ghost" className="text-white hover:bg-white/10" onClick={onExit}>
          <XCircle className="h-6 w-6 mr-2" /> Quit
        </Button>
        <div className="flex items-center gap-4">
          <span className="text-white/60 font-mono text-sm">
            {currentIndex + 1} / {sessionQueue.length}
          </span>
          <Progress value={((currentIndex) / sessionQueue.length) * 100} className="w-32 h-2" />
        </div>
      </div>

      {/* The Card */}
      <div className="relative w-full max-w-2xl aspect-[3/2] perspective-1000 group">
        <div 
          className={`relative w-full h-full transition-all duration-500 transform-style-3d cursor-pointer ${isFlipped ? "rotate-y-180" : ""}`}
          onClick={() => !isFlipped && setIsFlipped(true)}
        >
          {/* FRONT */}
          <Card className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-8 md:p-12 border-none shadow-2xl bg-white dark:bg-zinc-900 text-center">
            <span className="absolute top-6 left-6 text-xs font-bold tracking-widest text-muted-foreground uppercase">Question</span>
            <div className="prose dark:prose-invert prose-lg max-w-none">
              <ReactMarkdown>{currentCard.front}</ReactMarkdown>
            </div>
            <p className="absolute bottom-6 text-xs text-muted-foreground animate-pulse">Press Space to flip</p>
          </Card>

          {/* BACK */}
          <Card className="absolute inset-0 backface-hidden rotate-y-180 flex flex-col items-center justify-center p-8 md:p-12 border-none shadow-2xl bg-white dark:bg-zinc-900 text-center">
            <span className="absolute top-6 left-6 text-xs font-bold tracking-widest text-muted-foreground uppercase">Answer</span>
            <div className="prose dark:prose-invert prose-lg max-w-none">
              <ReactMarkdown>{currentCard.back}</ReactMarkdown>
            </div>
          </Card>
        </div>
      </div>

      {/* Controls */}
      <div className={`mt-8 transition-all duration-300 ${isFlipped ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}>
        <div className="flex gap-4">
            <Button size="lg" variant="secondary" className="w-24 border-2 border-red-500/50 hover:bg-red-500/20 hover:border-red-500 text-red-500" onClick={() => handleRate("again")}>
              Again
            </Button>
            <Button size="lg" variant="secondary" className="w-24 border-2 border-yellow-500/50 hover:bg-yellow-500/20 hover:border-yellow-500 text-yellow-500" onClick={() => handleRate("hard")}>
              Hard
            </Button>
            <Button size="lg" variant="secondary" className="w-24 border-2 border-blue-500/50 hover:bg-blue-500/20 hover:border-blue-500 text-blue-500" onClick={() => handleRate("good")}>
              Good
            </Button>
            <Button size="lg" variant="secondary" className="w-24 border-2 border-green-500/50 hover:bg-green-500/20 hover:border-green-500 text-green-500" onClick={() => handleRate("easy")}>
              Easy
            </Button>
        </div>
      </div>
    </div>
  );
}