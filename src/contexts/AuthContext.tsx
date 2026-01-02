import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  sendPhoneOTP: (phoneNumber: string, recaptchaVerifier: RecaptchaVerifier) => Promise<ConfirmationResult>;
  verifyPhoneOTP: (confirmationResult: ConfirmationResult, otp: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // Security Guard: 
      // If the user signed up via email/password but hasn't verified their email, 
      // we treat them as null to prevent access to protected routes.
      // Google/Phone users usually don't have the 'password' providerId or are auto-verified.
      if (
        firebaseUser && 
        firebaseUser.email && 
        !firebaseUser.emailVerified && 
        firebaseUser.providerData.some(p => p.providerId === 'password')
      ) {
        setUser(null);
      } else {
        setUser(firebaseUser);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    
    // BLOCK ACCESS: If email is not verified, throw specific error and sign out
    if (!result.user.emailVerified) {
      await signOut(auth);
      // Throwing as an object so Auth.tsx can catch 'error.code'
      throw { code: 'auth/unverified-email' };
    }
  };

  const signUp = async (email: string, password: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    if (result.user) {
      await sendEmailVerification(result.user);
      // Sign them out immediately so they can't "auto-login" without verifying
      await signOut(auth);
    }
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    // Google accounts are considered verified by default
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const sendPhoneOTP = async (phoneNumber: string, recaptchaVerifier: RecaptchaVerifier) => {
    return await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
  };

  const verifyPhoneOTP = async (confirmationResult: ConfirmationResult, otp: string) => {
    await confirmationResult.confirm(otp);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signIn, 
      signUp, 
      signInWithGoogle,
      logout, 
      resetPassword, 
      sendPhoneOTP, 
      verifyPhoneOTP 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};