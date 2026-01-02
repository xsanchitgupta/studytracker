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

const ADMIN_EMAIL = "admin@studytrack.edu";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  sendPhoneOTP: (
    phoneNumber: string,
    recaptchaVerifier: RecaptchaVerifier
  ) => Promise<ConfirmationResult>;
  verifyPhoneOTP: (
    confirmationResult: ConfirmationResult,
    otp: string
  ) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // 🔐 EMAIL VERIFICATION GUARD (ADMIN BYPASS)
      if (
        firebaseUser &&
        firebaseUser.email &&
        firebaseUser.email !== ADMIN_EMAIL && // 👈 ADMIN EXCLUDED
        !firebaseUser.emailVerified &&
        firebaseUser.providerData.some(
          (p) => p.providerId === "password"
        )
      ) {
        setUser(null);
      } else {
        setUser(firebaseUser);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // 🔹 SIMPLE SIGN IN (NO VERIFICATION LOGIC HERE)
  const signIn = (email: string, password: string) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string) => {
    const result = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    if (result.user) {
      await sendEmailVerification(result.user);
      await signOut(auth); // prevent auto-login
    }
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const sendPhoneOTP = async (
    phoneNumber: string,
    recaptchaVerifier: RecaptchaVerifier
  ) => {
    return signInWithPhoneNumber(
      auth,
      phoneNumber,
      recaptchaVerifier
    );
  };

  const verifyPhoneOTP = async (
    confirmationResult: ConfirmationResult,
    otp: string
  ) => {
    await confirmationResult.confirm(otp);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        logout,
        resetPassword,
        sendPhoneOTP,
        verifyPhoneOTP,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error(
      "useAuth must be used within an AuthProvider"
    );
  }
  return context;
};
