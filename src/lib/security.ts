// Security utilities for chat encryption and validation
// All free - using Web Crypto API (built into browsers)

// Message validation
export function validateMessage(text: string, imageUrl?: string): { valid: boolean; error?: string } {
  if (!text && !imageUrl) {
    return { valid: false, error: "Message cannot be empty" };
  }
  
  if (text && text.length > 5000) {
    return { valid: false, error: "Message too long (max 5000 characters)" };
  }
  
  // Basic XSS prevention
  if (text && /<script|javascript:|onerror=/i.test(text)) {
    return { valid: false, error: "Message contains invalid content" };
  }
  
  return { valid: true };
}

// Rate limiting - simple client-side check
const messageTimestamps: number[] = [];
const RATE_LIMIT_WINDOW = 10000; // 10 seconds
const MAX_MESSAGES = 10; // max 10 messages per 10 seconds

export function checkRateLimit(): { allowed: boolean; error?: string } {
  const now = Date.now();
  
  // Remove old timestamps
  const recentMessages = messageTimestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW);
  
  if (recentMessages.length >= MAX_MESSAGES) {
    return { 
      allowed: false, 
      error: "You're sending messages too quickly. Please slow down." 
    };
  }
  
  // Add current timestamp
  messageTimestamps.length = 0;
  messageTimestamps.push(...recentMessages, now);
  
  return { allowed: true };
}

// Simple encryption using Web Crypto API (FREE - built into browser)
// Note: This is basic encryption. For true E2E, we'd need key exchange protocol
export async function encryptMessage(text: string, password: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
    // Derive key from password
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );
    
    // Combine salt + iv + encrypted data
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);
    
    // Convert to base64
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }
}

export async function decryptMessage(encryptedText: string, password: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
    
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const data = combined.slice(28);
    
    // Derive key from password
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );
    
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw error;
  }
}

// Generate a secure random key for encryption
export function generateEncryptionKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}
