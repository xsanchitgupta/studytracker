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
import { ThemeToggle } from "@/components/ThemeToggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Menu, Search, Settings, Send, Hash, 
  MessageSquare, Image as ImageIcon, Smile, 
  MoreVertical, X, Paperclip,
  Trash2, Edit2, Reply, Check, Loader2,
  Users, Mic, StopCircle, Pin, FileText,
  BarChart2, Play
} from "lucide-react";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger, DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
  senderEmail?: string; // Added for fallback
  createdAt: any;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  audioUrl?: string;
  type: "text" | "image" | "file" | "audio" | "poll";
  pollData?: {
    question: string;
    options: PollOption[];
    allowMultiple: boolean;
  };
  replyTo?: { id: string; name: string; text: string };
  edited?: boolean;
  pinned?: boolean;
}

interface UserStatus {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  status: "online" | "offline";
  lastSeen?: any;
  color?: string; // For avatar fallback
}

// --- Constants & Helpers ---
const CHANNELS: ChatSession[] = [
  { id: "channel_general", type: "channel", name: "General Lounge", description: "Chill vibes & general talk" },
  { id: "channel_homework", type: "channel", name: "Homework Help", description: "Get help with assignments" },
  { id: "channel_resources", type: "channel", name: "Resources", description: "Share notes & PDFs" },
  { id: "channel_exams", type: "channel", name: "Exam Prep", description: "Grind time 📚" },
];

// Generate consistent colors for users without photos
const getUserColor = (uid: string) => {
  const colors = [
    "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-green-500", 
    "bg-emerald-500", "bg-teal-500", "bg-cyan-500", "bg-blue-500", 
    "bg-indigo-500", "bg-violet-500", "bg-purple-500", "bg-fuchsia-500", 
    "bg-pink-500", "bg-rose-500"
  ];
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map(n => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
};

export default function Chat() {
  const { user, profile } = useAuth();
  
  // Layout & Data State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [membersOpen, setMembersOpen] = useState(true);
  const [activeChat, setActiveChat] = useState<ChatSession>(CHANNELS[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [dmUsers, setDmUsers] = useState<UserStatus[]>([]);
  const [channelMembers, setChannelMembers] = useState<UserStatus[]>([]);
  
  // Interaction State
  const [text, setText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  
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

  // 1. Fetch Users (With Fixes for Name/Photo)
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const users = snap.docs
        .map(d => {
          const data = d.data();
          const isOnline = (data.lastSignInAt?.toMillis() || 0) > (data.lastSignOutAt?.toMillis() || 0);
          
          // FIX: Use Email prefix if name is missing or "User"
          let displayName = data.name;
          if (!displayName || displayName === "User") {
             displayName = data.email?.split("@")[0] || "Anonymous";
          }

          return {
            uid: d.id,
            name: displayName,
            email: data.email,
            photoURL: data.photoURL,
            status: isOnline ? "online" : "offline",
            lastSeen: data.lastSignInAt,
            color: getUserColor(d.id) // Assign color
          } as UserStatus;
        })
        .filter(u => u.uid !== user.uid);
        
      setDmUsers(users);
      setChannelMembers(users);
    });
    return () => unsub();
  }, [user]);

  // 2. Listen to Messages
  useEffect(() => {
    setMessages([]); 
    const q = query(collection(db, "chats", activeChat.id, "messages"), orderBy("createdAt", "asc"));

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => {
        const data = d.data();
        // FIX: Also fix names in old messages dynamically if possible, or just use what's stored
        // Ideally, we store senderName correctly on send.
        return { id: d.id, ...data } as Message;
      });
      setMessages(msgs);
      setPinnedMessages(msgs.filter(m => m.pinned));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    // Typing Listeners
    const typingUnsub = onSnapshot(doc(db, "chats", activeChat.id), (snap) => {
      const data = snap.data();
      if (data?.typing) {
        setTypingUsers(
          Object.entries(data.typing)
            .filter(([uid, isTyping]) => isTyping && uid !== user?.uid)
            .map(([uid]) => dmUsers.find(u => u.uid === uid)?.name || "Someone")
        );
      } else {
        setTypingUsers([]);
      }
    });

    return () => { unsub(); typingUnsub(); };
  }, [activeChat.id, user, dmUsers]);

  // 3. Search Filter
  useEffect(() => {
    if (!searchQuery.trim()) {
        setFilteredMessages(messages);
    } else {
        const q = searchQuery.toLowerCase();
        setFilteredMessages(messages.filter(m => 
            m.text.toLowerCase().includes(q) || 
            m.senderName.toLowerCase().includes(q)
        ));
    }
  }, [searchQuery, messages]);

  // --- Actions ---

  const handleSendMessage = async (
    customText?: string, 
    type: "text" | "image" | "file" | "audio" | "poll" = "text",
    payload: any = {}
  ) => {
    if (!user) return;
    const textContent = customText !== undefined ? customText : text;
    if (type === "text" && !textContent.trim()) return;

    if (type === "text") setText(""); 
    setReplyingTo(null);

    // FIX: Calculate correct display name for sender BEFORE sending
    let myName = profile?.name;
    if (!myName || myName === "User") {
        myName = user.email?.split("@")[0] || "Me";
    }

    try {
      await addDoc(collection(db, "chats", activeChat.id, "messages"), {
        text: textContent,
        senderId: user.uid,
        senderName: myName,
        senderPhoto: profile?.photoURL || "",
        senderEmail: user.email,
        createdAt: serverTimestamp(),
        type,
        replyTo: replyingTo ? { id: replyingTo.id, name: replyingTo.senderName, text: replyingTo.text } : null,
        ...payload
      });
      
      updateDoc(doc(db, "chats", activeChat.id), { [`typing.${user.uid}`]: false });
    } catch (error) {
      toast.error("Message failed to send");
    }
  };

  // Voice Note Handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await uploadFile(audioBlob, "audio");
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // File Upload
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/")) uploadFile(file, "image");
    else uploadFile(file, "file");
  };

  // Polls
  const createPoll = async () => {
    if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) {
      toast.error("Poll needs a question and 2+ options");
      return;
    }
    const formattedOptions = pollOptions.filter(o => o.trim()).map((text, index) => ({ id: index, text, votes: [] }));
    await handleSendMessage("Poll", "poll", { pollData: { question: pollQuestion, options: formattedOptions, allowMultiple: false } });
    setPollDialogOpen(false); setPollQuestion(""); setPollOptions(["", ""]);
  };

  const votePoll = async (msgId: string, optionId: number, currentVotes: string[]) => {
    if (!user) return;
    const msgRef = doc(db, "chats", activeChat.id, "messages", msgId);
    const msgDoc = await getDoc(msgRef);
    const msgData = msgDoc.data() as Message;
    if (!msgData.pollData) return;
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

  const togglePin = async (msg: Message) => {
    await updateDoc(doc(db, "chats", activeChat.id, "messages", msg.id), { pinned: !msg.pinned });
    toast.success(msg.pinned ? "Message unpinned" : "Message pinned");
  };

  // --- Sub-Components ---
  
  // Custom Avatar Component for consistent look
  const UserAvatar = ({ name, photo, uid, className }: { name: string, photo?: string, uid: string, className?: string }) => (
    <Avatar className={cn(className)}>
      <AvatarImage src={photo || ""} />
      <AvatarFallback className={cn("text-white font-medium text-xs", getUserColor(uid))}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );

  const renderDateSeparator = (date: Date) => (
    <div className="flex items-center my-6 opacity-70">
      <div className="flex-1 h-[1px] bg-border"></div>
      <span className="px-4 text-xs font-medium text-muted-foreground uppercase">
        {isToday(date) ? "Today" : isYesterday(date) ? "Yesterday" : format(date, "MMMM d, yyyy")}
      </span>
      <div className="flex-1 h-[1px] bg-border"></div>
    </div>
  );

  return (
    <div className="h-screen flex bg-background overflow-hidden font-sans">
      
      {/* --- Sidebar (Left) --- */}
      {sidebarOpen && (
        <aside className="w-80 border-r bg-muted/10 flex flex-col shrink-0">
          <div className="h-14 p-4 flex items-center justify-between border-b">
            <h2 className="font-bold text-lg flex items-center gap-2">
               <span className="p-1.5 bg-primary text-primary-foreground rounded-lg"><Hash className="h-4 w-4"/></span>
               StudyHub
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="md:hidden"><X className="h-4 w-4" /></Button>
          </div>

          <ScrollArea className="flex-1 px-3 py-4">
             <div className="mb-6">
               <h3 className="text-xs font-bold text-muted-foreground uppercase mb-2 px-2">Study Rooms</h3>
               <div className="space-y-0.5">
                 {CHANNELS.map(channel => (
                   <button
                     key={channel.id}
                     onClick={() => setActiveChat(channel)}
                     className={cn(
                       "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                       activeChat.id === channel.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                     )}
                   >
                     {activeChat.id === channel.id ? <MessageSquare className="h-4 w-4" /> : <Hash className="h-4 w-4 opacity-70" />}
                     {channel.name}
                   </button>
                 ))}
               </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase mb-2 px-2">Direct Messages</h3>
              <div className="space-y-1">
                 {dmUsers.sort((a,b) => (a.status === 'online' ? -1 : 1)).map(u => (
                   <button
                     key={u.uid}
                     onClick={() => {
                        const chatId = [user!.uid, u.uid].sort().join("_");
                        setActiveChat({ id: chatId, type: "dm", name: u.name, avatar: u.photoURL, otherUserId: u.uid });
                     }}
                     className={cn(
                       "w-full flex items-center gap-3 px-2 py-2 rounded-md group hover:bg-muted/50 transition-colors",
                       activeChat.id.includes(u.uid) ? "bg-accent" : ""
                     )}
                   >
                     <div className="relative">
                       <UserAvatar name={u.name} photo={u.photoURL} uid={u.uid} className="h-8 w-8" />
                       <span className={cn(
                         "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background",
                         u.status === "online" ? "bg-green-500" : "bg-muted-foreground/30"
                       )} />
                     </div>
                     <p className={cn("text-sm truncate flex-1 text-left", activeChat.id.includes(u.uid) && "font-medium")}>
                        {u.name}
                     </p>
                   </button>
                 ))}
              </div>
            </div>
          </ScrollArea>
          
          {/* User Profile Footer */}
          <div className="p-3 border-t bg-background flex items-center gap-3">
             <UserAvatar name={profile?.name || user?.email || "Me"} photo={profile?.photoURL || ""} uid={user?.uid || "me"} className="h-9 w-9" />
             <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate">{profile?.name || user?.email?.split('@')[0] || "Me"}</p>
                <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"/>
                    <p className="text-xs text-muted-foreground truncate">Online</p>
                </div>
             </div>
             <Settings className="h-4 w-4 text-muted-foreground cursor-pointer" />
          </div>
        </aside>
      )}

      {/* --- Main Chat Area --- */}
      <main className="flex-1 flex flex-col min-w-0 bg-background relative">
        <header className="h-14 border-b flex items-center justify-between px-4 bg-background/95 backdrop-blur z-10">
          <div className="flex items-center gap-3">
             {!sidebarOpen && <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}><Menu className="h-5 w-5" /></Button>}
             <div>
                <h1 className="font-bold flex items-center gap-2">
                    {activeChat.type === "channel" && <Hash className="h-5 w-5 text-muted-foreground" />}
                    {activeChat.name}
                </h1>
             </div>
          </div>

          <div className="flex items-center gap-1">
             <Sheet>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" title="Pinned" className={cn(pinnedMessages.length > 0 && "text-primary")}><Pin className="h-5 w-5" /></Button>
                </SheetTrigger>
                <SheetContent>
                    <SheetHeader><SheetTitle>Pinned Messages</SheetTitle></SheetHeader>
                    <ScrollArea className="h-[90vh] mt-4">
                        {pinnedMessages.length === 0 ? <p className="text-center text-muted-foreground">No pins yet.</p> : (
                            <div className="space-y-4">
                                {pinnedMessages.map(m => (
                                    <div key={m.id} className="bg-muted p-3 rounded-lg text-sm border-l-4 border-primary">
                                        <div className="flex items-center gap-2 mb-1">
                                            <UserAvatar name={m.senderName} photo={m.senderPhoto} uid={m.senderId} className="h-5 w-5" />
                                            <span className="font-bold">{m.senderName}</span>
                                        </div>
                                        <p>{m.text}</p>
                                        <Button variant="link" size="sm" className="h-auto p-0 mt-2 text-xs" onClick={() => togglePin(m)}>Unpin</Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </SheetContent>
             </Sheet>
            <div className="relative hidden md:block">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search messages..." className="pl-8 h-9 w-48 bg-muted/50 border-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <Button variant="ghost" size="icon" onClick={() => setMembersOpen(!membersOpen)}><Users className="h-5 w-5" /></Button>
          </div>
        </header>

        <ScrollArea className="flex-1 p-4 bg-muted/5">
           <div className="max-w-4xl mx-auto pb-4">
              {filteredMessages.map((m, i) => {
                 const prevM = filteredMessages[i-1];
                 const isSameSender = prevM?.senderId === m.senderId;
                 const date = m.createdAt?.toDate ? m.createdAt.toDate() : new Date();
                 const showDateSeparator = !prevM || !isToday(date) || (prevM.createdAt?.toDate && !isToday(prevM.createdAt.toDate()));
                 const isMe = m.senderId === user?.uid;
                 // Fix name logic for old messages if senderName is "User"
                 const displayName = (m.senderName && m.senderName !== "User") ? m.senderName : (m.senderEmail?.split('@')[0] || "User");

                 return (
                    <div key={m.id}>
                       {showDateSeparator && renderDateSeparator(date)}
                       
                       <div className={cn("group flex gap-3 mb-1 hover:bg-muted/40 -mx-4 px-4 py-1.5 transition-colors relative", !isSameSender && "mt-4")}>
                          <div className="w-9 shrink-0">
                             {!isSameSender ? (
                                <UserAvatar name={displayName} photo={m.senderPhoto} uid={m.senderId} className="h-9 w-9 hover:scale-105 transition-transform cursor-pointer" />
                             ) : (
                                <div className="w-9 text-[10px] text-muted-foreground text-center opacity-0 group-hover:opacity-100 pt-1">{format(date, "h:mm a")}</div>
                             )}
                          </div>

                          <div className="flex-1 min-w-0">
                             {!isSameSender && (
                                <div className="flex items-baseline gap-2 mb-1">
                                   <span className="font-bold text-sm hover:underline cursor-pointer">{displayName}</span>
                                   <span className="text-[10px] text-muted-foreground">{format(date, "h:mm a")}</span>
                                   {m.pinned && <Pin className="h-3 w-3 text-primary rotate-45" />}
                                </div>
                             )}

                             <div className="relative text-[15px] text-foreground/90">
                                {m.replyTo && (
                                   <div className="flex items-center gap-2 mb-1 pl-2 border-l-2 border-primary/50 text-xs text-muted-foreground cursor-pointer">
                                      <Reply className="h-3 w-3" /> 
                                      <span className="font-medium">@{m.replyTo.name}</span>: <span className="truncate max-w-[200px]">{m.replyTo.text}</span>
                                   </div>
                                )}
                                {m.type === "image" && <img src={m.imageUrl} className="rounded-md max-h-72 border shadow-sm my-1" alt="Attachment" />}
                                {m.type === "file" && (
                                    <div className="flex items-center gap-3 bg-muted p-3 rounded-md border w-fit my-1">
                                        <div className="p-2 bg-background rounded-full"><FileText className="h-6 w-6 text-primary"/></div>
                                        <div><p className="font-medium text-sm truncate max-w-[200px]">{m.fileName}</p><a href={m.fileUrl} target="_blank" className="text-xs text-primary hover:underline">Download</a></div>
                                    </div>
                                )}
                                {m.type === "audio" && (
                                    <div className="flex items-center gap-2 bg-muted p-2 rounded-full border w-fit pr-4 my-1">
                                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-primary text-primary-foreground"><Play className="h-4 w-4 ml-0.5" /></Button>
                                        <div className="h-1 bg-border w-32 rounded-full overflow-hidden"><div className="h-full bg-primary w-1/2" /></div>
                                        <span className="text-xs font-mono">Audio</span>
                                        <audio src={m.audioUrl} controls className="hidden" />
                                    </div>
                                )}
                                {m.type === "poll" && m.pollData && (
                                    <div className="bg-card border rounded-lg p-4 max-w-sm my-1 shadow-sm">
                                        <p className="font-bold mb-3 flex items-center gap-2"><BarChart2 className="h-4 w-4 text-primary" /> {m.pollData.question}</p>
                                        <div className="space-y-2">
                                            {m.pollData.options.map((opt) => {
                                                const totalVotes = m.pollData?.options.reduce((acc, o) => acc + o.votes.length, 0) || 1;
                                                const percent = Math.round((opt.votes.length / totalVotes) * 100);
                                                const hasVoted = opt.votes.includes(user!.uid);
                                                return (
                                                    <div key={opt.id} onClick={() => votePoll(m.id, opt.id, opt.votes)} className="cursor-pointer group/poll">
                                                        <div className="flex justify-between text-xs mb-1 font-medium"><span>{opt.text}</span><span>{opt.votes.length} ({percent}%)</span></div>
                                                        <div className="h-8 relative bg-muted rounded-md overflow-hidden border">
                                                            <div className={cn("h-full transition-all duration-500", hasVoted ? "bg-primary" : "bg-primary/20 group-hover/poll:bg-primary/30")} style={{ width: `${percent}%` }} />
                                                            {hasVoted && <Check className="absolute right-2 top-2 h-4 w-4 text-primary-foreground" />}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                                {m.text && <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>}
                                <div className="absolute -top-3 right-0 bg-background border shadow-sm rounded-md flex p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                   <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyingTo(m)} title="Reply"><Reply className="h-3 w-3" /></Button>
                                   <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => togglePin(m)} title="Pin"><Pin className={cn("h-3 w-3", m.pinned && "fill-current")} /></Button>
                                   {isMe && <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteDoc(doc(db, "chats", activeChat.id, "messages", m.id))}><Trash2 className="h-3 w-3" /></Button>}
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>
                 );
              })}
              <div ref={bottomRef} />
           </div>
        </ScrollArea>

        <div className="p-4 bg-background border-t">
           <div className="max-w-4xl mx-auto space-y-2">
              {replyingTo && (
                 <div className="flex items-center justify-between bg-muted/40 p-2 rounded-lg border border-l-4 border-l-primary animate-in slide-in-from-bottom-2">
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
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setPollDialogOpen(true)}><BarChart2 className="h-4 w-4 mr-2"/> Create Poll</DropdownMenuItem>
                    </DropdownMenuContent>
                 </DropdownMenu>
                 <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileSelect} />
                 <Textarea
                    value={text}
                    onChange={(e) => { setText(e.target.value); if(!typingTimeoutRef.current) updateDoc(doc(db,"chats",activeChat.id),{[`typing.${user?.uid}`]:true}); clearTimeout(typingTimeoutRef.current!); typingTimeoutRef.current=setTimeout(()=>updateDoc(doc(db,"chats",activeChat.id),{[`typing.${user?.uid}`]:false}),2000); }}
                    onKeyDown={(e) => { if(e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }}}
                    placeholder={`Message #${activeChat.name}`}
                    className="min-h-[24px] max-h-40 bg-transparent border-none shadow-none focus-visible:ring-0 resize-none py-2.5 px-2"
                    rows={1}
                 />
                 <div className="flex items-center gap-1 pb-1">
                    {isRecording ? (
                        <Button variant="destructive" size="icon" className="h-8 w-8 rounded-full animate-pulse" onClick={stopRecording}><StopCircle className="h-4 w-4" /></Button>
                    ) : (
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground" onClick={startRecording}><Mic className="h-5 w-5" /></Button>
                    )}
                    <Button onClick={() => handleSendMessage()} disabled={!text.trim() && !isUploading} size="icon" className="h-8 w-8 rounded-full">
                       {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 ml-0.5" />}
                    </Button>
                 </div>
              </div>
           </div>
        </div>
      </main>

      {/* --- Right Sidebar (Members) --- */}
      {membersOpen && (
        <aside className="hidden lg:flex w-64 border-l bg-muted/10 flex-col">
          <div className="h-14 p-4 border-b flex items-center font-semibold text-sm">
             <Users className="h-4 w-4 mr-2" /> Members <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded-full">{channelMembers.length}</span>
          </div>
          <ScrollArea className="flex-1 p-4">
             <div className="space-y-4">
                <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Online — {channelMembers.filter(u => u.status === 'online').length}</h4>
                    {channelMembers.filter(u => u.status === 'online').map(u => (
                        <div key={u.uid} className="flex items-center gap-3 mb-2 opacity-90 hover:opacity-100 cursor-pointer">
                            <div className="relative">
                                <UserAvatar name={u.name} photo={u.photoURL} uid={u.uid} className="h-8 w-8" />
                                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 border-2 border-background rounded-full"></span>
                            </div>
                            <p className="text-sm font-medium truncate">{u.name}</p>
                        </div>
                    ))}
                </div>
                <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Offline — {channelMembers.filter(u => u.status === 'offline').length}</h4>
                    {channelMembers.filter(u => u.status === 'offline').map(u => (
                        <div key={u.uid} className="flex items-center gap-3 mb-2 opacity-50 hover:opacity-100 cursor-pointer">
                            <UserAvatar name={u.name} photo={u.photoURL} uid={u.uid} className="h-8 w-8" />
                            <p className="text-sm font-medium truncate">{u.name}</p>
                        </div>
                    ))}
                </div>
             </div>
          </ScrollArea>
        </aside>
      )}

      {/* --- Poll Dialog --- */}
      <Dialog open={pollDialogOpen} onOpenChange={setPollDialogOpen}>
        <DialogContent>
            <DialogHeader><DialogTitle>Create a Poll</DialogTitle></DialogHeader>
            <div className="space-y-3 py-4">
                <Input placeholder="Question (e.g., When should we study?)" value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} />
                {pollOptions.map((opt, i) => (
                    <Input key={i} placeholder={`Option ${i + 1}`} value={opt} onChange={e => { const newOpts = [...pollOptions]; newOpts[i] = e.target.value; setPollOptions(newOpts); }} />
                ))}
                <Button variant="outline" size="sm" onClick={() => setPollOptions([...pollOptions, ""])}>+ Add Option</Button>
            </div>
            <DialogFooter><Button onClick={createPoll}>Create Poll</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}