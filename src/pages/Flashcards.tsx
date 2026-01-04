import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { calculateNextReview, INITIAL_CARD_DATA, SRSCardData, SRSRating } from "@/lib/srs";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Icons
import { 
  ArrowLeft, Plus, Trash2, Brain, 
  Layers, CheckCircle2, XCircle, 
  Play, Eye, Keyboard, Sparkles, Zap, Trophy, Search, Clock
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
  
  const { theme } = useTheme();
  
  // UI State
  const [activeDeckId, setActiveDeckId] = useState<string>("all");
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Creation State
  const [newCardFront, setNewCardFront] = useState("");
  const [newCardBack, setNewCardBack] = useState("");
  const [newCardDeck, setNewCardDeck] = useState("general");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // --- FIREBASE SYNC ---
  useEffect(() => {
    if (!user) {
      setCards([]);
      return;
    }
    
    let unsub: (() => void) | undefined;
    
    try {
      const q = query(collection(db, "users", user.uid, "flashcards"));
      unsub = onSnapshot(
        q, 
        (snap) => {
          try {
            const data = snap.docs.map(d => {
              const raw = d.data();
              return {
                id: d.id,
                front: raw.front || "",
                back: raw.back || "",
                deckId: raw.deckId || "general",
                createdAt: raw.createdAt || Date.now(),
                srs: raw.srs || INITIAL_CARD_DATA 
              } as Flashcard;
            });
            setCards(data);
          } catch (error) {
            console.error("Error processing flashcards:", error);
            // Don't show toast on every error, just log it
          }
        },
        (error) => {
          console.error("Firebase snapshot error:", error);
          // Only show error if it's a permission error or critical
          if (error.code === 'permission-denied') {
            toast.error("Permission denied. Please check your access.");
          }
        }
      );
    } catch (error) {
      console.error("Error setting up flashcards listener:", error);
      // Don't show toast, just set empty cards
      setCards([]);
    }
    
    return () => {
      if (unsub) unsub();
    };
  }, [user, toast]);

  // --- ACTIONS ---
  const addCard = async () => {
    if (!user || !newCardFront.trim() || !newCardBack.trim()) {
      toast.error("Please fill in both front and back of the card");
      return;
    }
    
    try {
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
      toast.success("Flashcard created!");
    } catch (error) {
      console.error("Error creating card:", error);
      toast.error("Failed to create flashcard");
    }
  };

  const deleteCard = async (id: string) => {
    if (!user) return;
    if (!confirm("Are you sure you want to delete this card?")) return;
    
    try {
      await deleteDoc(doc(db, "users", user.uid, "flashcards", id));
      toast.success("Card deleted");
    } catch (error) {
      console.error("Error deleting card:", error);
      toast.error("Failed to delete card");
    }
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

  const filteredCards = useMemo(() => {
    let filtered = cards.filter(c => activeDeckId === "all" || c.deckId === activeDeckId);
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.front.toLowerCase().includes(query) || 
        c.back.toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [cards, activeDeckId, searchQuery]);

  // --- RENDER STUDY MODE ---
  if (isStudyMode) {
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
  if (!user) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center transition-colors duration-300",
        theme === "dark" 
          ? "bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-background to-background"
          : "bg-gradient-to-br from-background via-background to-muted/20"
      )}>
        <div className="text-center space-y-4">
          <Brain className="h-16 w-16 text-muted-foreground/50 mx-auto" />
          <p className="text-muted-foreground">Please sign in to access flashcards</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen transition-colors duration-300 pb-10",
      theme === "dark" 
        ? "bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-background to-background"
        : "bg-gradient-to-br from-background via-background to-muted/20"
    )}>
      {/* HEADER */}
      <header className={cn("sticky top-0 z-50 border-b backdrop-blur-xl transition-all duration-300",
        theme === "dark" ? "bg-background/80 border-white/5" : "bg-background/60 border-border shadow-sm"
      )}>
        <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-xl transition-all duration-300",
                theme === "dark" ? "bg-primary/20" : "bg-primary/10"
              )}>
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-2xl font-bold", theme === "dark" ? "text-white" : "text-foreground")}>
                  Flashcards
                </h1>
                <p className="text-xs text-muted-foreground">Spaced Repetition System • {stats.due} cards due today</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/20"
              onClick={() => setIsStudyMode(true)}
              disabled={cards.length === 0}
            >
              <Play className="h-4 w-4 mr-2" /> Study Now
            </Button>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="lg" className="border-2">
                  <Plus className="h-4 w-4 mr-2" /> New Card
                </Button>
              </DialogTrigger>
              <DialogContent className={cn("sm:max-w-[600px]",
                theme === "dark" ? "bg-background/95 border-white/10" : "bg-background border-border"
              )}>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Create Flashcard
                  </DialogTitle>
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
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT: Stats & Decks */}
          <div className="space-y-6">
            {/* STATS CARD */}
            <Card className={cn("backdrop-blur-xl border transition-all duration-300 hover:shadow-xl",
              theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
            )}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Retention Overview
                </CardTitle>
                <CardDescription>Your flashcard mastery levels</CardDescription>
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
            <Card className={cn("backdrop-blur-xl border",
              theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
            )}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" />
                  Your Decks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <button 
                  onClick={() => setActiveDeckId("all")}
                  className={cn("w-full flex items-center justify-between p-3 rounded-lg text-sm font-medium transition-all",
                    activeDeckId === "all" 
                      ? "bg-primary text-primary-foreground shadow-md" 
                      : theme === "dark" ? "hover:bg-white/5" : "hover:bg-muted"
                  )}
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
                      className={cn("w-full flex items-center justify-between p-3 rounded-lg text-sm font-medium transition-all",
                        activeDeckId === deck.id 
                          ? "bg-primary/20 ring-2 ring-primary" 
                          : theme === "dark" ? "hover:bg-white/5" : "hover:bg-muted"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <div className={cn(`w-3 h-3 rounded-full ${deck.color}`)} />
                        {deck.name}
                      </span>
                      <Badge variant="outline">{count}</Badge>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: Card Grid */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className={cn("text-xl font-bold", theme === "dark" ? "text-white" : "text-foreground")}>
                {activeDeckId === "all" ? "All Cards" : decks.find(d => d.id === activeDeckId)?.name}
                {searchQuery && ` (${filteredCards.length} found)`}
              </h2>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search cards..." 
                    className="h-9 w-[200px] pl-8" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCards.map((card, index) => (
                <Card 
                  key={card.id} 
                  className={cn("group backdrop-blur-xl border transition-all duration-300 hover:shadow-xl hover:scale-[1.02]",
                    theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border",
                    `animate-in fade-in slide-in-from-bottom-${Math.min(index % 5 + 1, 5)}`
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <Badge variant="secondary" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        Next: {new Date(card.srs.nextReview).toLocaleDateString()}
                      </Badge>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10" 
                        onClick={() => deleteCard(card.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    <div className={cn("prose prose-sm dark:prose-invert max-w-none line-clamp-2",
                      theme === "dark" ? "text-white" : "text-foreground"
                    )}>
                      <ReactMarkdown>{card.front}</ReactMarkdown>
                    </div>
                    <Separator />
                    <div className={cn("prose prose-sm dark:prose-invert max-w-none text-muted-foreground line-clamp-2")}>
                      <ReactMarkdown>{card.back}</ReactMarkdown>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {filteredCards.length === 0 && cards.length > 0 && (
              <Card className={cn("backdrop-blur-xl border text-center py-12",
                theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
              )}>
                <CardContent>
                  <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-lg font-medium">No cards found</p>
                  <p className="text-sm text-muted-foreground">Try adjusting your search or deck filter</p>
                </CardContent>
              </Card>
            )}
            {cards.length === 0 && (
              <Card className={cn("backdrop-blur-xl border text-center py-12",
                theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/60 border-border"
              )}>
                <CardContent>
                  <Brain className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-lg font-medium mb-2">No cards yet</p>
                  <p className="text-sm text-muted-foreground mb-4">Create your first card to start learning</p>
                  <Button onClick={() => setIsDialogOpen(true)} className="bg-gradient-to-r from-primary to-purple-600">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Card
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ================= STUDY SESSION COMPONENT ================= */

function StudySession({ initialCards, onExit, userUid }: { initialCards: Flashcard[], onExit: () => void, userUid?: string }) {
  const [sessionQueue] = useState(() => {
    const now = Date.now();
    const due = initialCards.filter(c => c.srs.nextReview <= now).sort((a, b) => a.srs.nextReview - b.srs.nextReview);
    if (due.length < 5) {
        const notDue = initialCards.filter(c => c.srs.nextReview > now).sort(() => 0.5 - Math.random());
        return [...due, ...notDue.slice(0, 10 - due.length)];
    }
    return due.slice(0, 20); 
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

    // 2. Update Firestore
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished) return;
      
      if (e.code === "Space") {
        e.preventDefault(); 
        if (!isFlipped) setIsFlipped(true);
      }
      
      if (!isFlipped) return; // Prevent rating if card is not flipped

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

      {/* The Card Container */}
      <div className="relative w-full max-w-2xl aspect-[3/2] perspective-1000 group">
        <div 
          className="relative w-full h-full transition-transform duration-500 cursor-pointer"
          style={{ 
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
          }}
          onClick={() => !isFlipped && setIsFlipped(true)}
        >
          {/* FRONT (Question) */}
          <Card 
            className="absolute inset-0 flex flex-col items-center justify-center p-8 md:p-12 border-none shadow-2xl bg-white dark:bg-zinc-900 text-center"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <span className="absolute top-6 left-6 text-xs font-bold tracking-widest text-muted-foreground uppercase">Question</span>
            <div className="prose dark:prose-invert prose-lg max-w-none select-none">
              <ReactMarkdown>{currentCard.front}</ReactMarkdown>
            </div>
            
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-pulse">
               <span className="text-xs text-muted-foreground">Tap or Press Space to Flip</span>
               <Button size="sm" variant="secondary" className="rounded-full gap-2">
                 <Eye className="h-4 w-4" /> Show Answer
               </Button>
            </div>
          </Card>

          {/* BACK (Answer) */}
          <Card 
            className="absolute inset-0 flex flex-col items-center justify-center p-8 md:p-12 border-none shadow-2xl bg-white dark:bg-zinc-900 text-center"
            style={{ 
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)' // Essential: flips content so it's readable when wrapper is 180deg
            }}
          >
            <span className="absolute top-6 left-6 text-xs font-bold tracking-widest text-muted-foreground uppercase">Answer</span>
            <div className="prose dark:prose-invert prose-lg max-w-none">
              <ReactMarkdown>{currentCard.back}</ReactMarkdown>
            </div>
          </Card>
        </div>
      </div>

      {/* Controls - ONLY VISIBLE IF FLIPPED */}
      <div className={`mt-8 transition-all duration-300 ${isFlipped ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-4">
            <div className="flex flex-col items-center gap-1">
              <Button size="lg" variant="secondary" className="w-24 h-24 rounded-2xl flex flex-col gap-2 border-2 border-red-500/50 hover:bg-red-500/20 hover:border-red-500 text-red-500 transition-all hover:scale-105" onClick={() => handleRate("again")}>
                <span className="text-2xl">RE</span>
                <span className="text-sm font-bold">Again</span>
              </Button>
              <kbd className="text-[10px] text-white/30 font-mono border border-white/20 px-1.5 py-0.5 rounded">1</kbd>
            </div>
            
            <div className="flex flex-col items-center gap-1">
              <Button size="lg" variant="secondary" className="w-24 h-24 rounded-2xl flex flex-col gap-2 border-2 border-yellow-500/50 hover:bg-yellow-500/20 hover:border-yellow-500 text-yellow-500 transition-all hover:scale-105" onClick={() => handleRate("hard")}>
                <span className="text-2xl">😬</span>
                <span className="text-sm font-bold">Hard</span>
              </Button>
              <kbd className="text-[10px] text-white/30 font-mono border border-white/20 px-1.5 py-0.5 rounded">2</kbd>
            </div>

            <div className="flex flex-col items-center gap-1">
              <Button size="lg" variant="secondary" className="w-24 h-24 rounded-2xl flex flex-col gap-2 border-2 border-blue-500/50 hover:bg-blue-500/20 hover:border-blue-500 text-blue-500 transition-all hover:scale-105" onClick={() => handleRate("good")}>
                <span className="text-2xl">👍</span>
                <span className="text-sm font-bold">Good</span>
              </Button>
              <kbd className="text-[10px] text-white/30 font-mono border border-white/20 px-1.5 py-0.5 rounded">3</kbd>
            </div>

            <div className="flex flex-col items-center gap-1">
              <Button size="lg" variant="secondary" className="w-24 h-24 rounded-2xl flex flex-col gap-2 border-2 border-green-500/50 hover:bg-green-500/20 hover:border-green-500 text-green-500 transition-all hover:scale-105" onClick={() => handleRate("easy")}>
                <span className="text-2xl">⚡</span>
                <span className="text-sm font-bold">Easy</span>
              </Button>
              <kbd className="text-[10px] text-white/30 font-mono border border-white/20 px-1.5 py-0.5 rounded">4</kbd>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-white/40 text-xs">
            <Keyboard className="h-3 w-3" />
            <span>Use keyboard shortcuts</span>
          </div>
        </div>
      </div>
    </div>
  );
}