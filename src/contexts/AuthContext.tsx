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
        const profileData = snap.data() as UserProfile;
        // Ensure role field exists
        if (!profileData.role) {
          profileData.role = "user";
        }
        setProfile(profileData);
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error("Error refreshing profile:", error);
      // Don't throw - let the caller handle errors if needed
    }
  };

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        try {
          if (!isMounted) return;

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
            profileUnsubscribe = null;
          }

          const userRef = doc(db, "users", firebaseUser.uid);
          
          try {
            // First, check if user document exists
            const snap = await getDoc(userRef);

            if (!snap.exists()) {
              // Create user document with default role
              try {
                await setDoc(userRef, {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                  name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
                  photoURL: firebaseUser.photoURL || null,
                  role: "user", // Default role
                  createdAt: serverTimestamp(),
                  lastSignInAt: serverTimestamp(),
                });
              } catch (setError) {
                console.error("Error creating user document:", setError);
                // Continue anyway - the snapshot listener will handle it
              }
            } else {
              // Update last sign in time
              try {
                await updateDoc(userRef, { 
                  lastSignInAt: serverTimestamp(),
                  // Update email/name/photo if changed
                  email: firebaseUser.email,
                  name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
                  photoURL: firebaseUser.photoURL || null,
                });
              } catch (updateError) {
                console.warn("Error updating user document (non-critical):", updateError);
                // Continue anyway - lastSignInAt update is not critical
              }
            }

            // Set up real-time listener for profile changes
            // This ensures role changes are reflected immediately
            profileUnsubscribe = onSnapshot(
              userRef,
              (docSnap) => {
                if (!isMounted) return;
                
                try {
                  if (docSnap.exists()) {
                    const profileData = docSnap.data() as UserProfile;
                    // Ensure role field exists, default to "user" if missing
                    if (!profileData.role) {
                      profileData.role = "user";
                    }
                    setProfile(profileData);
                  } else {
                    setProfile(null);
                  }
                  setLoading(false);
                } catch (profileError) {
                  console.error("Error processing profile data:", profileError);
                  if (isMounted) {
                    setLoading(false);
                  }
                }
              },
              (error) => {
                console.error("Error listening to profile:", error);
                if (!isMounted) return;
                
                // Fallback: try to get profile once
                getDoc(userRef)
                  .then((docSnap) => {
                    if (!isMounted) return;
                    
                    if (docSnap.exists()) {
                      const profileData = docSnap.data() as UserProfile;
                      if (!profileData.role) {
                        profileData.role = "user";
                      }
                      setProfile(profileData);
                    } else {
                      setProfile(null);
                    }
                    setLoading(false);
                  })
                  .catch((fallbackError) => {
                    console.error("Error in fallback profile fetch:", fallbackError);
                    if (isMounted) {
                      setLoading(false);
                    }
                  });
              }
            );
          } catch (dbError) {
            console.error("Error in auth state change handler:", dbError);
            if (isMounted) {
              setLoading(false);
            }
          }
        } catch (error) {
          console.error("Unexpected error in auth state change:", error);
          if (isMounted) {
            setLoading(false);
          }
        }
      },
      (error) => {
        console.error("Auth state observer error:", error);
        if (isMounted) {
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
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
    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      if (res.user) {
        try {
          await sendEmailVerification(res.user);
        } catch (verificationError) {
          console.error("Error sending verification email:", verificationError);
          // Continue even if verification email fails
        }
        await signOut(auth);
      }
    } catch (error) {
      console.error("Error during sign up:", error);
      throw error; // Re-throw to let caller handle it
    }
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    try {
      if (auth.currentUser) {
        try {
          await updateDoc(doc(db, "users", auth.currentUser.uid), {
            lastSignOutAt: serverTimestamp(),
          });
        } catch (error) {
          console.error("Error updating last sign out (non-critical):", error);
          // Continue with logout even if update fails
        }
      }
      await signOut(auth);
    } catch (error) {
      console.error("Error during logout:", error);
      // Still try to sign out even if update fails
      try {
        await signOut(auth);
      } catch (signOutError) {
        console.error("Critical error during sign out:", signOutError);
        throw signOutError;
      }
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error("Error sending password reset email:", error);
      throw error; // Re-throw to let caller handle it
    }
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