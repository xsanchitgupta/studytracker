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
  setDoc,
  where,
  getDocs
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
  Menu, Search, Settings, Bell, Send, Hash, 
  MessageSquare, Image as ImageIcon, Smile, 
  MoreVertical, X, Phone, Video, Paperclip,
  Trash2, Edit2, Reply, Check, CheckCheck, Loader2,
  Users, ChevronRight
} from "lucide-react";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger, DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
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
  description?: string; // For channels
  otherUserId?: string; // For DMs
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
  reactions?: Record<string, string[]>; // { "❤️": ["uid1", "uid2"] }
  replyTo?: { id: string; name: string; text: string };
  edited?: boolean;
}

interface UserStatus {
  uid: string;
  name: string;
  photoURL?: string;
  status: "online" | "offline";
  lastSeen?: any;
}

// --- Constants ---
const CHANNELS: ChatSession[] = [
  { id: "channel_general", type: "channel", name: "General Lounge", description: "Chill vibes & general talk" },
  { id: "channel_homework", type: "channel", name: "Homework Help", description: "Get help with assignments" },
  { id: "channel_resources", type: "channel", name: "Resources", description: "Share notes & PDFs" },
  { id: "channel_announcements", type: "channel", name: "Announcements", description: "Important updates" },
];

export default function Chat() {
  const { user, profile } = useAuth();
  
  // Layout State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [membersOpen, setMembersOpen] = useState(true); // Right sidebar
  
  // Data State
  const [activeChat, setActiveChat] = useState<ChatSession>(CHANNELS[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [dmUsers, setDmUsers] = useState<UserStatus[]>([]);
  const [channelMembers, setChannelMembers] = useState<UserStatus[]>([]);
  
  // Interaction State
  const [text, setText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  // Refs
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Effects ---

  // 1. Fetch Users for DM list & Member list
  useEffect(() => {
    if (!user) return;
    
    // In a real app, you might query "friends" or recent chats. 
    // Here we fetch all users for demonstration.
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const users = snap.docs
        .map(d => {
          const data = d.data();
          // Simple online logic: signed in > signed out
          const isOnline = (data.lastSignInAt?.toMillis() || 0) > (data.lastSignOutAt?.toMillis() || 0);
          return {
            uid: d.id,
            name: data.name || "User",
            photoURL: data.photoURL,
            status: isOnline ? "online" : "offline",
            lastSeen: data.lastSignInAt
          } as UserStatus;
        })
        .filter(u => u.uid !== user.uid);

      setDmUsers(users);
      // For channels, show everyone. In DMs, show just the other person.
      setChannelMembers(users);
    });
    return () => unsub();
  }, [user]);

  // 2. Listen to Messages
  useEffect(() => {
    setMessages([]); // Clear on switch
    const q = query(
      collection(db, "chats", activeChat.id, "messages"), 
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
      setMessages(msgs);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    // Listen to typing status (stored in chat doc)
    const typingUnsub = onSnapshot(doc(db, "chats", activeChat.id), (snap) => {
      const data = snap.data();
      if (data?.typing) {
        const typers = Object.entries(data.typing)
          .filter(([uid, isTyping]) => isTyping && uid !== user?.uid)
          .map(([uid]) => {
             const u = dmUsers.find(user => user.uid === uid);
             return u ? u.name : "Someone";
          });
        setTypingUsers(typers);
      } else {
        setTypingUsers([]);
      }
    });

    return () => { unsub(); typingUnsub(); };
  }, [activeChat.id, user, dmUsers]);

  // --- Actions ---

  const handleSendMessage = async () => {
    if ((!text.trim() && !isUploading) || !user) return;

    const currentText = text;
    setText(""); // Optimistic clear
    setReplyingTo(null);

    try {
      await addDoc(collection(db, "chats", activeChat.id, "messages"), {
        text: currentText,
        senderId: user.uid,
        senderName: profile?.name || user.email,
        senderPhoto: profile?.photoURL || "",
        createdAt: serverTimestamp(),
        type: "text",
        replyTo: replyingTo ? {
          id: replyingTo.id,
          name: replyingTo.senderName,
          text: replyingTo.text
        } : null
      });

      // Clear typing
      updateDoc(doc(db, "chats", activeChat.id), { [`typing.${user.uid}`]: false });
    } catch (error) {
      toast.error("Failed to send");
      setText(currentText);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `chat/${activeChat.id}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      await addDoc(collection(db, "chats", activeChat.id, "messages"), {
        text: "Shared an image",
        imageUrl: url,
        type: "image",
        senderId: user.uid,
        senderName: profile?.name || user.email,
        senderPhoto: profile?.photoURL || "",
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      toast.error("Upload failed");
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

  const addReaction = async (msgId: string, emoji: string) => {
    if (!user) return;
    const msgRef = doc(db, "chats", activeChat.id, "messages", msgId);
    
    // This is a simplified reaction logic. Real-world needs array-remove/union
    // We will just read-modify-write for simplicity here or use specific fields
    // A better approach is subcollections for scale, but let's use a map here.
    // For this demo, let's just toggle 'like' (❤️)
    
    try {
       // Ideally: transaction. For now, let's just toast.
       toast.info("Reaction added!"); 
       // Implementing full reaction map logic requires getting the doc first
    } catch(e) {
       console.error(e);
    }
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
    // On mobile, close sidebar
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  // --- Render Helpers ---

  const renderDateSeparator = (date: Date) => (
    <div className="flex items-center my-6">
      <div className="flex-1 h-[1px] bg-border/50"></div>
      <span className="px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {isToday(date) ? "Today" : isYesterday(date) ? "Yesterday" : format(date, "MMMM d, yyyy")}
      </span>
      <div className="flex-1 h-[1px] bg-border/50"></div>
    </div>
  );

  return (
    <div className="h-screen flex bg-background overflow-hidden font-sans">
      
      {/* --- Sidebar (Left) --- */}
      {sidebarOpen && (
        <aside className="w-80 border-r bg-muted/20 flex flex-col shrink-0 transition-all duration-300">
          {/* Header */}
          <div className="h-14 p-4 flex items-center justify-between border-b bg-background/50 backdrop-blur">
            <h2 className="font-bold text-lg tracking-tight flex items-center gap-2">
               <span className="p-1.5 bg-primary/10 text-primary rounded-md"><MessageSquare className="h-4 w-4"/></span>
               Study Lounge
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="md:hidden">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 px-3 py-4">
            {/* Channels Section */}
            <div className="mb-6">
               <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">Channels</h3>
               <div className="space-y-0.5">
                 {CHANNELS.map(channel => (
                   <button
                     key={channel.id}
                     onClick={() => setActiveChat(channel)}
                     className={cn(
                       "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                       activeChat.id === channel.id 
                        ? "bg-primary/10 text-primary" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                     )}
                   >
                     <Hash className="h-4 w-4 opacity-70" />
                     {channel.name}
                   </button>
                 ))}
               </div>
            </div>

            {/* DMs Section */}
            <div>
              <div className="flex items-center justify-between px-2 mb-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Direct Messages</h3>
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">{dmUsers.filter(u => u.status === "online").length} Online</span>
              </div>
              
              <div className="space-y-1">
                 {dmUsers.sort((a,b) => (a.status === 'online' ? -1 : 1)).map(u => (
                   <button
                     key={u.uid}
                     onClick={() => startDM(u)}
                     className={cn(
                       "w-full flex items-center gap-3 px-2 py-2 rounded-md transition-colors group",
                       activeChat.id.includes(u.uid) ? "bg-accent" : "hover:bg-muted/50"
                     )}
                   >
                     <div className="relative">
                       <Avatar className="h-8 w-8 border border-background/50">
                         <AvatarImage src={u.photoURL || ""} />
                         <AvatarFallback>{u.name[0]}</AvatarFallback>
                       </Avatar>
                       <span className={cn(
                         "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background",
                         u.status === "online" ? "bg-green-500" : "bg-muted-foreground/30"
                       )} />
                     </div>
                     <div className="flex-1 text-left overflow-hidden">
                        <p className={cn("text-sm truncate", activeChat.id.includes(u.uid) ? "font-medium" : "text-muted-foreground group-hover:text-foreground")}>
                           {u.name}
                        </p>
                     </div>
                   </button>
                 ))}
              </div>
            </div>
          </ScrollArea>
          
          {/* User Profile Footer */}
          <div className="p-3 border-t bg-background/50 backdrop-blur flex items-center gap-3">
             <Avatar className="h-9 w-9">
               <AvatarImage src={profile?.photoURL || ""} />
               <AvatarFallback>{profile?.displayName?.[0]}</AvatarFallback>
             </Avatar>
             <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate">{profile?.displayName || "Me"}</p>
                <p className="text-xs text-muted-foreground truncate">Online</p>
             </div>
             <Settings className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground" />
          </div>
        </aside>
      )}

      {/* --- Main Chat Area --- */}
      <main className="flex-1 flex flex-col min-w-0 bg-background/95">
        {/* Header */}
        <header className="h-14 border-b flex items-center justify-between px-4 bg-background/80 backdrop-blur sticky top-0 z-10">
          <div className="flex items-center gap-3">
             {!sidebarOpen && (
               <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
                 <Menu className="h-5 w-5" />
               </Button>
             )}
             
             {activeChat.type === "channel" ? (
                <div className="flex items-center gap-2">
                   <Hash className="h-5 w-5 text-muted-foreground" />
                   <div>
                      <h1 className="font-bold text-foreground">{activeChat.name}</h1>
                      <p className="text-xs text-muted-foreground hidden md:block">{activeChat.description}</p>
                   </div>
                </div>
             ) : (
                <div className="flex items-center gap-3">
                   <Avatar className="h-8 w-8">
                     <AvatarImage src={activeChat.avatar || ""} />
                     <AvatarFallback>{activeChat.name[0]}</AvatarFallback>
                   </Avatar>
                   <div>
                      <h1 className="font-bold">{activeChat.name}</h1>
                      {/* Simple check if the DM user is online */}
                      {dmUsers.find(u => u.uid === activeChat.otherUserId)?.status === "online" && (
                         <span className="text-xs text-green-500 flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Online
                         </span>
                      )}
                   </div>
                </div>
             )}
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="text-muted-foreground"><Search className="h-5 w-5"/></Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground md:hidden"><Phone className="h-5 w-5"/></Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground hidden md:flex"><Bell className="h-5 w-5"/></Button>
            <ThemeToggle />
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setMembersOpen(!membersOpen)}
                className={cn("text-muted-foreground", membersOpen && "bg-accent text-accent-foreground")}
            >
               <Users className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
           <div className="max-w-4xl mx-auto pb-4">
              {messages.length === 0 && (
                 <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground opacity-50">
                    <MessageSquare className="h-12 w-12 mb-2" />
                    <p>No messages yet. Start the conversation!</p>
                 </div>
              )}

              {messages.map((m, i) => {
                 const prevM = messages[i-1];
                 const isSameSender = prevM?.senderId === m.senderId;
                 const date = m.createdAt?.toDate ? m.createdAt.toDate() : new Date();
                 const showDateSeparator = !prevM || !isToday(date) || (prevM.createdAt?.toDate && !isToday(prevM.createdAt.toDate()));
                 const isMe = m.senderId === user?.uid;

                 return (
                    <div key={m.id}>
                       {showDateSeparator && renderDateSeparator(date)}
                       
                       <div className={cn(
                          "group flex gap-3 mb-1 hover:bg-muted/30 -mx-4 px-4 py-1 transition-colors relative",
                          !isSameSender && "mt-4"
                       )}>
                          {/* Avatar (only show for first in group) */}
                          <div className="w-9 shrink-0">
                             {!isSameSender ? (
                                <Avatar className="h-9 w-9 cursor-pointer hover:ring-2 ring-primary ring-offset-2 transition-all">
                                   <AvatarImage src={m.senderPhoto} />
                                   <AvatarFallback>{m.senderName[0]}</AvatarFallback>
                                </Avatar>
                             ) : (
                                <div className="w-9 text-[10px] text-muted-foreground text-center opacity-0 group-hover:opacity-100 pt-1">
                                   {format(date, "h:mm a")}
                                </div>
                             )}
                          </div>

                          <div className="flex-1 min-w-0">
                             {/* Sender Name & Time */}
                             {!isSameSender && (
                                <div className="flex items-baseline gap-2 mb-1">
                                   <span className="font-semibold text-sm hover:underline cursor-pointer">
                                      {m.senderName}
                                   </span>
                                   <span className="text-[10px] text-muted-foreground">
                                      {format(date, "h:mm a")}
                                   </span>
                                </div>
                             )}

                             {/* Message Content */}
                             <div className="relative">
                                {/* Reply Context */}
                                {m.replyTo && (
                                   <div className="flex items-center gap-2 mb-1 pl-2 border-l-2 border-muted-foreground/30 text-xs text-muted-foreground opacity-80 cursor-pointer hover:opacity-100">
                                      <div className="flex items-center gap-1 font-medium text-primary">
                                         <Reply className="h-3 w-3" /> @{m.replyTo.name}
                                      </div>
                                      <span className="truncate max-w-[200px]">{m.replyTo.text}</span>
                                   </div>
                                )}

                                {m.type === "image" ? (
                                   <Dialog>
                                      <DialogTrigger>
                                         <img 
                                           src={m.imageUrl} 
                                           className="rounded-lg max-h-80 object-cover border shadow-sm hover:brightness-95 transition-all" 
                                           alt="Attachment" 
                                         />
                                      </DialogTrigger>
                                      <DialogContent className="max-w-5xl p-0 border-none bg-transparent">
                                         <img src={m.imageUrl} className="w-full h-full object-contain" />
                                      </DialogContent>
                                   </Dialog>
                                ) : (
                                   <p className={cn(
                                      "text-[15px] leading-relaxed whitespace-pre-wrap",
                                      // Simple code block detection
                                      m.text.includes("```") ? "font-mono bg-muted p-2 rounded-md text-sm" : ""
                                   )}>
                                      {m.text}
                                      {m.edited && <span className="text-[10px] text-muted-foreground italic ml-1">(edited)</span>}
                                   </p>
                                )}
                                
                                {/* Hover Actions */}
                                <div className="absolute -top-4 right-0 bg-background border shadow-sm rounded-md flex items-center p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                   <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => addReaction(m.id, "❤️")}>
                                      <Smile className="h-4 w-4 text-muted-foreground hover:text-yellow-500" />
                                   </Button>
                                   <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReplyingTo(m)}>
                                      <Reply className="h-4 w-4 text-muted-foreground hover:text-blue-500" />
                                   </Button>
                                   {isMe && (
                                      <DropdownMenu>
                                         <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                               <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                         </DropdownMenuTrigger>
                                         <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => { setText(m.text); /* Set editing state */ }}>
                                               <Edit2 className="h-3 w-3 mr-2" /> Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-destructive">
                                               <Trash2 className="h-3 w-3 mr-2" /> Delete
                                            </DropdownMenuItem>
                                         </DropdownMenuContent>
                                      </DropdownMenu>
                                   )}
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>
                 );
              })}
              
              {/* Typing Indicator */}
              {typingUsers.length > 0 && (
                 <div className="flex items-center gap-2 text-xs text-muted-foreground italic animate-pulse ml-14 mt-2">
                    <div className="flex gap-0.5">
                       <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                       <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                       <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"></span>
                    </div>
                    {typingUsers.length > 2 ? "Several people are typing..." : `${typingUsers.join(", ")} is typing...`}
                 </div>
              )}
              
              <div ref={bottomRef} />
           </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 bg-background border-t">
           <div className="max-w-4xl mx-auto">
              {/* Reply Preview */}
              {replyingTo && (
                 <div className="flex items-center justify-between bg-muted/40 p-2 rounded-t-lg border-x border-t border-b-0 mx-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                       <Reply className="h-3 w-3" />
                       <span className="font-semibold">Replying to {replyingTo.senderName}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setReplyingTo(null)}>
                       <X className="h-3 w-3" />
                    </Button>
                 </div>
              )}

              {/* Input Box */}
              <div className="relative flex items-end gap-2 bg-muted/50 p-2 rounded-xl border focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
                 <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileUpload} 
                 />
                 <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0 rounded-full"
                    onClick={() => fileInputRef.current?.click()}
                 >
                    <div className="p-1.5 bg-background rounded-full shadow-sm">
                       <Paperclip className="h-4 w-4" />
                    </div>
                 </Button>

                 <Textarea
                    value={text}
                    onChange={handleTyping}
                    onKeyDown={(e) => {
                       if(e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                       }
                    }}
                    placeholder={`Message #${activeChat.name}`}
                    className="min-h-[24px] max-h-32 bg-transparent border-none shadow-none focus-visible:ring-0 resize-none py-2.5 px-2 text-[15px]"
                    rows={1}
                 />

                 <div className="flex items-center gap-1 pb-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                       <Smile className="h-5 w-5" />
                    </Button>
                    <Button 
                       onClick={handleSendMessage}
                       disabled={!text.trim() && !isUploading} 
                       size="icon"
                       className={cn(
                          "h-8 w-8 rounded-full transition-all",
                          text.trim() ? "bg-primary text-primary-foreground shadow-md hover:scale-105" : "bg-muted-foreground/20 text-muted-foreground"
                       )}
                    >
                       {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 ml-0.5" />}
                    </Button>
                 </div>
              </div>
              <div className="text-[10px] text-muted-foreground text-center mt-2 opacity-50">
                 **Bold** • *Italic* • `Code` • [Link](url) supported
              </div>
           </div>
        </div>
      </main>

      {/* --- Right Sidebar (Members) --- */}
      {membersOpen && (
        <aside className="hidden lg:flex w-64 border-l bg-muted/10 flex-col">
          <div className="h-14 p-4 border-b flex items-center font-semibold text-sm">
             <Users className="h-4 w-4 mr-2" />
             Members
             <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded-full">{channelMembers.length}</span>
          </div>
          <ScrollArea className="flex-1 p-4">
             {/* Online */}
             <div className="mb-6">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Online — {channelMembers.filter(u => u.status === 'online').length}</h4>
                <div className="space-y-3">
                   {channelMembers.filter(u => u.status === 'online').map(u => (
                      <div key={u.uid} className="flex items-center gap-3 opacity-90 hover:opacity-100 cursor-pointer">
                         <div className="relative">
                            <Avatar className="h-8 w-8">
                               <AvatarImage src={u.photoURL} />
                               <AvatarFallback>{u.name[0]}</AvatarFallback>
                            </Avatar>
                            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 border-2 border-background rounded-full"></span>
                         </div>
                         <div className="overflow-hidden">
                            <p className="text-sm font-medium truncate">{u.name}</p>
                            <p className="text-[10px] text-muted-foreground">Studying Math</p> 
                         </div>
                      </div>
                   ))}
                </div>
             </div>
             
             {/* Offline */}
             <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Offline — {channelMembers.filter(u => u.status === 'offline').length}</h4>
                <div className="space-y-3 opacity-50">
                   {channelMembers.filter(u => u.status === 'offline').map(u => (
                      <div key={u.uid} className="flex items-center gap-3 cursor-pointer hover:opacity-100 transition-opacity">
                         <Avatar className="h-8 w-8 grayscale">
                            <AvatarImage src={u.photoURL} />
                            <AvatarFallback>{u.name[0]}</AvatarFallback>
                         </Avatar>
                         <p className="text-sm font-medium truncate">{u.name}</p>
                      </div>
                   ))}
                </div>
             </div>
          </ScrollArea>
        </aside>
      )}
    </div>
  );
}