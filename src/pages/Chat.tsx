import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Paperclip, Send, Archive, X } from "lucide-react";

export default function Chat() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "users"), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.id !== user.uid));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user || !selectedUser) return;
    const chatId = [user.uid, selectedUser.id].sort().join("_");
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt"));
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });
    return () => unsub();
  }, [user, selectedUser]);

  const sendMessage = async () => {
    if (!text.trim() || !user || !selectedUser) return;
    const chatId = [user.uid, selectedUser.id].sort().join("_");
    await addDoc(collection(db, "chats", chatId, "messages"), {
      text,
      sender: user.uid,
      receiver: selectedUser.id,
      createdAt: serverTimestamp(),
      type: "text",
    });
    setText("");
  };

  return (
    <div className="h-screen flex bg-background">
      {sidebarOpen && (
        <aside className="w-80 border-r flex flex-col">
          <div className="p-3 flex justify-between items-center">
            <h2 className="font-semibold">Messages</h2>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}><X /></Button>
          </div>
          <ScrollArea className="flex-1">
            {users.map(u => (
              <div key={u.id} onClick={() => setSelectedUser(u)} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted">
                <Avatar>
                  <AvatarImage src={u.photoURL || ""} />
                  <AvatarFallback>{u.email?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{u.name || "User"}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
              </div>
            ))}
          </ScrollArea>
        </aside>
      )}

      <main className="flex-1 flex flex-col">
        {!selectedUser ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">Select a chat</div>
        ) : (
          <>
            <header className="p-3 border-b flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={selectedUser.photoURL || ""} />
                  <AvatarFallback>{selectedUser.email?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedUser.name || "User"}</p>
                  <p className="text-xs text-green-500">Online</p>
                </div>
              </div>
              <Button variant="ghost" size="icon"><Archive /></Button>
            </header>

            <ScrollArea className="flex-1 p-4">
              {messages.map(m => (
                <div key={m.id} className={`mb-2 flex ${m.sender === user?.uid ? "justify-end" : "justify-start"}`}>
                  <div className={`px-3 py-2 rounded-xl max-w-xs ${m.sender === user?.uid ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </ScrollArea>

            <footer className="p-3 border-t flex gap-2">
              <Button variant="ghost" size="icon"><Paperclip /></Button>
              <Input
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendMessage()}
                placeholder="Type a message"
              />
              <Button onClick={sendMessage}><Send /></Button>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}