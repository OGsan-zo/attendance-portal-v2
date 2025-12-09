import React from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import { LogOut, LayoutDashboard, Calendar, DollarSign } from "lucide-react";
import { toast } from "sonner";

export const EmployeeLayout: React.FC = () => {
  const { profile, signOut } = useAuth();
  const location = useLocation();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
    } catch (error) {
      toast.error("Failed to sign out");
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-primary tracking-tight">
                Attendance Portal
              </h1>
              <p className="text-sm text-muted-foreground">
                Welcome, {profile?.name || "Employee"}
              </p>
            </div>
            <Button
              onClick={handleSignOut}
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex space-x-1">
            <Link to="/dashboard">
              <Button
                variant="ghost"
                className={`rounded-none border-b-2 px-6 py-6 h-auto text-base font-medium transition-colors ${
                  isActive("/dashboard")
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-primary hover:bg-gray-50"
                }`}
              >
                <LayoutDashboard className="mr-2 h-5 w-5" />
                Dashboard
              </Button>
            </Link>
            <Link to="/calendar">
              <Button
                variant="ghost"
                className={`rounded-none border-b-2 px-6 py-6 h-auto text-base font-medium transition-colors ${
                  isActive("/calendar")
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-primary hover:bg-gray-50"
                }`}
              >
                <Calendar className="mr-2 h-5 w-5" />
                My Calendar
              </Button>
            </Link>
            <Link to="/salary">
              <Button
                variant="ghost"
                className={`rounded-none border-b-2 px-6 py-6 h-auto text-base font-medium transition-colors ${
                  isActive("/salary")
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-primary hover:bg-gray-50"
                }`}
              >
                <DollarSign className="mr-2 h-5 w-5" />
                Salary
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
