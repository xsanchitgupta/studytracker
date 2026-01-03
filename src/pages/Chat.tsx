import { useEffect, useRef, useState } from "react";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  orderBy, 
  query, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  deleteDoc,
  getDoc
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Menu, Search, Settings, Send, Hash, 
  MessageSquare, Image as ImageIcon,
  MoreVertical, X, Paperclip,
  Trash2, Reply, Check, Loader2,
  Users, Mic, StopCircle, Pin, FileText,
  BarChart2, Play, Pause, Heart,
  Forward, CheckCheck, Smile, Code, ListTodo, Film, 
  Grid, Zap
} from "lucide-react";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger, DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, isToday, isYesterday, isValid } from "date-fns";
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
}

interface PollOption {
  id: number;
  text: string;
  votes: string[];
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  senderEmail?: string;
  createdAt: any;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  audioUrl?: string;
  gifUrl?: string;
  type: "text" | "image" | "file" | "audio" | "poll" | "gif";
  pollData?: {
    question: string;
    options: PollOption[];
    allowMultiple: boolean;
  };
  reactions: string[]; // Forced array
  replyTo?: { id: string; name: string; text: string };
  edited?: boolean;
  pinned?: boolean;
  readBy: string[]; // Forced array
}

interface UserStatus {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  status: "online" | "offline";
  lastSeen?: any;
  color?: string;
}

// --- Constants ---
const CHANNELS: ChatSession[] = [
  { id: "channel_general", type: "channel", name: "General Lounge", description: "Chill vibes & general talk" },
  { id: "channel_homework", type: "channel", name: "Homework Help", description: "Get help with assignments" },
  { id: "channel_resources", type: "channel", name: "Resources", description: "Share notes & PDFs" },
  { id: "channel_exams", type: "channel", name: "Exam Prep", description: "Grind time 📚" },
];

const MOCK_GIFS = [
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDdtY2F4bHl5eGZ4eHl5eHl5eHl5eHl5eHl5eHl5eHl5eHl5eHl5/3o7TKSjRrfIPjeiVyM/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYnJ5eHl5eHl5eHl5eHl5eHl5eHl5eHl5eHl5eHl5eHl5eHl5eHl5/LpDlq0g0Rj2hW/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYnJ5eHl5eHl5eHl5eHl5eHl5eHl5eHl5eHl5eHl5eHl5eHl5eHl5/3oKIPnAiaMCws8nOsE/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYnJ5eHl5eHl5eHl5eHl5eHl5eHl5eHl5eHl5eHl5eHl5eHl5eHl5/26u4lOMA8JKSnL9Uk/giphy.gif",
];

const EMOJIS = ["👍", "❤️", "🔥", "😂", "😮", "😢", "🎉", "🚀", "💯", "👀", "📚", "💻", "🧠", "☕"];

// --- Safety Utilities ---

const getUserColor = (uid: string | undefined | null) => {
  if (!uid) return "bg-gray-500";
  const colors = ["bg-red-500", "bg-orange-500", "bg-green-500", "bg-blue-500", "bg-purple-500", "bg-pink-500"];
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const getInitials = (name: string | undefined | null) => {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
};

const safeFormatDate = (timestamp: any, formatStr: string) => {
  if (!timestamp) return "";
  try {
    let date: Date;
    if (timestamp?.toDate) date = timestamp.toDate();
    else if (timestamp instanceof Date) date = timestamp;
    else if (typeof timestamp === 'number') date = new Date(timestamp);
    else if (typeof timestamp === 'string') date = new Date(timestamp);
    else return "";
    
    return isValid(date) ? format(date, formatStr) : "";
  } catch (e) {
    return "";
  }
};

const getRelativeDateLabel = (timestamp: any) => {
  if (!timestamp) return "";
  try {
    let date: Date;
    if (timestamp?.toDate) date = timestamp.toDate();
    else if (timestamp instanceof Date) date = timestamp;
    else return "";

    if (!isValid(date)) return "";
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "MMM d, yyyy");
  } catch (e) {
    return "";
  }
};

// --- Components ---

const AudioPlayer = ({ src }: { src: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const togglePlay = () => {
    if (audioRef.current) {
      isPlaying ? audioRef.current.pause() : audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };
  return (
    <div className="flex items-center gap-2 bg-muted/80 p-2 rounded-full border w-fit pr-4 my-1 select-none backdrop-blur-sm">
      <Button size="icon" variant="ghost" className={cn("h-8 w-8 rounded-full", isPlaying ? "bg-primary text-primary-foreground" : "bg-background")} onClick={togglePlay}>
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </Button>
      <div className="h-8 flex items-center gap-0.5">
         {[...Array(10)].map((_, i) => (
            <div key={i} className={cn("w-1 rounded-full transition-all", isPlaying ? "bg-primary animate-pulse" : "bg-muted-foreground/30")} style={{ height: isPlaying ? `${Math.random() * 16 + 8}px` : "4px", animationDelay: `${i * 0.05}s` }} />
         ))}
      </div>
      <audio ref={audioRef} src={src} onEnded={() => setIsPlaying(false)} onPause={() => setIsPlaying(false)} className="hidden" />
    </div>
  );
};

const UserAvatar = ({ name, photo, uid, className }: { name: string, photo?: string, uid: string, className?: string }) => (
  <Avatar className={cn(className)}>
    <AvatarImage src={photo || ""} />
    <AvatarFallback className={cn("text-white font-medium text-xs", getUserColor(uid))}>
      {getInitials(name)}
    </AvatarFallback>
  </Avatar>
);

export default function Chat() {
  const { user, profile } = useAuth();
  
  // Layout State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [membersOpen, setMembersOpen] = useState(true);
  const [activeChat, setActiveChat] = useState<ChatSession>(CHANNELS[0]);
  
  // Data State
  const [messages, setMessages] = useState<Message[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [dmUsers, setDmUsers] = useState<UserStatus[]>([]);
  const [channelMembers, setChannelMembers] = useState<UserStatus[]>([]);
  const [mediaFiles, setMediaFiles] = useState<Message[]>([]);
  
  // Interaction State
  const [text, setText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showSlashCommands, setShowSlashCommands] = useState(false);
  
  // Feature State
  const [isRecording, setIsRecording] = useState(false);
  const [pollDialogOpen, setPollDialogOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  
  // Refs
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Effects ---

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const users = snap.docs.map(d => {
          const data = d.data();
          let displayName = data.name;
          if (!displayName || displayName === "User") displayName = data.email?.split("@")[0] || "Anonymous";
          return {
            uid: d.id,
            name: displayName,
            email: data.email,
            photoURL: data.photoURL,
            status: (data.lastSignInAt?.toMillis() || 0) > (data.lastSignOutAt?.toMillis() || 0) ? "online" : "offline",
            lastSeen: data.lastSignInAt,
            color: getUserColor(d.id)
          } as UserStatus;
        }).filter(u => u.uid !== user.uid);
      setDmUsers(users);
      setChannelMembers(users);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setMessages([]); 
    const q = query(collection(db, "chats", activeChat.id, "messages"), orderBy("createdAt", "asc"));

    const unsub = onSnapshot(q, (snap) => {
      // 🛡️ STRICT DATA SANITIZATION HERE
      const msgs = snap.docs.map(d => {
        const data = d.data();
        return {
           id: d.id,
           text: String(data.text || ""),
           senderId: String(data.senderId || ""),
           senderName: String(data.senderName || "Unknown"),
           senderPhoto: data.senderPhoto,
           senderEmail: data.senderEmail,
           createdAt: data.createdAt,
           imageUrl: data.imageUrl,
           fileUrl: data.fileUrl,
           fileName: data.fileName,
           audioUrl: data.audioUrl,
           gifUrl: data.gifUrl,
           type: data.type || "text",
           pollData: data.pollData,
           reactions: Array.isArray(data.reactions) ? data.reactions : [], // FORCE ARRAY
           readBy: Array.isArray(data.readBy) ? data.readBy : [], // FORCE ARRAY
           replyTo: data.replyTo,
           edited: !!data.edited,
           pinned: !!data.pinned
        } as Message;
      });

      setMessages(msgs);
      setPinnedMessages(msgs.filter(m => m.pinned));
      setMediaFiles(msgs.filter(m => m.type === "image" || m.type === "file"));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    // Separate typing listener to avoid strict re-renders
    const typingUnsub = onSnapshot(doc(db, "chats", activeChat.id), (snap) => {
      const data = snap.data();
      if (data?.typing) {
        // Safe check for user existence
        setTypingUsers(Object.entries(data.typing)
            .filter(([uid, isTyping]) => isTyping && uid !== user.uid)
            .map(([uid]) => "Someone")); // Simplified to avoid dmUsers dependency issues
      } else {
        setTypingUsers([]);
      }
    });

    return () => { unsub(); typingUnsub(); };
  }, [activeChat.id, user]); // Removed dmUsers from dependency to prevent loops

  useEffect(() => {
    if (!searchQuery.trim()) setFilteredMessages(messages);
    else {
        const q = searchQuery.toLowerCase();
        setFilteredMessages(messages.filter(m => m.text?.toLowerCase().includes(q) || m.senderName?.toLowerCase().includes(q)));
    }
  }, [searchQuery, messages]);

  useEffect(() => {
    setShowSlashCommands(text === "/");
  }, [text]);

  // --- Handlers ---

  const handleSendMessage = async (
    customText?: string, 
    type: "text" | "image" | "file" | "audio" | "poll" | "gif" = "text",
    payload: any = {}
  ) => {
    if (!user) return;
    const textContent = customText !== undefined ? customText : text;
    if (type === "text" && !textContent.trim()) return;

    if (type === "text") setText(""); 
    setReplyingTo(null);
    setShowSlashCommands(false);

    let myName = profile?.name;
    if (!myName || myName === "User") myName = user.email?.split("@")[0] || "Me";

    try {
      await addDoc(collection(db, "chats", activeChat.id, "messages"), {
        text: textContent,
        senderId: user.uid,
        senderName: myName,
        senderPhoto: profile?.photoURL || "",
        senderEmail: user.email,
        createdAt: serverTimestamp(),
        type,
        reactions: [],
        readBy: [user.uid],
        replyTo: replyingTo ? { id: replyingTo.id, name: replyingTo.senderName, text: replyingTo.text } : null,
        ...payload
      });
      updateDoc(doc(db, "chats", activeChat.id), { [`typing.${user.uid}`]: false });
    } catch (error) {
      console.error(error);
      toast.error("Failed to send message");
    }
  };

  const uploadFile = async (file: Blob | File, type: "image" | "file" | "audio") => {
    if (!user) return;
    setIsUploading(true);
    const fileName = (file as File).name || `recording_${Date.now()}.webm`;
    try {
      const storageRef = ref(storage, `chat/${activeChat.id}/${Date.now()}_${fileName}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      const payload: any = {};
      if (type === "image") payload.imageUrl = url;
      if (type === "file") { payload.fileUrl = url; payload.fileName = fileName; }
      if (type === "audio") payload.audioUrl = url;
      await handleSendMessage(type === "audio" ? "Voice Note" : type === "file" ? "Shared a file" : "Shared an image", type, payload);
    } catch (err) {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const createPoll = async () => {
    if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) return toast.error("Invalid poll");
    const formattedOptions = pollOptions.filter(o => o.trim()).map((text, index) => ({ id: index, text, votes: [] }));
    await handleSendMessage("Poll", "poll", { pollData: { question: pollQuestion, options: formattedOptions, allowMultiple: false } });
    setPollDialogOpen(false); setPollQuestion(""); setPollOptions(["", ""]);
  };

  const votePoll = async (msgId: string, optionId: number) => {
    if (!user) return;
    const msgRef = doc(db, "chats", activeChat.id, "messages", msgId);
    const msgDoc = await getDoc(msgRef);
    const msgData = msgDoc.data() as Message;
    if (!msgData.pollData || !msgData.pollData.options) return; // EXTRA SAFETY
    
    const newOptions = msgData.pollData.options.map(opt => {
        if (opt.id === optionId) {
            if (opt.votes.includes(user.uid)) return { ...opt, votes: opt.votes.filter(v => v !== user.uid) };
            return { ...opt, votes: [...opt.votes, user.uid] };
        } else {
            return { ...opt, votes: opt.votes.filter(v => v !== user.uid) };
        }
    });
    await updateDoc(msgRef, { "pollData.options": newOptions });
  };

  const forwardMessage = async (msg: Message) => {
     await handleSendMessage(`Forwarded: ${msg.text}`, msg.type as any, { 
        imageUrl: msg.imageUrl, 
        fileUrl: msg.fileUrl, 
        fileName: msg.fileName 
     });
     toast.success("Message forwarded");
  };

  const convertToTask = (msg: Message) => {
      toast.success("Added to Study Tasks", {
          description: `"${msg.text.substring(0, 30)}..." added to your board.`
      });
  };

  const sendGif = async (url: string) => {
      await handleSendMessage("GIF", "gif", { gifUrl: url });
  };

  // --- Render Helpers ---

  const renderMessageContent = (m: Message) => {
     const linkRegex = /(https?:\/\/[^\s]+)/g;
     const textParts = m.text?.split(linkRegex) || [];

     if (m.text?.startsWith("```") && m.text.endsWith("```")) {
         const code = m.text.slice(3, -3);
         return <div className="bg-slate-950 text-slate-50 p-3 rounded-md font-mono text-sm overflow-x-auto my-1"><pre>{code}</pre></div>;
     }

     return (
        <div className="leading-relaxed whitespace-pre-wrap">
           {textParts.map((part, i) => (
              part.match(linkRegex) ? (
                 <a key={i} href={part} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">{part}</a>
              ) : (
                 <span key={i}>{part}</span>
              )
           ))}
        </div>
     );
  };

  if (!user) return (
      <div className="h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
  );

  return (
    <div className="h-screen flex bg-background overflow-hidden font-sans">
      
      {/* --- Sidebar --- */}
      {sidebarOpen && (
        <aside className="w-80 border-r bg-muted/10 flex flex-col shrink-0 animate-in slide-in-from-left duration-300 fixed md:relative z-20 h-full bg-background md:bg-transparent shadow-lg md:shadow-none">
          <div className="h-14 p-4 flex items-center justify-between border-b bg-background/50 backdrop-blur">
            <h2 className="font-bold text-lg flex items-center gap-2">
               <span className="p-1.5 bg-primary text-primary-foreground rounded-lg"><Zap className="h-4 w-4"/></span>
               StudyHub
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="md:hidden"><X className="h-4 w-4" /></Button>
          </div>

          <ScrollArea className="flex-1 px-3 py-4">
             <div className="mb-6">
               <h3 className="text-xs font-bold text-muted-foreground uppercase mb-2 px-2 flex items-center gap-2"><Hash className="h-3 w-3"/> Channels</h3>
               <div className="space-y-0.5">
                 {CHANNELS.map(channel => (
                   <button key={channel.id} onClick={() => { setActiveChat(channel); if(window.innerWidth < 768) setSidebarOpen(false); }} className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200", activeChat.id === channel.id ? "bg-primary/10 text-primary translate-x-1" : "text-muted-foreground hover:bg-muted")}>
                     {activeChat.id === channel.id ? <MessageSquare className="h-4 w-4" /> : <Hash className="h-4 w-4 opacity-70" />} {channel.name}
                   </button>
                 ))}
               </div>
            </div>
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase mb-2 px-2 flex items-center gap-2"><Users className="h-3 w-3"/> Direct Messages</h3>
              <div className="space-y-1">
                 {dmUsers.sort((a,b) => (a.status === 'online' ? -1 : 1)).map(u => (
                   <button key={u.uid} onClick={() => { setActiveChat({ id: [user!.uid, u.uid].sort().join("_"), type: "dm", name: u.name, avatar: u.photoURL, otherUserId: u.uid }); if(window.innerWidth < 768) setSidebarOpen(false); }} className={cn("w-full flex items-center gap-3 px-2 py-2 rounded-md group hover:bg-muted/50 transition-colors", activeChat.id === [user!.uid, u.uid].sort().join("_") ? "bg-accent" : "")}>
                     <div className="relative">
                       <UserAvatar name={u.name} photo={u.photoURL} uid={u.uid} className="h-8 w-8" />
                       <span className={cn("absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background", u.status === "online" ? "bg-green-500" : "bg-muted-foreground/30")} />
                     </div>
                     <p className={cn("text-sm truncate flex-1 text-left", activeChat.id.includes(u.uid) && "font-medium")}>{u.name}</p>
                   </button>
                 ))}
              </div>
            </div>
          </ScrollArea>
          
          <div className="p-3 border-t bg-background flex items-center gap-3">
             <UserAvatar name={profile?.name || user?.email || "Me"} photo={profile?.photoURL || ""} uid={user?.uid || "me"} className="h-9 w-9" />
             <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate">{profile?.name || user?.email?.split('@')[0] || "Me"}</p>
                <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"/><p className="text-xs text-muted-foreground truncate">Online</p></div>
             </div>
             <Settings className="h-4 w-4 text-muted-foreground cursor-pointer hover:spin-slow" />
          </div>
        </aside>
      )}

      {/* --- Main Chat --- */}
      <main className="flex-1 flex flex-col min-w-0 bg-background relative">
        <header className="h-14 border-b flex items-center justify-between px-4 bg-background/95 backdrop-blur z-10 sticky top-0">
          <div className="flex items-center gap-3">
             {!sidebarOpen && <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}><Menu className="h-5 w-5" /></Button>}
             <h1 className="font-bold flex items-center gap-2">
                {activeChat.type === "channel" ? <Hash className="h-5 w-5 text-muted-foreground" /> : <Avatar className="h-6 w-6"><AvatarImage src={activeChat.avatar}/><AvatarFallback>{activeChat.name[0]}</AvatarFallback></Avatar>}
                {activeChat.name}
             </h1>
          </div>
          <div className="flex items-center gap-1">
             <Sheet>
                <SheetTrigger asChild><Button variant="ghost" size="icon" className={cn(pinnedMessages.length > 0 && "text-primary")}><Pin className="h-5 w-5" /></Button></SheetTrigger>
                <SheetContent>
                    <SheetHeader><SheetTitle>Pinned Messages</SheetTitle></SheetHeader>
                    <ScrollArea className="h-[90vh] mt-4">
                        {pinnedMessages.length === 0 ? <p className="text-center text-muted-foreground">No pins yet.</p> : (
                            <div className="space-y-4">{pinnedMessages.map(m => (
                                <div key={m.id} className="bg-muted p-3 rounded-lg text-sm border-l-4 border-primary shadow-sm"><p className="font-bold text-xs mb-1">{m.senderName}</p><p>{m.text}</p></div>
                            ))}</div>
                        )}
                    </ScrollArea>
                </SheetContent>
             </Sheet>
            <div className="relative hidden md:block">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search..." className="pl-8 h-9 w-48 bg-muted/50 border-none focus-visible:ring-1" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <Button variant="ghost" size="icon" onClick={() => setMembersOpen(!membersOpen)}><Grid className="h-5 w-5" /></Button>
          </div>
        </header>

        <ScrollArea className="flex-1 p-4 bg-muted/5">
           <div className="max-w-4xl mx-auto pb-4">
              {filteredMessages.map((m, i) => {
                 const prevM = filteredMessages[i-1];
                 const isSameSender = prevM?.senderId === m.senderId;
                 const dateLabel = getRelativeDateLabel(m.createdAt);
                 const prevDateLabel = getRelativeDateLabel(prevM?.createdAt);
                 const showDate = dateLabel && dateLabel !== prevDateLabel;
                 const isMe = m.senderId === user?.uid;
                 const displayName = (m.senderName && m.senderName !== "User") ? m.senderName : (m.senderEmail?.split('@')[0] || "User");
                 const hasLiked = m.reactions?.includes(user?.uid || "");

                 return (
                    <div key={m.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                       {showDate && (
                           <div className="flex items-center my-6 opacity-70">
                               <div className="flex-1 h-[1px] bg-border"></div>
                               <span className="px-4 text-xs font-medium text-muted-foreground uppercase">{dateLabel}</span>
                               <div className="flex-1 h-[1px] bg-border"></div>
                           </div>
                       )}
                       
                       <div className={cn("group flex gap-3 mb-1 hover:bg-muted/40 -mx-4 px-4 py-1.5 transition-colors relative", !isSameSender && "mt-4")}>
                          <div className="w-9 shrink-0">
                             {!isSameSender ? (
                                <UserAvatar name={displayName} photo={m.senderPhoto} uid={m.senderId} className="h-9 w-9 hover:scale-105 transition-transform cursor-pointer" />
                             ) : (
                                <div className="w-9 text-[10px] text-muted-foreground text-center opacity-0 group-hover:opacity-100 pt-1">{safeFormatDate(m.createdAt, "h:mm a")}</div>
                             )}
                          </div>

                          <div className="flex-1 min-w-0">
                             {!isSameSender && (
                                <div className="flex items-baseline gap-2 mb-1">
                                   <span className="font-bold text-sm hover:underline cursor-pointer">{displayName}</span>
                                   <span className="text-[10px] text-muted-foreground">{safeFormatDate(m.createdAt, "h:mm a")}</span>
                                   {m.pinned && <Pin className="h-3 w-3 text-primary rotate-45" />}
                                </div>
                             )}

                             <div className="relative text-[15px] text-foreground/90">
                                {m.replyTo && (
                                   <div className="flex items-center gap-2 mb-1 pl-2 border-l-2 border-primary/50 text-xs text-muted-foreground cursor-pointer opacity-80 hover:opacity-100" onClick={() => {
                                       toast.info(`Replying to: ${m.replyTo?.text.substring(0, 20)}...`);
                                   }}>
                                      <Reply className="h-3 w-3" /> <span className="font-medium">@{m.replyTo.name}</span>
                                   </div>
                                )}

                                {m.type === "image" && <img src={m.imageUrl} className="rounded-md max-h-72 border shadow-sm my-1 cursor-pointer hover:brightness-95" alt="Attachment" />}
                                {m.type === "gif" && <img src={m.gifUrl} className="rounded-md max-h-60 border shadow-sm my-1" alt="GIF" />}
                                {m.type === "file" && (
                                    <div className="flex items-center gap-3 bg-card p-3 rounded-md border w-fit my-1 shadow-sm hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => window.open(m.fileUrl)}>
                                        <div className="p-2 bg-primary/10 rounded-full"><FileText className="h-6 w-6 text-primary"/></div>
                                        <div><p className="font-medium text-sm truncate max-w-[200px]">{m.fileName}</p><span className="text-xs text-muted-foreground">Click to download</span></div>
                                    </div>
                                )}
                                {m.type === "audio" && m.audioUrl && <AudioPlayer src={m.audioUrl} />}
                                {m.type === "poll" && m.pollData && m.pollData.options && (
                                    <div className="bg-card border rounded-lg p-4 max-w-sm my-1 shadow-sm">
                                        <p className="font-bold mb-3 flex items-center gap-2"><BarChart2 className="h-4 w-4 text-primary" /> {m.pollData.question}</p>
                                        <div className="space-y-2">
                                            {m.pollData.options.map((opt) => {
                                                const totalVotes = m.pollData?.options?.reduce((acc, o) => acc + (o.votes?.length || 0), 0) || 1;
                                                const percent = Math.round(((opt.votes?.length || 0) / totalVotes) * 100);
                                                const hasVoted = opt.votes?.includes(user!.uid);
                                                return (
                                                    <div key={opt.id} onClick={() => votePoll(m.id, opt.id)} className="cursor-pointer group/poll relative">
                                                        <div className="flex justify-between text-xs mb-1 font-medium z-10 relative"><span>{opt.text}</span><span>{opt.votes?.length || 0}</span></div>
                                                        <div className="h-8 relative bg-muted rounded-md overflow-hidden border">
                                                            <div className={cn("h-full transition-all duration-500", hasVoted ? "bg-primary" : "bg-primary/20 group-hover/poll:bg-primary/30")} style={{ width: `${percent}%` }} />
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                                {m.text && renderMessageContent(m)}
                                
                                <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 right-0 bg-background/80 backdrop-blur rounded-lg border shadow-sm px-1">
                                   <Button variant="ghost" size="icon" className={cn("h-7 w-7", hasLiked && "text-red-500")} onClick={async () => {
                                       const currentReactions = m.reactions || [];
                                       const newReactions = hasLiked ? currentReactions.filter(u => u !== user.uid) : [...currentReactions, user.uid];
                                       await updateDoc(doc(db, "chats", activeChat.id, "messages", m.id), { reactions: newReactions });
                                   }}><Heart className={cn("h-4 w-4", hasLiked && "fill-current")} /></Button>
                                   <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReplyingTo(m)}><Reply className="h-4 w-4" /></Button>
                                   <DropdownMenu>
                                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                          <DropdownMenuItem onClick={() => convertToTask(m)}><ListTodo className="h-4 w-4 mr-2" /> Taskify</DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => forwardMessage(m)}><Forward className="h-4 w-4 mr-2" /> Forward</DropdownMenuItem>
                                          <DropdownMenuItem onClick={async () => await updateDoc(doc(db, "chats", activeChat.id, "messages", m.id), { pinned: !m.pinned })}><Pin className="h-4 w-4 mr-2" /> {m.pinned ? "Unpin" : "Pin"}</DropdownMenuItem>
                                          {isMe && <DropdownMenuSeparator />}
                                          {isMe && <DropdownMenuItem className="text-destructive" onClick={() => deleteDoc(doc(db, "chats", activeChat.id, "messages", m.id))}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>}
                                      </DropdownMenuContent>
                                   </DropdownMenu>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    {m.reactions && m.reactions.length > 0 && (
                                        <div className="bg-muted border rounded-full px-1.5 py-0.5 text-[10px] flex items-center gap-1 shadow-sm animate-in zoom-in">
                                            <Heart className="h-2.5 w-2.5 fill-red-500 text-red-500" /> {m.reactions.length}
                                        </div>
                                    )}
                                    {isMe && (
                                        <span className="ml-auto text-xs text-muted-foreground flex items-center gap-0.5">
                                            {m.readBy?.length && m.readBy.length > 1 ? <CheckCheck className="h-3 w-3 text-blue-500" /> : <Check className="h-3 w-3" />}
                                        </span>
                                    )}
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>
                 );
              })}
              {typingUsers.length > 0 && <div className="text-xs text-muted-foreground italic animate-pulse ml-12">Someone is typing...</div>}
              <div ref={bottomRef} />
           </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 bg-background border-t relative">
           {showSlashCommands && (
               <div className="absolute bottom-full left-4 bg-popover border rounded-lg shadow-xl mb-2 p-1 min-w-[200px] animate-in slide-in-from-bottom-2 z-20">
                   <p className="text-xs text-muted-foreground px-2 py-1 font-semibold">COMMANDS</p>
                   <Button variant="ghost" className="w-full justify-start h-8 text-sm" onClick={() => { setText("/poll "); setShowSlashCommands(false); setPollDialogOpen(true); }}><BarChart2 className="h-4 w-4 mr-2"/> /poll</Button>
                   <Button variant="ghost" className="w-full justify-start h-8 text-sm" onClick={() => { setText("```\n\n```"); setShowSlashCommands(false); }}><Code className="h-4 w-4 mr-2"/> /code</Button>
               </div>
           )}
           
           <div className="max-w-4xl mx-auto space-y-2">
              {replyingTo && (
                 <div className="flex items-center justify-between bg-muted/40 p-2 rounded-lg border-l-4 border-l-primary animate-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><Reply className="h-3 w-3" /><span className="font-semibold">Replying to {replyingTo.senderName}</span></div>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setReplyingTo(null)}><X className="h-3 w-3" /></Button>
                 </div>
              )}
              <div className="flex items-end gap-2 bg-muted/30 p-2 rounded-xl border focus-within:ring-1 focus-within:ring-primary transition-all">
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted"><Paperclip className="h-5 w-5" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => fileInputRef.current?.click()}><ImageIcon className="h-4 w-4 mr-2"/> Image</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => fileInputRef.current?.click()}><FileText className="h-4 w-4 mr-2"/> Document</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPollDialogOpen(true)}><BarChart2 className="h-4 w-4 mr-2"/> Poll</DropdownMenuItem>
                    </DropdownMenuContent>
                 </DropdownMenu>
                 <input type="file" ref={fileInputRef} className="hidden" multiple onChange={(e) => { const f = e.target.files?.[0]; if(f) uploadFile(f, f.type.startsWith("image") ? "image" : "file"); }} />
                 
                 <Textarea
                    value={text}
                    onChange={(e) => { 
                        setText(e.target.value); 
                        if(!typingTimeoutRef.current) updateDoc(doc(db,"chats",activeChat.id),{[`typing.${user?.uid}`]:true}); 
                        clearTimeout(typingTimeoutRef.current!); 
                        typingTimeoutRef.current=setTimeout(()=>updateDoc(doc(db,"chats",activeChat.id),{[`typing.${user?.uid}`]:false}),2000); 
                    }}
                    onKeyDown={(e) => { if(e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }}}
                    placeholder={`Message #${activeChat.name} (Type / for commands)`}
                    className="min-h-[36px] max-h-40 bg-transparent border-none shadow-none focus-visible:ring-0 resize-none py-2 px-2"
                    rows={1}
                 />

                 <div className="flex items-center gap-1 pb-0.5">
                    <Popover>
                        <PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground"><Smile className="h-5 w-5" /></Button></PopoverTrigger>
                        <PopoverContent className="w-64 p-2" side="top">
                            <div className="grid grid-cols-5 gap-1">
                                {EMOJIS.map(e => <button key={e} className="p-1.5 hover:bg-muted rounded text-xl" onClick={() => setText(prev => prev + e)}>{e}</button>)}
                            </div>
                        </PopoverContent>
                    </Popover>
                    
                    <Popover>
                        <PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground"><Film className="h-5 w-5" /></Button></PopoverTrigger>
                        <PopoverContent className="w-72 p-0" side="top">
                            <div className="p-2 border-b font-semibold text-xs text-muted-foreground">Trending GIFs</div>
                            <div className="grid grid-cols-2 gap-1 p-1">
                                {MOCK_GIFS.map(g => <img key={g} src={g} className="cursor-pointer hover:opacity-80 rounded-md" onClick={() => sendGif(g)} />)}
                            </div>
                        </PopoverContent>
                    </Popover>

                    {isRecording ? (
                        <Button variant="destructive" size="icon" className="h-8 w-8 rounded-full animate-pulse" onClick={() => { if(mediaRecorderRef.current) mediaRecorderRef.current.stop(); setIsRecording(false); }}><StopCircle className="h-4 w-4" /></Button>
                    ) : (
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground" onClick={async () => {
                            try {
                                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                                const mediaRecorder = new MediaRecorder(stream);
                                mediaRecorderRef.current = mediaRecorder;
                                audioChunksRef.current = [];
                                mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
                                mediaRecorder.onstop = async () => {
                                    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                                    await uploadFile(audioBlob, "audio");
                                    stream.getTracks().forEach(track => track.stop());
                                };
                                mediaRecorder.start();
                                setIsRecording(true);
                            } catch(e) { toast.error("Mic access denied"); }
                        }}><Mic className="h-5 w-5" /></Button>
                    )}
                    <Button onClick={() => handleSendMessage()} disabled={!text.trim() && !isUploading} size="icon" className="h-8 w-8 rounded-full transition-transform hover:scale-105 active:scale-95">
                       {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 ml-0.5" />}
                    </Button>
                 </div>
              </div>
           </div>
        </div>
      </main>

      {/* --- Right Sidebar (Media/Members) --- */}
      {membersOpen && (
        <aside className="hidden xl:flex w-72 border-l bg-muted/10 flex-col animate-in slide-in-from-right duration-300">
           <Tabs defaultValue="members" className="w-full flex-1 flex flex-col">
              <div className="border-b px-4">
                  <TabsList className="w-full justify-start h-14 bg-transparent p-0">
                      <TabsTrigger value="members" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-4">Members</TabsTrigger>
                      <TabsTrigger value="media" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-4">Media</TabsTrigger>
                  </TabsList>
              </div>
              
              <TabsContent value="members" className="flex-1 p-0 m-0">
                  <ScrollArea className="h-[calc(100vh-3.5rem)] p-4">
                      <div className="space-y-6">
                        <div>
                            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3 flex items-center justify-between">Online <span className="text-[10px] bg-green-500/10 text-green-600 px-1.5 rounded-full">{channelMembers.filter(u => u.status === 'online').length}</span></h4>
                            {channelMembers.filter(u => u.status === 'online').map(u => (
                                <div key={u.uid} className="flex items-center gap-3 mb-2 p-1 hover:bg-muted rounded-md cursor-pointer transition-colors">
                                    <div className="relative"><UserAvatar name={u.name} photo={u.photoURL} uid={u.uid} className="h-8 w-8" /><span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 border-2 border-background rounded-full"></span></div>
                                    <div className="overflow-hidden"><p className="text-sm font-medium truncate">{u.name}</p></div>
                                </div>
                            ))}
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3">Offline</h4>
                            {channelMembers.filter(u => u.status === 'offline').map(u => (
                                <div key={u.uid} className="flex items-center gap-3 mb-2 p-1 hover:bg-muted rounded-md cursor-pointer opacity-60 hover:opacity-100">
                                    <UserAvatar name={u.name} photo={u.photoURL} uid={u.uid} className="h-8 w-8 grayscale" />
                                    <p className="text-sm font-medium truncate">{u.name}</p>
                                </div>
                            ))}
                        </div>
                      </div>
                  </ScrollArea>
              </TabsContent>
              
              <TabsContent value="media" className="flex-1 p-0 m-0">
                  <ScrollArea className="h-[calc(100vh-3.5rem)] p-4">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3">Shared Files</h4>
                      <div className="grid grid-cols-2 gap-2">
                          {mediaFiles.map(m => (
                              <div key={m.id} className="aspect-square bg-muted rounded-md overflow-hidden border cursor-pointer hover:opacity-90" onClick={() => window.open(m.imageUrl || m.fileUrl)}>
                                  {m.type === "image" ? <img src={m.imageUrl} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full"><FileText className="h-8 w-8 text-muted-foreground"/></div>}
                              </div>
                          ))}
                      </div>
                      {mediaFiles.length === 0 && <div className="text-center text-muted-foreground text-sm py-10">No media shared yet</div>}
                  </ScrollArea>
              </TabsContent>
           </Tabs>
        </aside>
      )}

      {/* Poll Dialog */}
      <Dialog open={pollDialogOpen} onOpenChange={setPollDialogOpen}>
        <DialogContent>
            <DialogHeader><DialogTitle>Create a Poll</DialogTitle></DialogHeader>
            <div className="space-y-3 py-4">
                <Input placeholder="Question (e.g., When's the deadline?)" value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} />
                {pollOptions.map((opt, i) => <Input key={i} placeholder={`Option ${i + 1}`} value={opt} onChange={e => { const newOpts = [...pollOptions]; newOpts[i] = e.target.value; setPollOptions(newOpts); }} />)}
                <Button variant="outline" size="sm" onClick={() => setPollOptions([...pollOptions, ""])}>+ Add Option</Button>
            </div>
            <DialogFooter><Button onClick={createPoll}>Create Poll</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}