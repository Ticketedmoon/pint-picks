"use client";

import { createContext, useContext, useCallback, useEffect, useState, ReactNode } from "react";
import {
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase";

const ADMIN_UID = "O9xgSWINxiZQQFi142PE1JI2u5C3";
const GM_KEY = "_pp_dm";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  godMode: boolean;
  toggleGodMode: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  godMode: false,
  toggleGodMode: () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [godMode, setGodMode] = useState(false);

  const isAdmin = user?.uid === ADMIN_UID;

  // Restore god mode from localStorage on mount (admin only)
  useEffect(() => {
    if (isAdmin && typeof window !== "undefined") {
      setGodMode(localStorage.getItem(GM_KEY) === "1");
    } else {
      setGodMode(false);
    }
  }, [isAdmin]);

  const toggleGodMode = useCallback(() => {
    if (!isAdmin) return;
    setGodMode((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        if (next) {
          localStorage.setItem(GM_KEY, "1");
        } else {
          localStorage.removeItem(GM_KEY);
        }
      }
      return next;
    });
  }, [isAdmin]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userRef = doc(getFirebaseDb(), "users", firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              displayName: firebaseUser.displayName,
              email: firebaseUser.email,
              photoURL: firebaseUser.photoURL,
              createdAt: new Date().toISOString(),
            });
          }
        } catch {
          // Firestore may be unreachable (offline, cold start). Auth still works.
          console.warn("Failed to sync user profile to Firestore");
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(getFirebaseAuth(), provider);
  };

  const signOut = async () => {
    await firebaseSignOut(getFirebaseAuth());
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, godMode, toggleGodMode, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
