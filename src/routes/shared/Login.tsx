import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { toast } from "sonner";
import { LogIn, CheckCircle2 } from "lucide-react";
import { ThemeToggle } from "../../components/ThemeToggle";

export const Login: React.FC = () => {
  const { user, role, signIn, signOut, loading } = useAuth();
  const { settings } = useSettings();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const logoUrl =
    theme === "dark"
      ? settings?.loginDarkLogoUrl ||
        settings?.darkLogoUrl ||
        settings?.logoUrl ||
        "/logo.png"
      : settings?.loginLightLogoUrl ||
        settings?.lightLogoUrl ||
        settings?.logoUrl ||
        "/logo.png";

  useEffect(() => {
    if (user && !loading) {
      if (role === "employee") {
        navigate("/dashboard", { replace: true });
        toast.success("Welcome back, Employee!");
      } else if (role === "admin") {
        signOut();
        toast.error("This is the Employee Portal. Please use the Admin Login.");
      } else {
        signOut();
        toast.error(
          "Access Denied: Your account is not registered as an employee."
        );
      }
    }
  }, [user, role, loading, navigate, signOut]);

  const handleSignIn = async () => {
    try {
      await signIn();
    } catch (error) {
      toast.error("Failed to sign in. Please try again.");
      console.error("Sign in error:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white dark:bg-slate-900 shadow-lg">
            <img
              src={logoUrl}
              alt="Logo"
              className="h-10 w-10 object-contain"
            />
          </div>
          <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full w-1/2 animate-[loading_1s_ease-in-out_infinite] rounded-full bg-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Background decoration */}
      <div className="absolute -left-[10%] -top-[10%] h-[500px] w-[500px] rounded-full bg-blue-100/50 dark:bg-blue-900/20 blur-3xl"></div>
      <div className="absolute -bottom-[10%] -right-[10%] h-[500px] w-[500px] rounded-full bg-indigo-100/50 dark:bg-indigo-900/20 blur-3xl"></div>

      <div className="z-10 w-full max-w-md animate-in fade-in zoom-in duration-500 slide-in-from-bottom-4">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-white dark:bg-slate-900 shadow-xl shadow-blue-100/50 dark:shadow-none ring-1 ring-slate-100 dark:ring-slate-800">
            <img
              src={logoUrl}
              alt="Attendance Portal"
              className="h-12 w-12 object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Welcome Back
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Please sign in to your employee account
          </p>
        </div>

        <Card className="border-0 shadow-2xl shadow-blue-900/5 dark:shadow-none ring-1 ring-slate-200/50 dark:ring-slate-800 dark:bg-slate-900/50 dark:backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6 text-center">
            <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">
              Attendance Portal
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              Manage your attendance and view reports
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Button
              onClick={handleSignIn}
              className="group relative h-12 w-full overflow-hidden bg-blue-600 text-base font-medium text-white transition-all hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/20"
              size="lg"
            >
              <div className="absolute inset-0 flex items-center justify-center transition-transform duration-200 group-hover:-translate-y-full">
                <span className="flex items-center gap-2">
                  <LogIn className="h-5 w-5" />
                  Sign in with Google
                </span>
              </div>
              <div className="absolute inset-0 flex translate-y-full items-center justify-center transition-transform duration-200 group-hover:translate-y-0">
                <span className="flex items-center gap-2">
                  Continue to Attendance Portal
                  <CheckCircle2 className="h-5 w-5" />
                </span>
              </div>
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-100 dark:border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-slate-900 px-2 text-slate-400 dark:text-slate-500">
                  Secure Access
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center text-xs text-slate-500 dark:text-slate-400">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                <span className="block font-medium text-slate-900 dark:text-slate-200">
                  Fast
                </span>
                Quick Check-ins
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                <span className="block font-medium text-slate-900 dark:text-slate-200">
                  Secure
                </span>
                Encrypted Data
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
          &copy; {new Date().getFullYear()} Attendance Portal. All rights
          reserved.
        </p>
      </div>
    </div>
  );
};
