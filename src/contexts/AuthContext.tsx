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
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

interface UserProfile {
  uid: string;
  email: string | null;
  name: string;
  photoURL: string | null;
  role: string;
  createdAt?: any;
  lastSignInAt?: any;
  lastSignOutAt?: any;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Refresh profile function
  const refreshProfile = async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    try {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      }
    } catch (error) {
      console.error("Error refreshing profile:", error);
    }
  };

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
        if (profileUnsubscribe) {
          profileUnsubscribe();
          profileUnsubscribe = null;
        }
        return;
      }

      // Unsubscribe from previous profile listener
      if (profileUnsubscribe) {
        profileUnsubscribe();
      }

      const userRef = doc(db, "users", firebaseUser.uid);
      
      // First, check if user document exists
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        // Create user document with default role
        await setDoc(userRef, {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
          photoURL: firebaseUser.photoURL || null,
          role: "user", // Default role
          createdAt: serverTimestamp(),
          lastSignInAt: serverTimestamp(),
        });
      } else {
        // Update last sign in time
        await updateDoc(userRef, { 
          lastSignInAt: serverTimestamp(),
          // Update email/name/photo if changed
          email: firebaseUser.email,
          name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
          photoURL: firebaseUser.photoURL || null,
        });
      }

      // Set up real-time listener for profile changes
      // This ensures role changes are reflected immediately
      profileUnsubscribe = onSnapshot(
        userRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const profileData = docSnap.data() as UserProfile;
            // Ensure role field exists, default to "user" if missing
            if (!profileData.role) {
              profileData.role = "user";
            }
            setProfile(profileData);
            console.log("[AuthContext] Profile loaded:", { 
              uid: profileData.uid, 
              email: profileData.email, 
              role: profileData.role 
            });
          } else {
            setProfile(null);
          }
          setLoading(false);
        },
        (error) => {
          console.error("Error listening to profile:", error);
          // Fallback: try to get profile once
          getDoc(userRef).then((docSnap) => {
            if (docSnap.exists()) {
              const profileData = docSnap.data() as UserProfile;
              if (!profileData.role) {
                profileData.role = "user";
              }
              setProfile(profileData);
            }
            setLoading(false);
          });
        }
      );
    });

    return () => {
      unsubscribe();
      if (profileUnsubscribe) {
        profileUnsubscribe();
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const res = await createUserWithEmailAndPassword(auth, email, password);
    if (res.user) {
      await sendEmailVerification(res.user);
      await signOut(auth);
    }
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    if (auth.currentUser) {
      try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
          lastSignOutAt: serverTimestamp(),
        });
      } catch (error) {
        console.error("Error updating last sign out:", error);
      }
    }
    await signOut(auth);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  // Compute isAdmin from profile - single source of truth
  // This is computed reactively whenever profile changes
  const isAdmin = Boolean(profile && profile.role === "admin");

  return (
    <AuthContext.Provider
      value={{ 
        user, 
        profile, 
        loading, 
        isAdmin,
        signIn, 
        signUp, 
        signInWithGoogle, 
        logout, 
        resetPassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};