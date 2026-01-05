// Chat features utility functions - FREE implementations
import { collection, doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

// ===== 1. UNREAD MESSAGE TRACKING =====

export interface UnreadInfo {
  count: number;
  lastReadTimestamp: Timestamp | null;
}

export async function markChatAsRead(userId: string, chatId: string) {
  try {
    await setDoc(doc(db, 'users', userId, 'chatStatus', chatId), {
      lastRead: serverTimestamp(),
      unreadCount: 0
    }, { merge: true });
  } catch (error) {
    console.error('Error marking chat as read:', error);
  }
}

export async function getUnreadCount(userId: string, chatId: string): Promise<number> {
  try {
    const statusDoc = await getDoc(doc(db, 'users', userId, 'chatStatus', chatId));
    return statusDoc.exists() ? (statusDoc.data().unreadCount || 0) : 0;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
}

// ===== 2. TYPING INDICATORS =====

export async function setTypingStatus(chatId: string, userId: string, userName: string, isTyping: boolean) {
  try {
    const typingRef = doc(db, 'chats', chatId, 'typing', userId);
    
    if (isTyping) {
      await setDoc(typingRef, {
        userName,
        timestamp: serverTimestamp()
      });
    } else {
      await deleteDoc(typingRef);
    }
  } catch (error) {
    console.error('Error setting typing status:', error);
  }
}

// ===== 3. MESSAGE SEARCH =====

export function searchMessages(messages: any[], query: string): any[] {
  if (!query.trim()) return messages;
  
  const searchLower = query.toLowerCase();
  return messages.filter(msg => 
    msg.text?.toLowerCase().includes(searchLower) ||
    msg.senderName?.toLowerCase().includes(searchLower)
  );
}

// ===== 4. READ RECEIPTS =====

export async function markMessageAsRead(chatId: string, messageId: string, userId: string) {
  try {
    const readRef = doc(db, 'chats', chatId, 'messages', messageId, 'readBy', userId);
    await setDoc(readRef, {
      readAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error marking message as read:', error);
  }
}

// ===== 5. MENTIONS =====

export function extractMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  
  return mentions;
}

export function highlightMentions(text: string, currentUserId: string, users: any[]): string {
  return text.replace(/@(\w+)/g, (match, username) => {
    const user = users.find(u => u.name?.toLowerCase() === username.toLowerCase());
    const isSelf = user?.uid === currentUserId;
    return `<span class="mention ${isSelf ? 'mention-self' : ''}" data-user="${user?.uid || ''}">${match}</span>`;
  });
}

// ===== 6. BOOKMARKS =====

export async function bookmarkMessage(userId: string, chatId: string, messageId: string, messageData: any) {
  try {
    await setDoc(doc(db, 'users', userId, 'bookmarks', messageId), {
      chatId,
      messageText: messageData.text,
      messageSender: messageData.senderName,
      bookmarkedAt: serverTimestamp(),
      ...messageData
    });
  } catch (error) {
    console.error('Error bookmarking message:', error);
    throw error;
  }
}

export async function removeBookmark(userId: string, messageId: string) {
  try {
    await deleteDoc(doc(db, 'users', userId, 'bookmarks', messageId));
  } catch (error) {
    console.error('Error removing bookmark:', error);
    throw error;
  }
}

// ===== 7. RICH TEXT FORMATTING =====

export function parseMarkdown(text: string): string {
  let formatted = text;
  
  // Bold: **text** or __text__
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  
  // Italic: *text* or _text_
  formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  formatted = formatted.replace(/_([^_]+)_/g, '<em>$1</em>');
  
  // Code: `code`
  formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  
  // Code block: ```code```
  formatted = formatted.replace(/```([^`]+)```/g, '<pre class="code-block">$1</pre>');
  
  // Strikethrough: ~~text~~
  formatted = formatted.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  
  return formatted;
}

// ===== 8. VOICE MESSAGES =====

export async function recordVoiceMessage(): Promise<Blob | null> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    
    return new Promise((resolve, reject) => {
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        resolve(blob);
      };
      mediaRecorder.onerror = reject;
      
      mediaRecorder.start();
      
      // Auto-stop after 60 seconds
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 60000);
    });
  } catch (error) {
    console.error('Error recording voice:', error);
    return null;
  }
}

// ===== 9. POLLS =====

export interface PollOption {
  id: string;
  text: string;
  votes: number;
  voters: string[];
}

export interface Poll {
  question: string;
  options: PollOption[];
  createdBy: string;
  createdAt: Timestamp;
  allowMultiple: boolean;
}

export async function createPoll(chatId: string, poll: Poll): Promise<string> {
  try {
    const pollRef = doc(collection(db, 'chats', chatId, 'polls'));
    await setDoc(pollRef, poll);
    return pollRef.id;
  } catch (error) {
    console.error('Error creating poll:', error);
    throw error;
  }
}

export async function votePoll(chatId: string, pollId: string, optionId: string, userId: string) {
  try {
    const pollRef = doc(db, 'chats', chatId, 'polls', pollId);
    const pollDoc = await getDoc(pollRef);
    
    if (!pollDoc.exists()) return;
    
    const pollData = pollDoc.data() as Poll;
    const options = pollData.options.map(opt => {
      if (opt.id === optionId) {
        // Add vote
        if (!opt.voters.includes(userId)) {
          return {
            ...opt,
            votes: opt.votes + 1,
            voters: [...opt.voters, userId]
          };
        }
      } else if (!pollData.allowMultiple) {
        // Remove vote from other options if single choice
        return {
          ...opt,
          votes: Math.max(0, opt.votes - (opt.voters.includes(userId) ? 1 : 0)),
          voters: opt.voters.filter(v => v !== userId)
        };
      }
      return opt;
    });
    
    await updateDoc(pollRef, { options });
  } catch (error) {
    console.error('Error voting on poll:', error);
    throw error;
  }
}

// ===== 10. MESSAGE STATUS =====

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export function getMessageStatusIcon(status: MessageStatus): string {
  switch (status) {
    case 'sending': return '⏳';
    case 'sent': return '✓';
    case 'delivered': return '✓✓';
    case 'read': return '✓✓'; // Blue in CSS
    case 'failed': return '❌';
    default: return '';
  }
}
