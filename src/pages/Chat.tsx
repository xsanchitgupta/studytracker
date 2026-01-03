import { useEffect, useRef, useState, useMemo, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  collection, addDoc, onSnapshot, orderBy, query, serverTimestamp, 
  doc, updateDoc, deleteDoc, setDoc, limit, where, getDocs
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, Hash, Send, X, Paperclip, Trash2, 
  Edit2, Reply, ChevronLeft, ArrowDown, Loader2, Users, 
  LogOut, Menu, Smile, Pin, Copy, Forward, Mail, Calendar,
  PanelLeftClose, PanelLeftOpen, Maximize2, Check, CheckCheck,
  AtSign, Command, Filter
} from "lucide-react";
import { 
  Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle 
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { format, isToday, isYesterday } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

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
  pinned?: boolean;
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
  reactions?: Record<string, string[]>; 
  pinned?: boolean;
}

interface UserStatus {
  uid: string;
  name: string;
  email?: string;
  photoURL?: string;
  status: "online" | "offline";
  colorClass: string;
  joinedAt?: any;
}

// --- Utilities ---
const getAvatarColor = (id?: string) => {
  if (!id) return "bg-gray-500";
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

const formatName = (user: { displayName?: string | null, email?: string | null }) => {
  if (user?.email) {
    const namePart = user.email.split('@')[0];
    return namePart
      .replace(/[._]/g, ' ')
      .split(' ')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }
  return user?.displayName || "Anonymous";
};

const COMMON_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🚀", "👀"];

const CHANNELS: ChatSession[] = [
  { id: "channel_general", type: "channel", name: "general", description: "General discussion", color: "text-blue-400" },
  { id: "channel_homework", type: "channel", name: "homework-help", description: "Solve problems together", color: "text-emerald-400" },
  { id: "channel_resources", type: "channel", name: "resources", description: "Notes, links & PDFs", color: "text-orange-400" },
  { id: "channel_announcements", type: "channel", name: "announcements", description: "Important updates", color: "text-purple-400" },
];

export default function Chat() {
  const { user, profile, logout } = useAuth(); 
  const navigate = useNavigate();

  // Layout State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);

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
  const [messageToForward, setMessageToForward] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<Map<string, Message>>(new Map());
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [pinnedChats, setPinnedChats] = useState<string[]>([]);
  const [pinnedMessagesOpen, setPinnedMessagesOpen] = useState(false);
  const { theme } = useTheme();

  // Refs
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  // 1. Fetch Users
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const userMap = new Map<string, UserStatus>();
      snap.docs.forEach(d => {
        const data = d.data();
        const isOnline = (data.lastSignInAt?.toMillis() || 0) > (data.lastSignOutAt?.toMillis() || 0);
        userMap.set(d.id, {
          uid: d.id,
          name: data.name || formatName({ email: data.email }),
          email: data.email,
          photoURL: data.photoURL,
          status: isOnline ? "online" : "offline",
          colorClass: getAvatarColor(d.id),
          joinedAt: data.createdAt
        });
      });
      setUsers(Array.from(userMap.values()));
    });
    return () => unsub();
  }, [user]);

  // 2. Message Listener (Separated for performance)
  useEffect(() => {
    if (!activeChat?.id) return;
    setLoadingMessages(true);
    setMessages([]); 
    setOptimisticMessages(new Map());

    const q = query(
      collection(db, "chats", activeChat.id, "messages"), 
      orderBy("createdAt", "asc"),
      limit(150)
    );

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
      setMessages(msgs);
      setLoadingMessages(false);
      
      if (snap.metadata.hasPendingWrites || msgs.length > 0) {
         setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
      }
    }, (error) => {
      console.error("Message listener error:", error);
      setLoadingMessages(false);
    });

    return () => unsub();
  }, [activeChat.id]);

  // Merge optimistic messages with real messages
  const displayMessages = useMemo(() => {
    const merged = [...messages];
    optimisticMessages.forEach((optMsg) => {
      if (!messages.find(m => m.id === optMsg.id)) {
        merged.push(optMsg);
      }
    });
    return merged.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?.toDate?.()?.getTime() || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?.toDate?.()?.getTime() || 0;
      return aTime - bTime;
    });
  }, [messages, optimisticMessages]);

  // Fetch pinned messages
  useEffect(() => {
    if (!activeChat?.id) return;
    const q = query(
      collection(db, "chats", activeChat.id, "messages"),
      where("pinned", "==", true),
      orderBy("createdAt", "desc"),
      limit(10)
    );
    const unsub = onSnapshot(q, (snap) => {
      setPinnedMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
    });
    return () => unsub();
  }, [activeChat.id]);

  // Load pinned chats from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`pinnedChats_${user?.uid}`);
    if (stored) {
      try {
        setPinnedChats(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load pinned chats", e);
      }
    }
  }, [user?.uid]);

  // Save pinned chats to localStorage
  useEffect(() => {
    if (user?.uid) {
      localStorage.setItem(`pinnedChats_${user?.uid}`, JSON.stringify(pinnedChats));
    }
  }, [pinnedChats, user?.uid]);

  // 3. Typing Listener (Separated to reduce re-renders)
  useEffect(() => {
    if (!activeChat?.id || !user) return;
    
    const typingUnsub = onSnapshot(doc(db, "chats", activeChat.id), (snap) => {
      const data = snap.data();
      if (data?.typing) {
        const typers = Object.entries(data.typing)
          .filter(([uid, isTyping]) => isTyping && uid !== user.uid)
          .map(([uid]) => {
             const u = users.find(usr => usr.uid === uid);
             return u ? u.name.split(' ')[0] : "Someone";
          });
        setTypingUsers(typers);
      } else {
        setTypingUsers([]);
      }
    }, (error) => {
      console.error("Typing listener error:", error);
    });

    return () => typingUnsub();
  }, [activeChat.id, user?.uid, users]);

  // --- Actions ---

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/auth");
    } catch (error) {
      toast.error("Failed to logout");
    }
  };

  const handleSendMessage = useCallback(async () => {
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
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    
    // Optimistic update
    const optimisticMsg: Message = {
      id: tempId,
      text: currentText,
      senderId: user.uid,
      senderName: formatName(user),
      senderPhoto: profile?.photoURL || "",
      createdAt: { toMillis: () => Date.now(), toDate: () => new Date() } as any,
      type: imageFile ? "image" : "text",
      reactions: {},
      pinned: false,
      replyTo: currentReply ? {
        id: currentReply.id,
        name: currentReply.senderName,
        text: currentReply.text
      } : undefined
    };
    
    setOptimisticMessages(prev => new Map(prev).set(tempId, optimisticMsg));
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
        reactions: {},
        pinned: false,
        replyTo: currentReply ? {
          id: currentReply.id,
          name: currentReply.senderName,
          text: currentReply.text
        } : null
      });
      
      // Remove optimistic message once real one is added
      setTimeout(() => {
        setOptimisticMessages(prev => {
          const next = new Map(prev);
          next.delete(tempId);
          return next;
        });
      }, 1000);
      
      updateDoc(doc(db, "chats", activeChat.id), { [`typing.${user.uid}`]: false });
    } catch (error) {
      toast.error("Failed to send message");
      setText(currentText);
      setOptimisticMessages(prev => {
        const next = new Map(prev);
        next.delete(tempId);
        return next;
      });
    } finally {
      setIsUploading(false);
    }
  }, [text, imageFile, user, activeChat.id, replyingTo, editingMessage, profile]);

  const handleReaction = async (message: Message, emoji: string) => {
    if (!user) return;
    const ref = doc(db, "chats", activeChat.id, "messages", message.id);
    const currentReactions = message.reactions || {};
    const usersReacted = currentReactions[emoji] || [];

    let newReactions = { ...currentReactions };
    
    if (usersReacted.includes(user.uid)) {
      const newUsers = usersReacted.filter(id => id !== user.uid);
      if (newUsers.length === 0) {
        delete newReactions[emoji];
      } else {
        newReactions[emoji] = newUsers;
      }
    } else {
      newReactions[emoji] = [...usersReacted, user.uid];
    }

    await updateDoc(ref, { reactions: newReactions });
  };

  const handlePin = async (message: Message) => {
    await updateDoc(doc(db, "chats", activeChat.id, "messages", message.id), {
      pinned: !message.pinned
    });
    toast.success(message.pinned ? "Message unpinned" : "Message pinned");
  };

  const togglePinChat = useCallback((chatId: string) => {
    setPinnedChats(prev => {
      const newPinned = prev.includes(chatId)
        ? prev.filter(id => id !== chatId)
        : [...prev, chatId];
      return newPinned;
    });
  }, []);

  const scrollToPinnedMessage = useCallback((messageId: string) => {
    const element = document.querySelector(`[data-message-id="${messageId}"]`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("ring-2", "ring-amber-500", "ring-offset-2");
      setTimeout(() => {
        element.classList.remove("ring-2", "ring-amber-500", "ring-offset-2");
      }, 2000);
    }
    setPinnedMessagesOpen(false);
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const initiateForward = (message: Message) => {
    setMessageToForward(message);
    setForwardDialogOpen(true);
  };

  const confirmForward = async (targetChat: ChatSession | UserStatus) => {
    if (!messageToForward || !user) return;
    
    let targetId = "";
    if ("type" in targetChat) {
      targetId = targetChat.id;
    } else {
      targetId = [user.uid, targetChat.uid].sort().join("_");
    }

    try {
      await addDoc(collection(db, "chats", targetId, "messages"), {
        text: messageToForward.text,
        imageUrl: messageToForward.imageUrl || "",
        type: messageToForward.type,
        senderId: user.uid,
        senderName: formatName(user),
        senderPhoto: profile?.photoURL || "",
        createdAt: serverTimestamp(),
        reactions: {},
        pinned: false,
        replyTo: null 
      });
      toast.success("Message forwarded");
      setForwardDialogOpen(false);
      setMessageToForward(null);
    } catch (e) {
      toast.error("Failed to forward");
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    
    // Handle @ mentions on text change
    handleMention(e);
    
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

  const startDM = useCallback((targetUser: UserStatus) => {
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
  }, [user]);

  // Search functionality
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return displayMessages;
    const query = searchQuery.toLowerCase();
    return displayMessages.filter(m => 
      m.text.toLowerCase().includes(query) || 
      m.senderName.toLowerCase().includes(query)
    );
  }, [displayMessages, searchQuery]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K for search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      // Escape to close search
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
        setSearchQuery("");
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

  // Handle @ mentions
  const handleMention = useCallback((e: React.ChangeEvent<HTMLTextAreaElement> | React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const cursorPos = textarea.selectionStart;
    const currentText = 'value' in e ? (e.value as string) : text;
    const textBefore = currentText.substring(0, cursorPos);
    const lastAt = textBefore.lastIndexOf('@');
    const lastSpace = textBefore.lastIndexOf(' ', lastAt);
    
    if (lastAt > lastSpace || (lastAt === 0 && textBefore.length === 1)) {
      const rect = textarea.getBoundingClientRect();
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      setMentionPosition({
        top: rect.top + scrollTop - 220,
        left: rect.left + 10
      });
      const query = textBefore.substring(lastAt + 1);
      setMentionQuery(query);
      setMentionOpen(true);
    } else if (lastAt === -1 || (lastSpace > lastAt && lastSpace !== -1)) {
      setMentionOpen(false);
    } else if (lastAt > lastSpace) {
      const query = textBefore.substring(lastAt + 1);
      setMentionQuery(query);
      setMentionOpen(true);
    }
  }, [text]);

  const insertMention = useCallback((userName: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const textBefore = text.substring(0, cursorPos);
    const lastAt = textBefore.lastIndexOf('@');
    const textAfter = text.substring(cursorPos);
    
    const newText = text.substring(0, lastAt) + `@${userName} ` + textAfter;
    setText(newText);
    setMentionOpen(false);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(lastAt + userName.length + 2, lastAt + userName.length + 2);
    }, 0);
  }, [text]);

  const filteredUsersForMention = useMemo(() => {
    if (!mentionQuery) return users.filter(u => u.uid !== user?.uid).slice(0, 5);
    const query = mentionQuery.toLowerCase();
    return users
      .filter(u => u.uid !== user?.uid && u.name.toLowerCase().includes(query))
      .slice(0, 5);
  }, [users, mentionQuery, user?.uid]);

  // --- Components ---

  const renderDateSeparator = (date: Date) => (
    <div className="flex items-center justify-center my-8 relative animate-in fade-in duration-500">
      <div className="absolute inset-0 flex items-center">
        <span className={cn("w-full border-t", theme === "dark" ? "border-white/10" : "border-border")} />
      </div>
      <span className={cn("relative flex justify-center text-xs font-bold uppercase backdrop-blur-md px-4 py-1.5 rounded-full border shadow-sm", 
        theme === "dark" 
          ? "text-muted-foreground/80 bg-black/20 border-white/5" 
          : "text-muted-foreground bg-background/80 border-border"
      )}>
        {isToday(date) ? "Today" : isYesterday(date) ? "Yesterday" : format(date, "MMMM d, yyyy")}
      </span>
    </div>
  );

  const ProfileCard = memo(({ u }: { u: UserStatus }) => {
    ProfileCard.displayName = 'ProfileCard';
    const handleStartDM = useCallback(() => {
      startDM(u);
    }, [u]);
    
    return (
      <div className={cn("flex flex-col gap-4 p-4 w-72 backdrop-blur-2xl rounded-xl shadow-2xl border", 
        theme === "dark" 
          ? "bg-black/40 border-white/10" 
          : "bg-background/95 border-border"
      )}>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="h-16 w-16 border-2 border-primary/20 shadow-glow-primary">
               <AvatarImage src={u.photoURL || ""} />
               <AvatarFallback className={cn("text-xl font-bold", u.colorClass, theme === "dark" ? "text-white" : "text-white")}>{u.name?.[0] || "?"}</AvatarFallback>
            </Avatar>
            <span className={cn("absolute bottom-1 right-1 h-4 w-4 rounded-full border-2", 
              theme === "dark" ? "border-background" : "border-background",
              u.status === 'online' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-gray-500"
            )} />
          </div>
          <div className="flex flex-col min-w-0">
            <h4 className={cn("font-bold text-lg leading-tight truncate", theme === "dark" ? "text-white" : "text-foreground")}>{u.name || "Unknown User"}</h4>
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full w-fit mt-1", 
              u.status === 'online' ? "bg-emerald-500/10 text-emerald-400" : "bg-gray-500/10 text-gray-400"
            )}>
               {u.status === 'online' ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
        
        <div className={cn("space-y-3 text-sm text-muted-foreground p-3 rounded-lg border", 
          theme === "dark" ? "bg-white/5 border-white/5" : "bg-muted/50 border-border"
        )}>
           {u.email && (
             <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-primary" />
                <span className="truncate">{u.email}</span>
             </div>
           )}
           <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-primary" />
              <span>Joined {u.joinedAt?.toDate ? format(u.joinedAt.toDate(), "MMM yyyy") : "Recently"}</span>
           </div>
        </div>

        {u.uid !== user?.uid && (
          <Button onClick={handleStartDM} className="w-full gap-2 mt-2 font-semibold shadow-lg hover:shadow-primary/20 transition-all bg-primary hover:bg-primary/90 text-primary-foreground">
             <Send className="h-4 w-4" /> Send Message
          </Button>
        )}
      </div>
    );
  });

  const SidebarContent = ({ collapsed = false }: { collapsed?: boolean }) => (
    <div className={cn("flex flex-col h-full backdrop-blur-2xl border-r transition-all duration-300",
      theme === "dark" ? "bg-background/20 border-white/5" : "bg-background/60 border-border"
    )}>
      <div className={cn("h-16 flex items-center border-b", 
        theme === "dark" ? "border-white/5 bg-white/5" : "border-border bg-muted/30",
        collapsed ? "justify-center px-0" : "justify-between px-4"
      )}>
         {!collapsed && (
           <Button variant="ghost" size="sm" className="gap-2 font-semibold text-muted-foreground hover:text-primary -ml-2" onClick={() => navigate('/dashboard')}>
             <ChevronLeft className="h-4 w-4" /> Dashboard
           </Button>
         )}
         <div className="flex items-center gap-2">
            {!collapsed && <ThemeToggle />}
            <Button variant="ghost" size="icon" className="hidden md:flex text-muted-foreground hover:text-foreground" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
               {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </Button>
         </div>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
          {/* Channels */}
          <div className="mb-8">
             {!collapsed && <h3 className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-3 px-2">Lounge</h3>}
             <div className="space-y-1">
               {CHANNELS.map(channel => (
                 <TooltipProvider key={channel.id} delayDuration={0}>
                   <Tooltip>
                     <TooltipTrigger asChild>
                       <button
                         onClick={() => { setActiveChat(channel); setMobileMenuOpen(false); }}
                         className={cn(
                           "w-full flex items-center rounded-xl transition-all duration-300 group hover:bg-white/5 relative overflow-hidden",
                           collapsed ? "justify-center p-2" : "gap-3 px-3 py-2.5",
                           activeChat.id === channel.id ? "bg-primary/10 text-primary shadow-[inset_0_0_15px_rgba(var(--primary),0.1)] border border-primary/20" : "text-muted-foreground"
                         )}
                       >
                         <div className={cn("p-1.5 rounded-lg transition-colors shrink-0", activeChat.id === channel.id ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground group-hover:bg-white/10")}>
                            <Hash className="h-4 w-4" />
                         </div>
                         {!collapsed && <span className="truncate text-sm font-medium">{channel.name}</span>}
                         {activeChat.id === channel.id && !collapsed && <div className="absolute right-0 top-0 bottom-0 w-1 bg-primary shadow-[0_0_10px_var(--primary)]" />}
                       </button>
                     </TooltipTrigger>
                     {collapsed && <TooltipContent side="right"><p>{channel.name}</p></TooltipContent>}
                   </Tooltip>
                 </TooltipProvider>
               ))}
             </div>
          </div>

          {/* Pinned DMs */}
          {!collapsed && pinnedChats.length > 0 && (
            <div className="mb-6">
              <h3 className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-3 px-2 flex items-center gap-2">
                <Pin className="h-3 w-3" /> Pinned
              </h3>
              <div className="space-y-1">
                {users.filter(u => u.uid !== user?.uid && pinnedChats.includes(u.uid)).map(u => (
                  <TooltipProvider key={u.uid} delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="relative group">
                          <button
                            className={cn(
                              "w-full flex items-center rounded-xl transition-all duration-300 hover:bg-white/5",
                              collapsed ? "justify-center p-2" : "gap-3 px-3 py-2.5 text-left",
                              activeChat.id.includes(u.uid) ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground"
                            )}
                            onClick={() => startDM(u)}
                          >
                            <div className="relative shrink-0">
                              <Avatar className={cn("transition-all ring-2 ring-transparent group-hover:ring-white/10", collapsed ? "h-8 w-8" : "h-9 w-9")}>
                                <AvatarImage src={u.photoURL || ""} />
                                <AvatarFallback className={cn("text-[10px] text-white font-bold", u.colorClass)}>{u.name[0]}</AvatarFallback>
                              </Avatar>
                              <span className={cn(
                                "absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-background",
                                collapsed ? "h-2.5 w-2.5" : "h-3 w-3",
                                u.status === "online" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-gray-500"
                              )} />
                            </div>
                            {!collapsed && (
                              <div className="flex-1 overflow-hidden">
                                <span className="text-sm font-medium truncate block">{u.name}</span>
                                <span className="text-[10px] opacity-70 truncate block">{u.status === 'online' ? 'Online' : 'Offline'}</span>
                              </div>
                            )}
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); togglePinChat(u.uid); }}
                          >
                            <Pin className={cn("h-3 w-3", pinnedChats.includes(u.uid) ? "fill-amber-500 text-amber-500" : "")} />
                          </Button>
                        </div>
                      </TooltipTrigger>
                      {collapsed && <TooltipContent side="right"><p>{u.name}</p></TooltipContent>}
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            </div>
          )}

          {/* DMs */}
          <div>
            {!collapsed && <h3 className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-3 px-2">Direct Messages</h3>}
            <div className="space-y-1">
               {users.filter(u => u.uid !== user?.uid && !pinnedChats.includes(u.uid)).map(u => (
                 <TooltipProvider key={u.uid} delayDuration={0}>
                   <Tooltip>
                     <TooltipTrigger asChild>
                       <div className="relative group">
                         <button
                           className={cn(
                             "w-full flex items-center rounded-xl transition-all duration-300 hover:bg-white/5",
                             collapsed ? "justify-center p-2" : "gap-3 px-3 py-2.5 text-left",
                             activeChat.id.includes(u.uid) ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground"
                           )}
                           onClick={() => startDM(u)}
                         >
                         <div className="relative shrink-0">
                           <Avatar className={cn("transition-all ring-2 ring-transparent group-hover:ring-white/10", collapsed ? "h-8 w-8" : "h-9 w-9")}>
                             <AvatarImage src={u.photoURL || ""} />
                             <AvatarFallback className={cn("text-[10px] text-white font-bold", u.colorClass)}>{u.name[0]}</AvatarFallback>
                           </Avatar>
                           <span className={cn(
                             "absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-background",
                             collapsed ? "h-2.5 w-2.5" : "h-3 w-3",
                             u.status === "online" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-gray-500"
                           )} />
                         </div>
                         {!collapsed && (
                           <div className="flex-1 overflow-hidden">
                             <span className="text-sm font-medium truncate block">{u.name}</span>
                             <span className="text-[10px] opacity-70 truncate block">{u.status === 'online' ? 'Online' : 'Offline'}</span>
                           </div>
                         )}
                       </button>
                       <Button
                         variant="ghost"
                         size="icon"
                         className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                         onClick={(e) => { e.stopPropagation(); togglePinChat(u.uid); }}
                       >
                         <Pin className={cn("h-3 w-3", pinnedChats.includes(u.uid) ? "fill-amber-500 text-amber-500" : "")} />
                       </Button>
                       </div>
                     </TooltipTrigger>
                     {collapsed && <TooltipContent side="right"><p>{u.name}</p></TooltipContent>}
                   </Tooltip>
                 </TooltipProvider>
               ))}
            </div>
          </div>
      </ScrollArea>

      <div className={cn("border-t flex items-center", 
        theme === "dark" ? "bg-white/5 border-white/5" : "bg-muted/30 border-border",
        collapsed ? "flex-col p-2 gap-4" : "p-4 gap-3"
      )}>
          <Popover>
            <PopoverTrigger asChild>
              <Avatar className={cn("h-10 w-10 hover:opacity-80 transition-opacity cursor-pointer border shadow-lg", theme === "dark" ? "border-white/10" : "border-border")}>
                 <AvatarImage src={profile?.photoURL || ""} />
                 <AvatarFallback className="bg-primary text-primary-foreground text-xs">{formatName({email: user?.email})[0]}</AvatarFallback>
              </Avatar>
            </PopoverTrigger>
            <PopoverContent side="right" className="w-auto p-0 border-white/10 bg-transparent border-none" align="end">
                {user && profile && <ProfileCard u={{
                  uid: user.uid,
                  name: profile.name || formatName(user),
                  email: profile.email || user.email || undefined,
                  photoURL: profile.photoURL || user.photoURL || undefined,
                  status: "online",
                  colorClass: getAvatarColor(user.uid),
                  joinedAt: profile.createdAt
                }} />}
            </PopoverContent>
          </Popover>
          
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
               <div className={cn("text-sm font-bold truncate", theme === "dark" ? "text-white" : "text-foreground")}>{profile?.name || formatName({email: user?.email})}</div>
               <div className="text-[10px] text-emerald-500 font-medium flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.8)]" /> Online</div>
            </div>
          )}
          
          <Button variant="ghost" size="icon" className={cn("text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all rounded-full", collapsed ? "h-8 w-8" : "h-9 w-9")} onClick={handleLogout}>
             <LogOut className="h-4 w-4" />
          </Button>
      </div>
    </div>
  );

  return (
    <div className={cn("h-screen flex font-sans overflow-hidden",
      theme === "dark" 
        ? "bg-[#0a0a0c] bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/40 via-[#0a0a0c] to-[#0a0a0c]"
        : "bg-background"
    )}>
      <aside className={cn("hidden md:block shrink-0 transition-all duration-300 ease-in-out", sidebarCollapsed ? "w-20" : "w-72")}><SidebarContent collapsed={sidebarCollapsed} /></aside>
      
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
         <SheetContent side="left" className={cn("p-0 w-72 border-r", theme === "dark" ? "border-white/10" : "border-border")}>
            <SheetHeader className="sr-only"><SheetTitle>Menu</SheetTitle></SheetHeader>
            <SidebarContent />
         </SheetContent>
      </Sheet>

      <main className="flex-1 flex flex-col min-w-0 bg-transparent relative">
        {/* Header */}
        <header className={cn("h-16 px-6 flex items-center justify-between border-b backdrop-blur-xl z-10 shadow-lg",
          theme === "dark" ? "border-white/5 bg-background/30" : "border-border bg-background/80"
        )}>
          <div className="flex items-center gap-4 flex-1 min-w-0">
             <Button variant="ghost" size="icon" className="md:hidden -ml-2 hover:bg-white/5" onClick={() => setMobileMenuOpen(true)}><Menu className="h-5 w-5" /></Button>
             <div className="flex items-center gap-3 min-w-0">
                {activeChat.type === 'channel' ? 
                  <div className="p-2 bg-primary/20 rounded-xl shadow-glow-primary shrink-0"><Hash className="h-5 w-5 text-primary" /></div> : 
                  <Avatar className={cn("h-10 w-10 border shadow-lg shrink-0", theme === "dark" ? "border-white/10" : "border-border")}>
                    <AvatarImage src={activeChat.avatar} />
                    <AvatarFallback className={cn("font-bold text-white", activeChat.otherUserId ? getAvatarColor(activeChat.otherUserId) : "bg-gray-500")}>{activeChat.name[0]}</AvatarFallback>
                  </Avatar>
                }
                <div className="min-w-0">
                   <h1 className={cn("font-bold text-lg leading-tight tracking-tight truncate", theme === "dark" ? "text-white" : "text-foreground")}>{activeChat.name}</h1>
                   {activeChat.type === 'channel' && <p className="text-xs text-muted-foreground font-medium hidden md:block truncate">{activeChat.description}</p>}
                   {activeChat.type === 'dm' && (
                     <p className="text-xs text-muted-foreground font-medium hidden md:block">
                       {users.find(u => u.uid === activeChat.otherUserId)?.status === 'online' ? 'Online' : 'Offline'}
                     </p>
                   )}
                </div>
             </div>
          </div>
          <div className="flex items-center gap-2">
            {pinnedMessages.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn("text-muted-foreground transition-all rounded-full hover:bg-white/10 hover:text-primary", pinnedMessagesOpen && "text-primary bg-primary/10")} 
                      onClick={() => setPinnedMessagesOpen(!pinnedMessagesOpen)}
                    >
                      <Pin className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Pinned Messages ({pinnedMessages.length})</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn("text-muted-foreground transition-all rounded-full hover:bg-white/10 hover:text-primary", searchOpen && "text-primary bg-primary/10")} 
                    onClick={() => setSearchOpen(!searchOpen)}
                  >
                    <Search className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Search messages (⌘K)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button variant="ghost" size="icon" className={cn("text-muted-foreground transition-all rounded-full hover:bg-primary/10 hover:text-primary", membersOpen && "text-primary bg-primary/10 shadow-[0_0_15px_rgba(var(--primary),0.3)]")} onClick={() => setMembersOpen(!membersOpen)}>
              <Users className="h-5 w-5" />
            </Button>
          </div>
        </header>
        
        {/* Search Bar */}
        {searchOpen && (
          <div className={cn("px-6 py-3 border-b backdrop-blur-xl", theme === "dark" ? "border-white/5 bg-background/20" : "border-border bg-background/80")}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages... (Press Esc to close)"
                className={cn("pl-10 pr-4 focus:border-primary/40", theme === "dark" ? "bg-white/5 border-white/10" : "bg-background border-border")}
                autoFocus
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {searchQuery && (
              <div className="mt-2 text-xs text-muted-foreground">
                Found {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}

        {/* Chat Area */}
        <div className="flex-1 relative overflow-hidden flex flex-col">
           <ScrollArea className="flex-1" onScrollCapture={(e) => {
              const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
              setShowScrollButton(scrollHeight - scrollTop - clientHeight > 300);
           }}>
              <div className="flex flex-col justify-end min-h-full py-6 px-4 md:px-8 space-y-6">
                 {loadingMessages && (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                 )}
                 {displayMessages.length < 5 && !loadingMessages && !searchQuery && (
                    <div className="mb-12 mt-12 animate-in fade-in zoom-in-95 duration-700">
                       <div className="h-24 w-24 bg-gradient-to-br from-primary/30 to-purple-600/30 rounded-[2rem] flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(var(--primary),0.2)] backdrop-blur-md"><Hash className="h-12 w-12 text-primary" /></div>
                       <h1 className={cn("text-4xl md:text-5xl font-extrabold mb-4 tracking-tight drop-shadow-md", theme === "dark" ? "text-white" : "text-foreground")}>Welcome to #{activeChat.name}!</h1>
                       <p className="text-muted-foreground text-lg max-w-lg">This is the start of the <span className={cn("font-semibold", theme === "dark" ? "text-white" : "text-foreground")}>#{activeChat.name}</span> {activeChat.type === 'channel' ? 'channel' : 'conversation'}.</p>
                    </div>
                 )}
                 {searchQuery && filteredMessages.length === 0 && !loadingMessages && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground text-lg">No messages found for "{searchQuery}"</p>
                    </div>
                 )}
                 {(searchQuery ? filteredMessages : displayMessages).map((m, i) => {
                    const prevM = (searchQuery ? filteredMessages : displayMessages)[i-1];
                    const isSequence = prevM && prevM.senderId === m.senderId && (m.createdAt?.toMillis() - prevM.createdAt?.toMillis() < 300000);
                    const date = m.createdAt?.toDate ? m.createdAt.toDate() : new Date();
                    const showDateSeparator = !prevM || !isToday(date) || (prevM.createdAt?.toDate && !isToday(prevM.createdAt.toDate()));
                    const isMe = user?.uid === m.senderId;

                    return (
                       <div key={m.id} data-message-id={m.id} className={cn("group/msg relative animate-in fade-in slide-in-from-bottom-2 duration-300", 
                         m.pinned && (theme === "dark" ? "bg-amber-500/10 -mx-4 px-4 py-2 rounded-xl border border-amber-500/20" : "bg-amber-50 -mx-4 px-4 py-2 rounded-xl border border-amber-200")
                       )}>
                          {showDateSeparator && renderDateSeparator(date)}
                          <div className={cn(
                             "flex gap-4 -mx-4 px-4 py-1 rounded-lg transition-colors relative group-hover/msg:shadow-sm",
                             theme === "dark" ? "hover:bg-white/[0.03]" : "hover:bg-muted/50",
                             !isSequence ? "mt-6" : "mt-0.5",
                             editingMessage?.id === m.id && "bg-primary/10 ring-1 ring-primary/30"
                          )}>
                             {/* Hover Toolbar (Floating Glass) */}
                             <div className={cn("absolute right-4 -top-5 backdrop-blur-xl border shadow-2xl rounded-full flex items-center gap-0.5 p-1 opacity-0 group-hover/msg:opacity-100 transition-all duration-200 z-20 scale-95 group-hover/msg:scale-100",
                               theme === "dark" ? "bg-black/80 border-white/10" : "bg-background/95 border-border"
                             )}>
                                <Popover>
                                  <PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white/10"><Smile className={cn("h-4 w-4", theme === "dark" ? "text-gray-300" : "text-muted-foreground")} /></Button></PopoverTrigger>
                                  <PopoverContent className={cn("w-auto p-2 flex gap-1 rounded-full backdrop-blur-2xl", theme === "dark" ? "bg-black/90 border-white/10" : "bg-background border-border")} align="end" side="top">
                                    {COMMON_EMOJIS.map(emoji => (
                                      <button key={emoji} onClick={() => handleReaction(m, emoji)} className="p-2 hover:bg-white/10 rounded-full text-xl transition-transform hover:scale-125">{emoji}</button>
                                    ))}
                                  </PopoverContent>
                                </Popover>
                                <div className={cn("w-px h-4 mx-1", theme === "dark" ? "bg-white/10" : "bg-border")} />
                                <TooltipProvider delayDuration={0}>
                                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white/10" onClick={() => setReplyingTo(m)}><Reply className={cn("h-4 w-4", theme === "dark" ? "text-gray-300" : "text-muted-foreground")} /></Button></TooltipTrigger><TooltipContent>Reply</TooltipContent></Tooltip>
                                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white/10" onClick={() => initiateForward(m)}><Forward className={cn("h-4 w-4", theme === "dark" ? "text-gray-300" : "text-muted-foreground")} /></Button></TooltipTrigger><TooltipContent>Forward</TooltipContent></Tooltip>
                                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white/10" onClick={() => handleCopy(m.text)}><Copy className={cn("h-4 w-4", theme === "dark" ? "text-gray-300" : "text-muted-foreground")} /></Button></TooltipTrigger><TooltipContent>Copy Text</TooltipContent></Tooltip>
                                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white/10" onClick={() => handlePin(m)}><Pin className={cn("h-4 w-4", m.pinned ? "fill-yellow-500 text-yellow-500" : theme === "dark" ? "text-gray-300" : "text-muted-foreground")} /></Button></TooltipTrigger><TooltipContent>{m.pinned ? "Unpin" : "Pin"}</TooltipContent></Tooltip>
                                  {isMe && (
                                    <>
                                      <div className={cn("w-px h-4 mx-1", theme === "dark" ? "bg-white/10" : "bg-border")} />
                                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white/10" onClick={() => { setEditingMessage(m); setText(m.text); }}><Edit2 className={cn("h-3 w-3", theme === "dark" ? "text-gray-300" : "text-muted-foreground")} /></Button></TooltipTrigger><TooltipContent>Edit</TooltipContent></Tooltip>
                                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-red-500/20 hover:text-red-500" onClick={() => deleteDoc(doc(db, "chats", activeChat.id, "messages", m.id))}><Trash2 className="h-3 w-3" /></Button></TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip>
                                    </>
                                  )}
                                </TooltipProvider>
                             </div>

                             <div className="w-10 shrink-0 pt-1">
                                {!isSequence ? (
                                   <Popover>
                                     <PopoverTrigger asChild>
                                        <Avatar className="h-10 w-10 hover:scale-105 transition-transform duration-300 ring-2 ring-transparent hover:ring-white/20 cursor-pointer shadow-lg">
                                           <AvatarImage src={m.senderPhoto} />
                                           <AvatarFallback className={cn("text-white font-bold", getAvatarColor(m.senderId))}>{m.senderName[0]}</AvatarFallback>
                                        </Avatar>
                                     </PopoverTrigger>
                                     <PopoverContent className="w-auto p-0 border-none bg-transparent" align="start" side="right">
                                        <ProfileCard u={{
                                            uid: m.senderId,
                                            name: m.senderName,
                                            photoURL: m.senderPhoto,
                                            status: 'offline',
                                            colorClass: getAvatarColor(m.senderId)
                                        }} />
                                     </PopoverContent>
                                   </Popover>
                                ) : (
                                   <div className="w-10 text-[10px] text-muted-foreground/0 group-hover/msg:text-muted-foreground/40 text-center select-none pt-1 font-mono">
                                      {format(date, "h:mm a")}
                                   </div>
                                )}
                             </div>

                             <div className="flex-1 min-w-0">
                                {!isSequence && (
                                   <div className="flex items-center gap-2 mb-1">
                                      <span 
                                        className={cn("font-bold text-base hover:underline cursor-pointer tracking-tight", theme === "dark" ? "text-white/90" : "text-foreground")}
                                        onClick={() => {/* Can add quick profile trigger here too */}}
                                      >
                                        {m.senderName}
                                      </span>
                                      <span className="text-[11px] text-muted-foreground/60 font-medium">{format(date, "MM/dd/yyyy h:mm a")}</span>
                                      {m.pinned && <Pin className="h-3 w-3 text-amber-500 fill-amber-500 rotate-45" />}
                                   </div>
                                )}
                                {m.replyTo && !isSequence && (
                                   <div className={cn("flex items-center gap-2 text-xs text-muted-foreground/80 mb-1 ml-1 p-1.5 rounded-md border-l-2 border-primary max-w-fit transition-colors cursor-pointer",
                                     theme === "dark" ? "bg-white/5 hover:bg-white/10" : "bg-muted/50 hover:bg-muted"
                                   )}>
                                      <Reply className="h-3 w-3 opacity-50" />
                                      <span className="font-semibold text-primary opacity-80">@{m.replyTo.name}</span>
                                      <span className="truncate max-w-[200px] opacity-70 italic">"{m.replyTo.text}"</span>
                                   </div>
                                )}
                                <div className={cn("text-base leading-relaxed whitespace-pre-wrap break-words font-normal tracking-wide", theme === "dark" ? "text-gray-100" : "text-foreground")}>
                                   {m.type === "image" && m.imageUrl && (
                                      <Dialog>
                                        <DialogTrigger>
                                          <div className={cn("my-2 max-w-sm rounded-2xl overflow-hidden border shadow-xl transition-transform hover:scale-[1.01] cursor-zoom-in",
                                            theme === "dark" ? "border-white/10 bg-black/30" : "border-border bg-muted/30"
                                          )}>
                                            <img src={m.imageUrl} alt="Attachment" className="max-h-80 w-auto object-contain" />
                                          </div>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-4xl bg-transparent border-none shadow-none p-0 flex justify-center items-center">
                                          <img src={m.imageUrl} className="max-h-[90vh] w-auto rounded-lg shadow-2xl" />
                                        </DialogContent>
                                      </Dialog>
                                   )}
                                   {m.text}
                                   {m.edited && <span className="text-[10px] text-muted-foreground ml-1">(edited)</span>}
                                </div>
                                
                                {m.reactions && Object.keys(m.reactions).length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    {Object.entries(m.reactions).map(([emoji, uids]) => (
                                      <button 
                                        key={emoji}
                                        onClick={() => handleReaction(m, emoji)}
                                        className={cn(
                                          "flex items-center gap-1.5 px-2 py-0.5 rounded-xl text-xs border transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm backdrop-blur-sm",
                                          uids.includes(user?.uid || "") 
                                            ? "bg-primary/20 border-primary/40 text-primary font-bold shadow-[0_0_10px_rgba(var(--primary),0.2)]" 
                                            : "bg-white/5 border-transparent hover:bg-white/10 text-muted-foreground"
                                        )}
                                      >
                                        <span className="text-sm">{emoji}</span>
                                        <span className="text-[10px]">{uids.length}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                             </div>
                          </div>
                       </div>
                    );
                 })}
                 <div ref={bottomRef} className="h-4" />
              </div>
           </ScrollArea>
           
           {/* Floating Scroll Button */}
           {showScrollButton && (
             <Button 
               className="absolute bottom-28 right-8 rounded-full shadow-[0_0_20px_rgba(var(--primary),0.4)] z-20 bg-primary hover:bg-primary/90 text-white h-12 w-12 animate-in fade-in zoom-in border border-white/10" 
               size="icon" 
               onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
             >
               <ArrowDown className="h-6 w-6" />
             </Button>
           )}
           
           {/* Glassy Typing Indicator */}
           {typingUsers.length > 0 && (
              <div className="absolute bottom-24 left-6 z-30 animate-in slide-in-from-bottom-2 fade-in duration-300">
                 <div className={cn("backdrop-blur-xl border px-4 py-2 rounded-full shadow-lg flex items-center gap-3",
                   theme === "dark" ? "bg-black/60 border-white/10" : "bg-background/90 border-border"
                 )}>
                    <div className="flex gap-1 h-2 items-center">
                       <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                       <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                       <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></span>
                    </div>
                    <span className={cn("text-xs font-bold tracking-wide", theme === "dark" ? "text-white/90" : "text-foreground")}>
                      {typingUsers.length === 1 
                        ? `${typingUsers[0]} is typing...`
                        : typingUsers.length === 2
                        ? `${typingUsers[0]} and ${typingUsers[1]} are typing...`
                        : typingUsers.length > 2
                        ? `${typingUsers[0]}, ${typingUsers[1]}, and ${typingUsers.length - 2} other${typingUsers.length - 2 > 1 ? 's' : ''} are typing...`
                        : "Someone is typing..."
                      }
                    </span>
                 </div>
              </div>
           )}

           {/* Input Area */}
           <div className="p-4 md:px-6 md:pb-6 bg-transparent">
              <div className={cn("relative backdrop-blur-2xl rounded-3xl border shadow-2xl focus-within:ring-1 focus-within:ring-primary/40 focus-within:border-primary/40 focus-within:shadow-[0_0_20px_rgba(var(--primary),0.15)] transition-all duration-300",
                theme === "dark" ? "bg-background/40 border-white/10" : "bg-background/80 border-border"
              )}>
                 {(replyingTo || imagePreview) && (
                    <div className={cn("flex items-center justify-between p-3 border-b rounded-t-3xl animate-in slide-in-from-bottom-2",
                      theme === "dark" ? "border-white/5 bg-white/5" : "border-border bg-muted/30"
                    )}>
                       <div className="flex items-center gap-3 text-xs overflow-hidden px-2">
                          {replyingTo && <div className="flex items-center gap-2 text-muted-foreground"><Reply className="h-3 w-3 text-primary" /><span className="font-bold text-foreground">Replying to {replyingTo.senderName}</span></div>}
                          {imagePreview && <div className={cn("flex items-center gap-2 border rounded-md p-1", theme === "dark" ? "border-white/10 bg-black/40" : "border-border bg-muted")}><img src={imagePreview} className="h-8 w-8 object-cover rounded" /><span className="text-muted-foreground font-medium">Image attached</span></div>}
                       </div>
                       <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-white/10" onClick={() => { setReplyingTo(null); cancelImage(); }}><X className="h-4 w-4" /></Button>
                    </div>
                 )}
                 <div className="flex items-end p-2 gap-2">
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-muted-foreground hover:text-white hover:bg-white/10 transition-colors shrink-0 mb-0.5" onClick={() => fileInputRef.current?.click()}><Paperclip className="h-5 w-5" /></Button>
                    <div className="relative flex-1">
                      <Textarea 
                        ref={textareaRef}
                        value={text} 
                        onChange={handleTyping} 
                        onKeyDown={(e) => { 
                          if (e.key === "Enter" && !e.shiftKey) { 
                            e.preventDefault(); 
                            handleSendMessage(); 
                            setMentionOpen(false);
                          } else if (e.key === 'Escape') {
                            setMentionOpen(false);
                          } else if (mentionOpen && e.key === 'ArrowDown') {
                            e.preventDefault();
                            // Could add keyboard navigation here
                          }
                        }} 
                        placeholder={`Message #${activeChat.name}... (Press @ to mention)`} 
                        className={cn("border-0 bg-transparent focus-visible:ring-0 resize-none py-3.5 max-h-48 min-h-[44px] text-base placeholder:text-muted-foreground/50", theme === "dark" ? "text-white" : "text-foreground")} 
                        rows={1} 
                      />
                      {/* Mention Popup positioned relative to textarea */}
                      {mentionOpen && (
                        <div 
                          ref={mentionRef}
                          className={cn("absolute bottom-full left-0 mb-2 rounded-lg shadow-2xl border backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 z-50",
                            theme === "dark" ? "bg-black/90 border-white/10" : "bg-background border-border"
                          )}
                          style={{ minWidth: '200px', maxWidth: '300px' }}
                        >
                          <div className="p-2">
                            <div className={cn("text-xs font-semibold px-2 py-1 mb-1", theme === "dark" ? "text-muted-foreground" : "text-muted-foreground")}>
                              Mention someone
                            </div>
                            <ScrollArea className="max-h-48">
                              {filteredUsersForMention.length > 0 ? (
                                filteredUsersForMention.map(u => (
                                  <button
                                    key={u.uid}
                                    onClick={() => insertMention(u.name)}
                                    className={cn("w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-primary/10 transition-colors text-left",
                                      theme === "dark" ? "hover:text-white" : "hover:text-foreground"
                                    )}
                                  >
                                    <Avatar className="h-6 w-6">
                                      <AvatarImage src={u.photoURL || ""} />
                                      <AvatarFallback className={cn("text-[10px] text-white font-bold", u.colorClass)}>{u.name[0]}</AvatarFallback>
                                    </Avatar>
                                    <span className={cn("text-sm", theme === "dark" ? "text-white" : "text-foreground")}>{u.name}</span>
                                  </button>
                                ))
                              ) : (
                                <div className={cn("px-2 py-4 text-sm text-center", theme === "dark" ? "text-muted-foreground" : "text-muted-foreground")}>
                                  No users found
                                </div>
                              )}
                            </ScrollArea>
                          </div>
                        </div>
                      )}
                    </div>
                    <Button 
                      onClick={handleSendMessage} 
                      disabled={(!text.trim() && !imageFile) || isUploading} 
                      size="icon" 
                      className={cn(
                        "h-10 w-10 rounded-full shrink-0 mb-0.5 mr-1 transition-all duration-300 shadow-lg", 
                        text.trim() || imageFile ? "bg-primary text-primary-foreground scale-100 hover:scale-105 hover:shadow-glow-primary" : "bg-white/10 text-muted-foreground scale-90"
                      )} 
                      variant={text.trim() || imageFile ? "default" : "ghost"}
                    >
                      {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 ml-0.5" />}
                    </Button>
                 </div>
              </div>
           </div>
        </div>
      </main>

      {membersOpen && (
        <aside className={cn("hidden lg:flex w-72 border-l backdrop-blur-2xl flex-col shadow-2xl z-20",
          theme === "dark" ? "border-white/5 bg-background/20" : "border-border bg-background/80"
        )}>
           <div className={cn("h-16 p-6 border-b flex items-center font-bold text-xs tracking-widest",
             theme === "dark" ? "border-white/5 text-muted-foreground/70" : "border-border text-muted-foreground"
           )}>MEMBERS — {users.length}</div>
           <ScrollArea className="flex-1 p-4">
              <div className="mb-8">
                 <h4 className="text-[10px] font-bold text-muted-foreground/50 uppercase mb-3 px-2 flex items-center gap-2"><span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse"></span> Online — {users.filter(u => u.status === 'online').length}</h4>
                 <div className="space-y-1">
                   {users.filter(u => u.status === 'online').map(u => (
                      <Popover key={u.uid}>
                        <PopoverTrigger asChild>
                           <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer group transition-colors">
                              <div className="relative"><Avatar className="h-9 w-9 ring-2 ring-transparent group-hover:ring-white/20 transition-all"><AvatarImage src={u.photoURL} /><AvatarFallback className={cn("text-[10px] text-white font-bold", u.colorClass)}>{u.name[0]}</AvatarFallback></Avatar><span className="absolute bottom-0 right-0 h-3 w-3 bg-emerald-500 border-2 border-background rounded-full" /></div>
                              <div className="overflow-hidden"><p className="text-sm font-semibold truncate group-hover:text-primary transition-colors text-gray-200">{u.name}</p><p className="text-[10px] text-muted-foreground/70">Online now</p></div>
                           </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 border-none bg-transparent mr-4" align="start" side="left">
                           <ProfileCard u={u} />
                        </PopoverContent>
                      </Popover>
                   ))}
                 </div>
              </div>
              <div>
                 <h4 className="text-[10px] font-bold text-muted-foreground/50 uppercase mb-3 px-2">Offline — {users.filter(u => u.status === 'offline').length}</h4>
                 <div className="space-y-1 opacity-70 hover:opacity-100 transition-opacity">
                   {users.filter(u => u.status === 'offline').map(u => (
                      <Popover key={u.uid}>
                        <PopoverTrigger asChild>
                           <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer group transition-colors">
                              <Avatar className="h-9 w-9 grayscale group-hover:grayscale-0 transition-all"><AvatarImage src={u.photoURL} /><AvatarFallback className={cn("text-[10px] text-white font-bold", u.colorClass)}>{u.name[0]}</AvatarFallback></Avatar>
                              <p className="text-sm font-medium truncate group-hover:text-foreground transition-colors text-gray-400">{u.name}</p>
                           </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 border-none bg-transparent mr-4" align="start" side="left">
                           <ProfileCard u={u} />
                        </PopoverContent>
                      </Popover>
                   ))}
                 </div>
              </div>
           </ScrollArea>
        </aside>
      )}


      {/* Pinned Messages Sidebar */}
      {pinnedMessagesOpen && (
        <aside className={cn("hidden lg:flex w-80 border-l backdrop-blur-2xl flex-col shadow-2xl z-20",
          theme === "dark" ? "border-white/5 bg-background/20" : "border-border bg-background/80"
        )}>
          <div className={cn("h-16 p-6 border-b flex items-center justify-between font-bold text-xs tracking-widest",
            theme === "dark" ? "border-white/5 text-muted-foreground/70" : "border-border text-muted-foreground"
          )}>
            <span>PINNED MESSAGES — {pinnedMessages.length}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPinnedMessagesOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 p-4">
            {pinnedMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Pin className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No pinned messages</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pinnedMessages.map(m => (
                  <div
                    key={m.id}
                    onClick={() => scrollToPinnedMessage(m.id)}
                    className={cn("p-3 rounded-lg cursor-pointer transition-all hover:scale-[1.02] border",
                      theme === "dark" ? "bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15" : "bg-amber-50 border-amber-200 hover:bg-amber-100"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={m.senderPhoto} />
                        <AvatarFallback className={cn("text-[10px] text-white font-bold", getAvatarColor(m.senderId))}>{m.senderName[0]}</AvatarFallback>
                      </Avatar>
                      <span className={cn("text-sm font-semibold", theme === "dark" ? "text-white" : "text-foreground")}>{m.senderName}</span>
                      <Pin className="h-3 w-3 text-amber-500 fill-amber-500" />
                    </div>
                    <p className={cn("text-sm line-clamp-2", theme === "dark" ? "text-gray-300" : "text-muted-foreground")}>{m.text}</p>
                    {m.createdAt?.toDate && (
                      <p className="text-xs text-muted-foreground mt-1">{format(m.createdAt.toDate(), "MMM d, h:mm a")}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </aside>
      )}

      {/* Forward Dialog */}
      <Dialog open={forwardDialogOpen} onOpenChange={setForwardDialogOpen}>
        <DialogContent className={cn("sm:max-w-md backdrop-blur-xl",
          theme === "dark" ? "bg-black/80 border-white/10 text-white" : "bg-background border-border"
        )}>
          <DialogHeader><DialogTitle>Forward Message</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
             <p className="text-sm text-muted-foreground">Select a destination:</p>
             <ScrollArea className="h-[300px] pr-4">
               <div className="space-y-2">
                 {CHANNELS.map(c => (
                   <Button key={c.id} variant="outline" className={cn("w-full justify-start gap-3 h-12 rounded-xl",
                     theme === "dark" ? "border-white/10 hover:bg-white/10 hover:text-white bg-transparent" : "border-border hover:bg-muted"
                   )} onClick={() => confirmForward(c)}>
                     <div className={cn("p-1.5 rounded-md", theme === "dark" ? "bg-white/10" : "bg-muted")}><Hash className="h-4 w-4" /></div> <span className="font-medium">{c.name}</span>
                   </Button>
                 ))}
                 <div className={cn("my-2 border-t", theme === "dark" ? "border-white/10" : "border-border")} />
                 {users.filter(u => u.uid !== user?.uid).map(u => (
                   <Button key={u.uid} variant="ghost" className={cn("w-full justify-start gap-3 h-12 rounded-xl",
                     theme === "dark" ? "hover:bg-white/10 hover:text-white" : "hover:bg-muted"
                   )} onClick={() => confirmForward(u)}>
                     <Avatar className="h-8 w-8"><AvatarImage src={u.photoURL || ""} /><AvatarFallback>{u.name[0]}</AvatarFallback></Avatar>
                     {u.name}
                   </Button>
                 ))}
               </div>
             </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}