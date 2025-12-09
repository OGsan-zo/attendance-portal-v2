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
    console.log("[AuthContext] Setting up auth state listener");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log(
        "[AuthContext] Auth state changed, user:",
        firebaseUser?.email || "null"
      );
      try {
        if (firebaseUser) {
          console.log("[AuthContext] User logged in, checking role...");
          // Ensure we wait for role check to complete BEFORE setting user state
          const userRole = await checkUserRole(firebaseUser);
          console.log("[AuthContext] Role determined:", userRole);

          let userProfile: Admin | Employee | null = null;

          if (userRole === "admin") {
            console.log("[AuthContext] Fetching admin profile...");
            userProfile = await getAdmin(firebaseUser.uid);
          } else if (userRole === "employee") {
            console.log("[AuthContext] Fetching employee profile...");
            const employeeProfile = await getEmployee(firebaseUser.uid);

            if (employeeProfile) {
              // Check if account is explicitly deactivated
              // If isActive is undefined, we treat it as active (legacy accounts)
              if (employeeProfile.isActive === false) {
                console.log(
                  "[AuthContext] Account is deactivated, signing out"
                );
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
              userProfile = employeeProfile;
            }
          }

          // Batch all state updates together to prevent race conditions
          console.log(
            "[AuthContext] Setting user state - User:",
            firebaseUser.email,
            "Role:",
            userRole
          );
          setUser(firebaseUser);
          setRole(userRole);
          setProfile(userProfile);
        } else {
          // User signed out - batch updates
          console.log("[AuthContext] User signed out, clearing state");
          setUser(null);
          setRole(null);
          setProfile(null);
        }
      } catch (error) {
        console.error("[AuthContext] Error in auth state change:", error);
        // On error, reset everything
        setUser(null);
        setRole(null);
        setProfile(null);
      } finally {
        // Always set loading to false after processing completes
        console.log("[AuthContext] Setting loading to false");
        setLoading(false);
      }
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
