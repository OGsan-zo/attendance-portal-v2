import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { UserRole } from "../../lib/auth";
import { Skeleton } from "../ui/skeleton";

interface RequireAuthProps {
  children: React.ReactNode;
  role: UserRole;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children, role }) => {
  const { user, role: userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 w-full max-w-md p-8">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    if (role === "admin") {
      return <Navigate to="/admin-login" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  if (userRole !== role) {
    return <Navigate to="/access-denied" replace />;
  }

  return <>{children}</>;
};
