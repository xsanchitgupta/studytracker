import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  collection, query, orderBy, limit, addDoc, 
  onSnapshot, serverTimestamp, updateDoc, doc, 
  arrayUnion, arrayRemove, where 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";

/* --- UI COMPONENTS --- */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

/* --- ICONS --- */
import { 
  ArrowLeft, Send, MessageCircle, MoreVertical, 
  Smile, Reply, Trash2, Check, X, Hash, Users,
  Zap, Paperclip, Image as ImageIcon
} from "lucide-react";

/* ================= TYPES ================= */

type Reaction = {
  emoji: string;
  count: number;
  userIds: string[];
};

type ReplyInfo = {
  id: string;
  text: string;
  displayName: string;
};

type Message = {
  id: string;
  text: string;
  uid: string;
  displayName: string;
  photoURL: string;
  createdAt: any; // Firestore Timestamp
  reactions?: { [key: string]: string[] }; // emoji -> array of userIds
  replyTo?: ReplyInfo;
};

type OnlineUser = {
  uid: string;
  displayName: string;
  photoURL: string;
  lastActive: number;
  status: "online" | "idle" | "offline";
};

/* ================= HELPERS ================= */

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

function formatMessageDate(date: Date) {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

/* ================= PAGE COMPONENT ================= */

export default function Chat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // -- State --
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState<ReplyInfo | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isTyping, setIsTyping] = useState(false); // Local typing state
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // -- Load Messages --
  useEffect(() => {
    const q = query(collection(db, "global_chat"), orderBy("createdAt", "desc"), limit(100));
    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message)).reverse();
      setMessages(msgs);
      // Auto-scroll only if near bottom or new message is mine
      // For simplicity, we just scroll to bottom on load/update
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return () => unsub();
  }, []);

  // -- Mock Online Users (In production, use Realtime DB presence) --
  useEffect(() => {
    if (!user) return;
    // Just mock some data for the UI
    setOnlineUsers([
      { uid: "1", displayName: "Sarah Chen", photoURL: "", lastActive: Date.now(), status: "online" },
      { uid: "2", displayName: "Mike Ross", photoURL: "", lastActive: Date.now(), status: "idle" },
      { uid: "3", displayName: "Jessica P.", photoURL: "", lastActive: Date.now(), status: "online" },
    ]);
  }, [user]);

  // -- Actions --

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || !user) return;

    const textToSend = newMessage;
    const replyToSend = replyingTo;
    
    // Clear input immediately for UX
    setNewMessage("");
    setReplyingTo(null);
    setIsTyping(false);

    try {
      await addDoc(collection(db, "global_chat"), {
        text: textToSend,
        uid: user.uid,
        displayName: user.displayName || user.email?.split("@")[0],
        photoURL: user.photoURL,
        createdAt: serverTimestamp(),
        replyTo: replyToSend,
        reactions: {}
      });
    } catch (error) {
      console.error("Failed to send", error);
      // Ideally show toast here
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    // Logic for "User is typing..."
    if (!isTyping) {
      setIsTyping(true);
      // In real app, update Firestore/RTDB here
    }
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      // Update Firestore/RTDB that typing stopped
    }, 1000);
  };

  const toggleReaction = async (msgId: string, emoji: string) => {
    if (!user) return;
    const msgRef = doc(db, "global_chat", msgId);
    // Note: Deep nested updates in Firestore maps are tricky without known field paths.
    // This assumes a flat structure or specific field. 
    // A simplified approach for this demo:
    // We can't do atomic array toggle easily on nested maps without reading first or using cloud functions.
    // Let's assume we read the message from local state to decide add/remove for responsiveness, 
    // then write back the whole reactions object.
    
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    const currentReactions = msg.reactions || {};
    const usersForEmoji = currentReactions[emoji] || [];
    
    let newUsersForEmoji;
    if (usersForEmoji.includes(user.uid)) {
      newUsersForEmoji = usersForEmoji.filter(id => id !== user.uid);
    } else {
      newUsersForEmoji = [...usersForEmoji, user.uid];
    }

    const newReactions = { ...currentReactions, [emoji]: newUsersForEmoji };
    // Cleanup empty arrays
    if (newUsersForEmoji.length === 0) delete newReactions[emoji];

    await updateDoc(msgRef, { reactions: newReactions });
  };

  // -- Render Helpers --

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { [key: string]: Message[] } = {};
    messages.forEach(msg => {
      const date = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date();
      const key = formatMessageDate(date);
      if (!groups[key]) groups[key] = [];
      groups[key].push(msg);
    });
    return groups;
  }, [messages]);

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      
      {/* MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-background to-muted/20 relative">
        
        {/* HEADER */}
        <header className="h-16 border-b flex items-center justify-between px-4 bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="hover:bg-primary/10 rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-bold flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" /> 
                Study Lounge
              </h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {onlineUsers.length} online
              </p>
            </div>
          </div>
          
          <Button variant="ghost" size="icon" onClick={() => setShowSidebar(!showSidebar)} className={`${showSidebar ? "bg-muted" : ""}`}>
             <Users className="h-5 w-5" />
          </Button>
        </header>

        {/* MESSAGES LIST */}
        <ScrollArea className="flex-1 p-4">
          <div className="max-w-3xl mx-auto space-y-6 pb-4">
            {Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date} className="space-y-4">
                <div className="flex items-center gap-4">
                  <Separator className="flex-1" />
                  <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">{date}</span>
                  <Separator className="flex-1" />
                </div>
                
                {msgs.map((msg, i) => {
                  const isMe = msg.uid === user?.uid;
                  const showAvatar = i === 0 || msgs[i-1].uid !== msg.uid;

                  return (
                    <div 
                      key={msg.id} 
                      className={`group flex gap-3 ${isMe ? "flex-row-reverse" : "flex-row"} items-end`}
                    >
                      {/* Avatar */}
                      <div className={`w-8 h-8 shrink-0 ${!showAvatar ? "opacity-0" : ""}`}>
                         <Avatar className="w-8 h-8 ring-2 ring-background">
                            <AvatarImage src={msg.photoURL} />
                            <AvatarFallback>{msg.displayName[0]}</AvatarFallback>
                         </Avatar>
                      </div>

                      {/* Bubble Container */}
                      <div className={`flex flex-col gap-1 max-w-[80%] ${isMe ? "items-end" : "items-start"}`}>
                         
                         {/* Name (only if first in group) */}
                         {!isMe && showAvatar && (
                           <span className="text-xs text-muted-foreground ml-1">{msg.displayName}</span>
                         )}

                         {/* Reply Context */}
                         {msg.replyTo && (
                           <div className={`text-xs px-3 py-2 rounded-lg mb-[-8px] z-0 opacity-80 border-l-4 w-full cursor-pointer hover:opacity-100 transition-opacity ${isMe ? "bg-primary/10 border-primary text-primary-foreground" : "bg-muted border-muted-foreground/30"}`}>
                              <span className="font-bold mr-1">{msg.replyTo.displayName}:</span>
                              <span className="line-clamp-1">{msg.replyTo.text}</span>
                           </div>
                         )}

                         {/* The Bubble */}
                         <div 
                           className={`relative px-4 py-2.5 rounded-2xl shadow-sm z-10 text-sm leading-relaxed
                             ${isMe 
                               ? "bg-primary text-primary-foreground rounded-br-none" 
                               : "bg-white dark:bg-zinc-900 border border-border rounded-bl-none"
                             }
                           `}
                         >
                            <ReactMarkdown className="prose dark:prose-invert max-w-none text-inherit text-sm">
                               {msg.text}
                            </ReactMarkdown>

                            {/* Timestamp Hover */}
                            <span className="text-[10px] opacity-0 group-hover:opacity-60 transition-opacity absolute -bottom-5 right-0 text-muted-foreground whitespace-nowrap">
                              {msg.createdAt?.toDate ? format(msg.createdAt.toDate(), "h:mm a") : "Just now"}
                            </span>
                         </div>

                         {/* Reactions Display */}
                         {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                            <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
                               {Object.entries(msg.reactions).map(([emoji, userIds]) => (
                                 <Badge 
                                   key={emoji} 
                                   variant="secondary" 
                                   className={`h-5 px-1.5 gap-1 cursor-pointer hover:bg-muted-foreground/20 transition-colors ${userIds.includes(user?.uid || "") ? "bg-primary/20 border-primary/30 text-primary" : "bg-muted/50 border-transparent"}`}
                                   onClick={() => toggleReaction(msg.id, emoji)}
                                 >
                                    <span>{emoji}</span>
                                    <span className="text-[10px]">{userIds.length}</span>
                                 </Badge>
                               ))}
                            </div>
                         )}
                      </div>

                      {/* Actions (Hover) */}
                      <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mb-2 ${isMe ? "flex-row-reverse" : ""}`}>
                          <TooltipProvider>
                             <Tooltip>
                               <TooltipTrigger asChild>
                                 <Button 
                                   size="icon" 
                                   variant="ghost" 
                                   className="h-6 w-6 rounded-full hover:bg-muted"
                                   onClick={() => setReplyingTo({ id: msg.id, text: msg.text, displayName: msg.displayName })}
                                 >
                                    <Reply className="h-3 w-3" />
                                 </Button>
                               </TooltipTrigger>
                               <TooltipContent>Reply</TooltipContent>
                             </Tooltip>
                          </TooltipProvider>

                          <Popover>
                             <PopoverTrigger asChild>
                               <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full hover:bg-muted">
                                  <Smile className="h-3 w-3" />
                               </Button>
                             </PopoverTrigger>
                             <PopoverContent className="w-auto p-1 flex gap-1" align={isMe ? "end" : "start"}>
                                {REACTIONS.map(emoji => (
                                  <button 
                                    key={emoji} 
                                    className="p-1.5 hover:bg-muted rounded text-lg transition-transform hover:scale-125"
                                    onClick={() => toggleReaction(msg.id, emoji)}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                             </PopoverContent>
                          </Popover>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* INPUT AREA */}
        <div className="p-4 bg-background/80 backdrop-blur-md border-t">
           <div className="max-w-3xl mx-auto">
             {/* Reply Preview */}
             {replyingTo && (
               <div className="flex items-center justify-between bg-muted/50 p-2 px-3 rounded-t-lg border border-b-0 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                     <Reply className="h-3 w-3" />
                     <span>Replying to <strong>{replyingTo.displayName}</strong></span>
                  </div>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setReplyingTo(null)}>
                     <X className="h-3 w-3" />
                  </Button>
               </div>
             )}

             <form onSubmit={sendMessage} className={`flex items-end gap-2 p-2 rounded-xl border bg-background shadow-sm focus-within:ring-1 ring-primary/30 transition-all ${replyingTo ? "rounded-t-none border-t-0" : ""}`}>
                <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground">
                   <Paperclip className="h-4 w-4" />
                </Button>
                
                <Input 
                  value={newMessage}
                  onChange={handleTyping}
                  placeholder={`Message #${"Study Lounge"}`}
                  className="border-0 focus-visible:ring-0 bg-transparent min-h-[44px] py-3"
                />
                
                <Button 
                   type="submit" 
                   size="icon" 
                   disabled={!newMessage.trim()} 
                   className={newMessage.trim() ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}
                >
                   <Send className="h-4 w-4" />
                </Button>
             </form>
             
             <div className="text-[10px] text-muted-foreground mt-2 text-center flex justify-center items-center gap-2">
                <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-yellow-500" /> **Bold**, *Italic*, `Code` supported</span>
             </div>
           </div>
        </div>

      </div>

      {/* RIGHT SIDEBAR (Online Users) */}
      <div 
        className={`bg-background border-l w-64 transition-all duration-300 ease-in-out flex flex-col ${showSidebar ? "translate-x-0" : "translate-x-full w-0 border-0 overflow-hidden"}`}
      >
        <div className="p-4 border-b h-16 flex items-center font-semibold">
           Members
        </div>
        <ScrollArea className="flex-1 p-3">
           <div className="space-y-4">
              <div>
                 <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-2">Online — {onlineUsers.filter(u => u.status === 'online').length}</h4>
                 <div className="space-y-1">
                    {onlineUsers.filter(u => u.status === 'online').map(u => (
                       <div key={u.uid} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                          <div className="relative">
                             <Avatar className="h-8 w-8">
                                <AvatarImage src={u.photoURL} />
                                <AvatarFallback>{u.displayName[0]}</AvatarFallback>
                             </Avatar>
                             <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background" />
                          </div>
                          <span className="text-sm font-medium">{u.displayName}</span>
                       </div>
                    ))}
                 </div>
              </div>

              <div>
                 <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-2">Offline — 12</h4>
                 <div className="space-y-1 opacity-50">
                    <div className="flex items-center gap-3 p-2 rounded-lg">
                       <Avatar className="h-8 w-8 grayscale"><AvatarFallback>AB</AvatarFallback></Avatar>
                       <span className="text-sm">Alex Brown</span>
                    </div>
                    <div className="flex items-center gap-3 p-2 rounded-lg">
                       <Avatar className="h-8 w-8 grayscale"><AvatarFallback>CD</AvatarFallback></Avatar>
                       <span className="text-sm">Charlie D.</span>
                    </div>
                 </div>
              </div>
           </div>
        </ScrollArea>
      </div>

    </div>
  );
}