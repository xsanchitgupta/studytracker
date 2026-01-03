import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, orderBy, limit, addDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Send, MessageCircle } from "lucide-react";

type Message = {
  id: string;
  text: string;
  uid: string;
  displayName: string;
  photoURL: string;
  createdAt: any;
};

export default function Chat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, "global_chat"), orderBy("createdAt", "desc"), limit(50));
    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message)).reverse();
      setMessages(msgs);
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return () => unsub();
  }, []);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    await addDoc(collection(db, "global_chat"), {
      text: newMessage,
      uid: user.uid,
      displayName: user.displayName || user.email?.split("@")[0],
      photoURL: user.photoURL,
      createdAt: serverTimestamp()
    });
    setNewMessage("");
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="border-b p-4 flex items-center gap-3 bg-background/80 backdrop-blur sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-primary" /> Study Lounge
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.uid === user?.uid ? "flex-row-reverse" : ""}`}>
            <Avatar className="h-8 w-8 mt-1">
              <AvatarImage src={msg.photoURL} />
              <AvatarFallback>{msg.displayName[0]}</AvatarFallback>
            </Avatar>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
              msg.uid === user?.uid 
                ? "bg-primary text-primary-foreground rounded-tr-none" 
                : "bg-muted rounded-tl-none"
            }`}>
              <p className="text-xs opacity-70 mb-1">{msg.displayName}</p>
              <p className="text-sm">{msg.text}</p>
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 border-t flex gap-2">
        <Input 
          value={newMessage} 
          onChange={(e) => setNewMessage(e.target.value)} 
          placeholder="Type a message..." 
          className="flex-1"
        />
        <Button type="submit" size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}