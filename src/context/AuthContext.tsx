import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import {
  signInWithGoogle,
  signOutUser,
  checkUserRole,
  UserRole,
} from "../lib/auth";
import { getAdmin, getEmployee } from "../lib/firestore";
import { Admin, Employee } from "../types";

interface AuthContextType {
  user: User | null;
  role: UserRole;
  profile: Admin | Employee | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [profile, setProfile] = useState<Admin | Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        const userRole = await checkUserRole(firebaseUser);
        setRole(userRole);

        if (userRole === "admin") {
          const adminProfile = await getAdmin(firebaseUser.uid);
          setProfile(adminProfile);
        } else if (userRole === "employee") {
          const employeeProfile = await getEmployee(firebaseUser.uid);

          if (employeeProfile) {
            // Check if account is explicitly deactivated
            // If isActive is undefined, we treat it as active (legacy accounts)
            if (employeeProfile.isActive === false) {
              await signOutUser();
              setUser(null);
              setRole(null);
              setProfile(null);
              alert(
                "Your account has been deactivated. Please contact the administrator."
              );
              setLoading(false);
              return;
            }
            setProfile(employeeProfile);
          } else {
            // Employee profile not found but role is employee?
            // This shouldn't happen normally, but safe to sign out or handle gracefully
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
      } else {
        setRole(null);
        setProfile(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async () => {
    try {
      await signInWithGoogle();
      // The onAuthStateChanged listener will handle the rest, including the active check.
      // However, to be extra safe and provide immediate feedback if possible (though onAuthStateChanged is the source of truth):
      // We rely on the listener.
    } catch (error) {
      console.error("Sign in error:", error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await signOutUser();
      setUser(null);
      setRole(null);
      setProfile(null);
    } catch (error) {
      console.error("Sign out error:", error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    role,
    profile,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
