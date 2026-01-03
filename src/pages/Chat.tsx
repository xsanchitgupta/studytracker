import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom"; 
import { 
  collection, addDoc, onSnapshot, orderBy, query, serverTimestamp, 
  doc, updateDoc, deleteDoc, setDoc, limit 
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, Hash, Send, X, Paperclip, Trash2, 
  Edit2, Reply, ChevronLeft, ArrowDown, Loader2, Users, 
  LogOut, Menu, Image as ImageIcon
} from "lucide-react";
import { 
  Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle 
} from "@/components/ui/sheet";
import { format, isToday, isYesterday } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// --- Types ---
type ChatType = "channel" | "dm";

interface ChatSession {
  id: string;
  type: ChatType;
  name: string;
  avatar?: string;
  description?: string;
  otherUserId?: string;
  color?: string;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  createdAt: any;
  imageUrl?: string;
  type: "text" | "image";
  replyTo?: { id: string; name: string; text: string };
  edited?: boolean;
}

interface UserStatus {
  uid: string;
  name: string;
  email?: string;
  photoURL?: string;
  status: "online" | "offline";
  colorClass: string;
}

// --- Utilities ---

// 1. Consistent Avatar Colors
const getAvatarColor = (id: string) => {
  const colors = [
    "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-green-500", 
    "bg-emerald-500", "bg-teal-500", "bg-cyan-500", "bg-sky-500", 
    "bg-blue-500", "bg-indigo-500", "bg-violet-500", "bg-purple-500", 
    "bg-fuchsia-500", "bg-pink-500", "bg-rose-500"
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

// 2. Strict Name Formatting (Removes Domain, Capitalizes)
const formatName = (user: { displayName?: string | null, email?: string | null }) => {
  if (user.email) {
    const namePart = user.email.split('@')[0];
    // Replace dots/underscores with spaces and capitalize each word
    return namePart
      .replace(/[._]/g, ' ')
      .split(' ')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }
  return user.displayName || "Anonymous Student";
};

const CHANNELS: ChatSession[] = [
  { id: "channel_general", type: "channel", name: "general", description: "General discussion & chill", color: "text-blue-400" },
  { id: "channel_homework", type: "channel", name: "homework-help", description: "Solve problems together", color: "text-emerald-400" },
  { id: "channel_resources", type: "channel", name: "resources", description: "Notes, links & PDFs", color: "text-orange-400" },
  { id: "channel_announcements", type: "channel", name: "announcements", description: "Important updates", color: "text-purple-400" },
];

export default function Chat() {
  const { user, profile } = useAuth();
  const navigate = useNavigate(); // Changed from useRouter (Next.js) to useNavigate (React Router)

  // Layout State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(true);

  // Data State
  const [activeChat, setActiveChat] = useState<ChatSession>(CHANNELS[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<UserStatus[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Interaction State
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Refs
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Effects ---

  // 1. Fetch Users (Deduplicated & Formatted)
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const userMap = new Map<string, UserStatus>();
      
      snap.docs.forEach(d => {
        const data = d.data();
        const isOnline = (data.lastSignInAt?.toMillis() || 0) > (data.lastSignOutAt?.toMillis() || 0);
        
        userMap.set(d.id, {
          uid: d.id,
          name: formatName({ displayName: data.name, email: data.email }),
          email: data.email,
          photoURL: data.photoURL,
          status: isOnline ? "online" : "offline",
          colorClass: getAvatarColor(d.id)
        });
      });

      // Convert Map to Array to guarantee uniqueness
      setUsers(Array.from(userMap.values()));
    });
    return () => unsub();
  }, [user]);

  // 2. Message Listener
  useEffect(() => {
    setLoadingMessages(true);
    const q = query(
      collection(db, "chats", activeChat.id, "messages"), 
      orderBy("createdAt", "asc"),
      limit(150)
    );

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
      setMessages(msgs);
      setLoadingMessages(false);
      
      // Auto-scroll on new message
      if (snap.metadata.hasPendingWrites || msgs.length > 0) {
         setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    });

    // Typing Listener
    const typingUnsub = onSnapshot(doc(db, "chats", activeChat.id), (snap) => {
      const data = snap.data();
      if (data?.typing) {
        const typers = Object.entries(data.typing)
          .filter(([uid, isTyping]) => isTyping && uid !== user?.uid)
          .map(([uid]) => {
             const u = users.find(usr => usr.uid === uid);
             return u ? u.name.split(' ')[0] : "Someone";
          });
        setTypingUsers(typers);
      } else {
        setTypingUsers([]);
      }
    });

    return () => { unsub(); typingUnsub(); };
  }, [activeChat.id, user, users]);

  // 3. Scroll Button Logic
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setShowScrollButton(scrollHeight - scrollTop - clientHeight > 300);
  };

  // --- Actions ---

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const cancelImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendMessage = async () => {
    if ((!text.trim() && !imageFile) || !user) return;

    if (editingMessage) {
      await updateDoc(doc(db, "chats", activeChat.id, "messages", editingMessage.id), {
        text: text,
        edited: true
      });
      setEditingMessage(null);
      setText("");
      toast.success("Message updated");
      return;
    }

    setIsUploading(true);
    const currentText = text;
    const currentReply = replyingTo;
    
    setText("");
    setReplyingTo(null);
    cancelImage(); 

    try {
      let imageUrl = "";
      if (imageFile) {
        const storageRef = ref(storage, `chat_images/${Date.now()}_${imageFile.name}`);
        const snap = await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(snap.ref);
      }

      await addDoc(collection(db, "chats", activeChat.id, "messages"), {
        text: currentText,
        imageUrl: imageUrl,
        type: imageUrl ? "image" : "text",
        senderId: user.uid,
        senderName: formatName(user),
        senderPhoto: profile?.photoURL || "",
        createdAt: serverTimestamp(),
        replyTo: currentReply ? {
          id: currentReply.id,
          name: currentReply.senderName,
          text: currentReply.text
        } : null
      });
      
      updateDoc(doc(db, "chats", activeChat.id), { [`typing.${user.uid}`]: false });
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      toast.error("Failed to send message");
      setText(currentText);
    } finally {
      setIsUploading(false);
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (!user) return;
    
    if (!typingTimeoutRef.current) {
      setDoc(doc(db, "chats", activeChat.id), { typing: { [user.uid]: true } }, { merge: true });
    }
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setDoc(doc(db, "chats", activeChat.id), { typing: { [user.uid]: false } }, { merge: true });
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const startDM = (targetUser: UserStatus) => {
    if (!user) return;
    const chatId = [user.uid, targetUser.uid].sort().join("_");
    setActiveChat({
        id: chatId,
        type: "dm",
        name: targetUser.name,
        avatar: targetUser.photoURL,
        otherUserId: targetUser.uid
    });
    setMobileMenuOpen(false);
  };

  // --- Render Components ---

  const renderDateSeparator = (date: Date) => (
    <div className="flex items-center justify-center my-6 relative">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border/40" />
      </div>
      <span className="relative flex justify-center text-xs font-medium text-muted-foreground/60 uppercase bg-background px-2">
        {isToday(date) ? "Today" : isYesterday(date) ? "Yesterday" : format(date, "MMMM d, yyyy")}
      </span>
    </div>
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-muted/20">
      {/* Sidebar Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-border/40 bg-background/50 backdrop-blur">
         <Button 
            variant="ghost" 
            size="sm"
            className="gap-2 font-semibold text-muted-foreground hover:text-primary -ml-2 transition-colors"
            onClick={() => navigate('/dashboard')}
          >
            <ChevronLeft className="h-4 w-4" />
            Dashboard
          </Button>
          <ThemeToggle />
      </div>

      <ScrollArea className="flex-1 px-2 py-4">
          {/* Channels */}
          <div className="mb-6">
             <div className="px-2 mb-2 flex items-center justify-between group">
                <h3 className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider transition-colors group-hover:text-muted-foreground">
                  Text Channels
                </h3>
             </div>
             <div className="space-y-[2px]">
               {CHANNELS.map(channel => (
                 <button
                   key={channel.id}
                   onClick={() => { setActiveChat(channel); setMobileMenuOpen(false); }}
                   className={cn(
                     "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-all duration-200 group",
                     activeChat.id === channel.id 
                       ? "bg-muted/80 text-foreground" 
                       : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                   )}
                 >
                   <Hash className={cn("h-4 w-4 shrink-0", activeChat.id === channel.id ? "text-foreground" : "text-muted-foreground/50")} />
                   <span className="truncate">{channel.name}</span>
                 </button>
               ))}
             </div>
          </div>

          {/* DMs */}
          <div>
            <div className="px-2 mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Direct Messages</h3>
            </div>
            <div className="space-y-[2px]">
               {users.filter(u => u.uid !== user?.uid).map(u => (
                 <button
                   key={u.uid}
                   onClick={() => startDM(u)}
                   className={cn(
                     "w-full flex items-center gap-3 px-2 py-2 rounded-md transition-all duration-200 group",
                     activeChat.id.includes(u.uid) ? "bg-muted/80 text-foreground" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                   )}
                 >
                   <div className="relative shrink-0">
                     <Avatar className="h-7 w-7">
                       <AvatarImage src={u.photoURL || ""} />
                       <AvatarFallback className={cn("text-[10px] text-white font-bold", u.colorClass)}>
                           {u.name[0]}
                       </AvatarFallback>
                     </Avatar>
                     <span className={cn(
                       "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
                       u.status === "online" ? "bg-emerald-500" : "bg-gray-400"
                     )} />
                   </div>
                   <span className="text-sm font-medium truncate">{u.name}</span>
                 </button>
               ))}
            </div>
          </div>
      </ScrollArea>

      {/* Current User Footer */}
      <div className="p-3 bg-background/80 border-t border-border/40 flex items-center gap-2">
          <Avatar className="h-8 w-8 hover:opacity-80 transition-opacity cursor-pointer">
             <AvatarImage src={profile?.photoURL || ""} />
             <AvatarFallback className="bg-primary text-primary-foreground text-xs">{formatName({email: user?.email})[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
             <div className="text-sm font-bold truncate leading-none">{formatName({displayName: profile?.displayName, email: user?.email})}</div>
             <div className="text-[10px] text-muted-foreground truncate leading-tight">Online</div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => navigate('/dashboard')}>
             <LogOut className="h-4 w-4" />
          </Button>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex bg-background font-sans overflow-hidden">
      
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:block w-64 border-r border-border/40 shrink-0">
         <SidebarContent />
      </aside>

      {/* MOBILE DRAWER */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
         <SheetContent side="left" className="p-0 w-72 border-r border-border/40">
            <SheetHeader className="sr-only">
               <SheetTitle>Navigation Menu</SheetTitle>
            </SheetHeader>
            <SidebarContent />
         </SheetContent>
      </Sheet>

      {/* MAIN CHAT AREA */}
      <main className="flex-1 flex flex-col min-w-0 bg-background relative">
        
        {/* Chat Header */}
        <header className="h-14 px-4 flex items-center justify-between border-b border-border/40 bg-background/95 backdrop-blur z-10 shadow-sm">
          <div className="flex items-center gap-3">
             <Button variant="ghost" size="icon" className="md:hidden -ml-2" onClick={() => setMobileMenuOpen(true)}>
                <Menu className="h-5 w-5" />
             </Button>

             <div className="flex items-center gap-2">
                {activeChat.type === 'channel' ? (
                   <Hash className="h-5 w-5 text-muted-foreground" />
                ) : (
                   <span className="font-bold text-lg text-muted-foreground">@</span>
                )}
                <h1 className="font-bold text-base md:text-lg text-foreground">{activeChat.name}</h1>
                {activeChat.type === 'channel' && (
                  <span className="hidden md:inline text-xs text-muted-foreground border-l border-border/50 pl-2 ml-1">
                    {activeChat.description}
                  </span>
                )}
             </div>
          </div>

          <div className="flex items-center gap-2">
             <div className="relative hidden md:block">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <input 
                  placeholder="Search" 
                  className="h-7 w-48 bg-muted/50 rounded-md pl-7 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all" 
                />
             </div>
             <Button 
               variant="ghost" 
               size="icon" 
               className={cn("text-muted-foreground transition-colors", membersOpen && "text-foreground bg-muted")}
               onClick={() => setMembersOpen(!membersOpen)}
             >
               <Users className="h-5 w-5" />
             </Button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 relative overflow-hidden flex flex-col">
           <ScrollArea 
             className="flex-1" 
             onScrollCapture={handleScroll}
           >
              <div className="flex flex-col justify-end min-h-full py-4 px-4 md:px-6">
                 {/* Welcome Message */}
                 {messages.length < 5 && !loadingMessages && (
                    <div className="mb-8 mt-12">
                       <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                          <Hash className="h-8 w-8 text-muted-foreground" />
                       </div>
                       <h1 className="text-3xl font-bold mb-2">Welcome to #{activeChat.name}!</h1>
                       <p className="text-muted-foreground">This is the start of the <span className="font-medium text-foreground">#{activeChat.name}</span> channel.</p>
                    </div>
                 )}

                 {/* Message List */}
                 {messages.map((m, i) => {
                    const prevM = messages[i-1];
                    // Group messages if same sender and less than 5 minutes apart
                    const isSequence = prevM && prevM.senderId === m.senderId && (m.createdAt?.toMillis() - prevM.createdAt?.toMillis() < 300000);
                    const date = m.createdAt?.toDate ? m.createdAt.toDate() : new Date();
                    const showDateSeparator = !prevM || !isToday(date) || (prevM.createdAt?.toDate && !isToday(prevM.createdAt.toDate()));

                    return (
                       <div key={m.id} className="group/msg">
                          {showDateSeparator && renderDateSeparator(date)}
                          
                          <div className={cn(
                             "flex gap-4 pr-4 pl-2 py-0.5 relative hover:bg-muted/30 -mx-2 md:-mx-4 px-2 md:px-4 transition-colors",
                             !isSequence ? "mt-4" : "mt-0.5",
                             editingMessage?.id === m.id && "bg-muted/50"
                          )}>
                             {/* Hover Actions */}
                             <div className="absolute right-4 top-0 -translate-y-1/2 bg-background border shadow-sm rounded-md flex items-center opacity-0 group-hover/msg:opacity-100 transition-opacity z-10 p-0.5">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReplyingTo(m)}>
                                   <Reply className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                {user?.uid === m.senderId && (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingMessage(m); setText(m.text); }}>
                                       <Edit2 className="h-3 w-3 text-muted-foreground" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => deleteDoc(doc(db, "chats", activeChat.id, "messages", m.id))}>
                                       <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </>
                                )}
                             </div>

                             {/* Avatar Side */}
                             <div className="w-10 shrink-0 cursor-pointer pt-0.5">
                                {!isSequence ? (
                                   <Avatar className="h-10 w-10 hover:drop-shadow-md transition-all">
                                      <AvatarImage src={m.senderPhoto} />
                                      <AvatarFallback className={cn("text-white font-bold", getAvatarColor(m.senderId))}>
                                         {m.senderName[0]}
                                      </AvatarFallback>
                                   </Avatar>
                                ) : (
                                   <div className="w-10 text-[10px] text-muted-foreground/0 group-hover/msg:text-muted-foreground/40 text-center select-none pt-1">
                                      {format(date, "h:mm a")}
                                   </div>
                                )}
                             </div>

                             {/* Content Side */}
                             <div className="flex-1 min-w-0">
                                {!isSequence && (
                                   <div className="flex items-center gap-2 mb-0.5">
                                      <span className="font-semibold text-foreground hover:underline cursor-pointer">
                                         {m.senderName}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground/60">
                                         {format(date, "MM/dd/yyyy h:mm a")}
                                      </span>
                                   </div>
                                )}

                                {m.replyTo && !isSequence && (
                                   <div className="flex items-center gap-1 text-xs text-muted-foreground/70 mb-1 ml-0.5">
                                      <div className="w-4 border-t-2 border-l-2 border-border rounded-tl-md h-2 mt-1" />
                                      <span className="font-medium">@{m.replyTo.name}</span>
                                      <span className="truncate max-w-[200px] opacity-80">{m.replyTo.text}</span>
                                   </div>
                                )}

                                <div className={cn("text-[15px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words")}>
                                   {m.type === "image" && m.imageUrl && (
                                      <div className="my-2 max-w-sm rounded-lg overflow-hidden border border-border bg-muted/20">
                                         <img src={m.imageUrl} alt="Attachment" className="max-h-80 w-auto object-contain" />
                                      </div>
                                   )}
                                   {m.text}
                                   {m.edited && <span className="text-[10px] text-muted-foreground ml-1">(edited)</span>}
                                </div>
                             </div>
                          </div>
                       </div>
                    );
                 })}
                 <div ref={bottomRef} className="h-4" />
              </div>
           </ScrollArea>

           {/* Scroll Down Button */}
           {showScrollButton && (
             <Button 
               className="absolute bottom-24 right-6 rounded-full shadow-lg z-20 animate-in fade-in"
               size="icon"
               onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
             >
               <ArrowDown className="h-5 w-5" />
             </Button>
           )}

           {/* Typing Indicator */}
           {typingUsers.length > 0 && (
              <div className="absolute bottom-20 left-4 flex items-center gap-2 text-xs font-bold text-foreground/80 animate-in slide-in-from-bottom-2">
                 <div className="flex gap-0.5">
                    <span className="w-1.5 h-1.5 bg-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-foreground rounded-full animate-bounce"></span>
                 </div>
                 {typingUsers.join(", ")} is typing...
              </div>
           )}

           {/* Input Area */}
           <div className="p-4 bg-background">
              <div className="relative bg-muted/30 rounded-xl border border-border/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                 {/* Preview Area */}
                 {(replyingTo || imagePreview) && (
                    <div className="flex items-center justify-between p-2.5 border-b border-border/40 bg-muted/20 rounded-t-xl">
                       <div className="flex items-center gap-3 text-xs overflow-hidden">
                          {replyingTo && (
                             <div className="flex items-center gap-1 text-muted-foreground">
                                <Reply className="h-3 w-3" />
                                <span className="font-semibold text-foreground">Replying to {replyingTo.senderName}</span>
                             </div>
                          )}
                          {imagePreview && (
                             <div className="flex items-center gap-2 border rounded-md p-1 bg-background">
                                <img src={imagePreview} className="h-8 w-8 object-cover rounded" />
                                <span className="text-muted-foreground">Image attached</span>
                             </div>
                          )}
                       </div>
                       <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full" onClick={() => { setReplyingTo(null); cancelImage(); }}>
                          <X className="h-3 w-3" />
                       </Button>
                    </div>
                 )}

                 <div className="flex items-end p-1">
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
                    <Button 
                       variant="ghost" 
                       size="icon" 
                       className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground shrink-0 mb-0.5"
                       onClick={() => fileInputRef.current?.click()}
                    >
                       <div className="bg-muted-foreground/20 p-1.5 rounded-full">
                         <Paperclip className="h-4 w-4" />
                       </div>
                    </Button>

                    <Textarea
                       value={text}
                       onChange={handleTyping}
                       onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                             e.preventDefault();
                             handleSendMessage();
                          }
                       }}
                       placeholder={`Message #${activeChat.name}`}
                       className="border-0 bg-transparent focus-visible:ring-0 resize-none py-3.5 max-h-48 min-h-[44px]"
                       rows={1}
                    />

                    <Button 
                       onClick={handleSendMessage}
                       disabled={(!text.trim() && !imageFile) || isUploading}
                       size="icon"
                       className="h-10 w-10 rounded-full shrink-0 mb-0.5 mr-1"
                       variant={text.trim() || imageFile ? "default" : "ghost"}
                    >
                       {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                 </div>
              </div>
           </div>
        </div>
      </main>

      {/* RIGHT MEMBER SIDEBAR */}
      {membersOpen && (
        <aside className="hidden lg:flex w-64 border-l border-border/40 bg-muted/10 flex-col">
           <div className="h-14 p-4 border-b border-border/40 flex items-center font-bold text-sm text-muted-foreground">
              MEMBERS — {users.length}
           </div>
           <ScrollArea className="flex-1 p-3">
              {/* Online Users */}
              <div className="mb-6">
                 <h4 className="text-[11px] font-bold text-muted-foreground/60 uppercase mb-2 px-2">
                    Online — {users.filter(u => u.status === 'online').length}
                 </h4>
                 {users.filter(u => u.status === 'online').map(u => (
                    <div key={u.uid} className="flex items-center gap-2.5 p-2 rounded-md hover:bg-muted/50 cursor-pointer group opacity-100" onClick={() => startDM(u)}>
                       <div className="relative">
                          <Avatar className="h-8 w-8">
                             <AvatarImage src={u.photoURL} />
                             <AvatarFallback className={cn("text-[10px] text-white font-bold", u.colorClass)}>{u.name[0]}</AvatarFallback>
                          </Avatar>
                          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-emerald-500 border-2 border-background rounded-full" />
                       </div>
                       <div className="overflow-hidden">
                          <p className="text-sm font-medium truncate group-hover:underline">{u.name}</p>
                       </div>
                    </div>
                 ))}
              </div>

              {/* Offline Users */}
              <div>
                 <h4 className="text-[11px] font-bold text-muted-foreground/60 uppercase mb-2 px-2">
                    Offline — {users.filter(u => u.status === 'offline').length}
                 </h4>
                 {users.filter(u => u.status === 'offline').map(u => (
                    <div key={u.uid} className="flex items-center gap-2.5 p-2 rounded-md hover:bg-muted/50 cursor-pointer group opacity-50 hover:opacity-100 transition-opacity" onClick={() => startDM(u)}>
                       <Avatar className="h-8 w-8 grayscale">
                          <AvatarImage src={u.photoURL} />
                          <AvatarFallback className={cn("text-[10px] text-white font-bold", u.colorClass)}>{u.name[0]}</AvatarFallback>
                       </Avatar>
                       <p className="text-sm font-medium truncate group-hover:underline">{u.name}</p>
                    </div>
                 ))}
              </div>
           </ScrollArea>
        </aside>
      )}
    </div>
  );
}