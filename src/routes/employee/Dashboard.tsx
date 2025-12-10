import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Badge } from "../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Skeleton } from "../../components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  CheckCircle,
  XCircle,
  Coffee,
  Clock,
  Calendar,
  DollarSign,
  Timer,
  AlertTriangle,
  Wifi,
  WifiOff,
  PartyPopper,
  Camera,
  RefreshCw,
} from "lucide-react";
import {
  markAttendance,
  getAttendanceForDate,
  getMonthlyAttendance,
  getMonthHolidays,
} from "../../lib/firestore";
import {
  getSalaryMonthKey,
  calculateDeductions,
  calculateNetSalary,
} from "../../lib/salary";
import { uploadAttendanceImage } from "../../lib/storage";
import {
  AttendanceRecord,
  Employee,
  AttendanceStats,
  Holiday,
} from "../../types";
import { useSettings } from "../../context/SettingsContext";
import {
  getUserIP,
  isOnAllowedNetwork,
  getAllowedIP,
} from "../../lib/ipRestriction";
import {
  getCurrentWeekHolidays,
  formatHolidayDisplay,
} from "../../lib/weekHolidays";

const getSafeDate = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  if (typeof timestamp?.toDate === "function") {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === "string") {
    const d = new Date(timestamp);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const formatTime = (timestamp: any) => {
  const date = getSafeDate(timestamp);
  return date ? format(date, "hh:mm a") : "-";
};

export const EmployeeDashboard: React.FC = () => {
  const { currencySymbol, salaryStartDay } = useSettings();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [leaveReason, setLeaveReason] = useState("");
  const [showLeaveInput, setShowLeaveInput] = useState(false);
  const [userIP, setUserIP] = useState<string>("");
  const [isAllowedNetwork, setIsAllowedNetwork] = useState<boolean>(false);
  const [checkingNetwork, setCheckingNetwork] = useState(true);
  const [weekHolidays, setWeekHolidays] = useState<Holiday[]>([]);

  // Camera State
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    type: "present" | "early-off";
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const employeeProfile = profile as Employee;

  useEffect(() => {
    checkNetwork();
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    loadData();
  }, [user, salaryStartDay]);

  const checkNetwork = async () => {
    try {
      setCheckingNetwork(true);
      const ip = await getUserIP();
      setUserIP(ip);
      const allowed = await isOnAllowedNetwork();
      setIsAllowedNetwork(allowed);
    } catch (error) {
      console.error("Error checking network:", error);
      setIsAllowedNetwork(false);
    } finally {
      setCheckingNetwork(false);
    }
  };

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const today = format(new Date(), "yyyy-MM-dd");
      const salaryMonthKey = getSalaryMonthKey(new Date(), salaryStartDay);

      // Parallel Fetching
      const [todayRecords, monthlyRecords, monthlyHolidays] = await Promise.all(
        [
          getAttendanceForDate(today, user.uid),
          getMonthlyAttendance(user.uid, salaryMonthKey),
          getMonthHolidays(salaryMonthKey),
        ]
      );

      setTodayRecord(todayRecords[0] || null);

      // Get current week holidays (excluding Sundays)
      try {
        const currentWeekHolidays = getCurrentWeekHolidays(
          monthlyHolidays || []
        );
        setWeekHolidays(currentWeekHolidays);
      } catch (err) {
        console.error("Error processing holidays:", err);
        setWeekHolidays([]);
      }

      const sortedRecords = [...(monthlyRecords || [])]
        .filter((r) => r && r.date)
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
        .slice(0, 10);
      setRecentRecords(sortedRecords);

      // Calculate Stats
      let presentDays = 0;
      let leaveDays = 0;
      let offDays = 0;
      let lateDays = 0;
      let earlyLeaveHours = 0;
      let overtimeHours = 0;

      const safeMonthlyRecords = Array.isArray(monthlyRecords)
        ? monthlyRecords
        : [];

      safeMonthlyRecords.forEach((record) => {
        switch (record.status) {
          case "present":
            presentDays++;
            break;
          case "leave":
            leaveDays++;
            break;
          case "off":
            offDays++;
            break;
          case "late":
            lateDays++;
            presentDays++; // Late is still present
            break;
        }
        if (record.earlyLeaveHours) {
          earlyLeaveHours += record.earlyLeaveHours;
        }
        if (record.overtimeHours && record.overtimeStatus === "approved") {
          overtimeHours += record.overtimeHours;
        }
      });

      const deductions = calculateDeductions(
        employeeProfile?.monthlySalary || 0,
        offDays,
        lateDays,
        earlyLeaveHours
      );

      const netSalary = calculateNetSalary(
        employeeProfile?.monthlySalary || 0,
        deductions.totalDeductions
      );

      setStats({
        presentDays,
        leaveDays,
        offDays,
        lateDays,
        earlyLeaveHours,
        estimatedNetSalary: netSalary,
      });
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load attendance data");
    } finally {
      setLoading(false);
    }
  };

  // Camera Functions
  const startCamera = async () => {
    try {
      setCameraError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setCameraError(
        "Could not access camera. Please ensure you have granted camera permissions."
      );
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const captureImage = (): string | null => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", 0.8);
      }
    }
    return null;
  };

  const handleCaptureAndSubmit = async () => {
    if (!user || !pendingAction) return;

    let imageUrl: string | undefined;
    const imageSrc = captureImage();

    try {
      setMarking(true);

      if (imageSrc) {
        try {
          // 1. Upload Image (Attempt)
          imageUrl = await uploadAttendanceImage(user.uid, imageSrc);
        } catch (uploadError) {
          console.error(
            "Image upload failed, proceeding without image:",
            uploadError
          );
          toast.error("Image upload failed. Marking attendance without photo.");
          // Proceed without imageUrl
        }
      } else {
        console.warn("Image capture failed or was skipped.");
        // Proceed without imageUrl
      }

      stopCamera(); // Stop camera immediately
      setShowCamera(false);

      // 2. Mark Attendance
      if (pendingAction.type === "present") {
        await markAttendance(
          user.uid,
          "present",
          "self",
          undefined,
          false,
          imageUrl
        );
        toast.success(
          imageUrl
            ? "Attendance marked successfully with photo!"
            : "Attendance marked successfully (no photo)"
        );
      } else if (pendingAction.type === "early-off") {
        await markAttendance(
          user.uid,
          "present",
          "self",
          undefined,
          true,
          imageUrl
        );
        toast.success(
          imageUrl
            ? "Out time marked successfully with photo!"
            : "Out time marked successfully (no photo)"
        );
      }

      await loadData();
    } catch (error: any) {
      console.error("Error marking attendance:", error);
      toast.error(error.message || "Failed to mark attendance");
    } finally {
      setMarking(false);
      setPendingAction(null);
    }
  };

  const handleSkipPhoto = async () => {
    if (!user || !pendingAction) return;

    try {
      setMarking(true);
      stopCamera();
      setShowCamera(false);

      if (pendingAction.type === "present") {
        await markAttendance(user.uid, "present", "self", undefined, false);
        toast.success("Attendance marked successfully (skipped photo)");
      } else if (pendingAction.type === "early-off") {
        await markAttendance(user.uid, "present", "self", undefined, true);
        toast.success("Out time marked successfully (skipped photo)");
      }

      await loadData();
    } catch (error: any) {
      console.error("Error marking attendance:", error);
      toast.error(error.message || "Failed to mark attendance");
    } finally {
      setMarking(false);
      setPendingAction(null);
    }
  };

  const handleMarkAttendance = async (status: "present" | "leave" | "off") => {
    if (!user) return;

    if (status === "present") {
      // Open Camera for Present
      setPendingAction({ type: "present" });
      setShowCamera(true);
      startCamera();
      return;
    }

    if (status === "leave" && !leaveReason.trim()) {
      toast.error("Please provide a reason for leave");
      return;
    }

    try {
      setMarking(true);
      await markAttendance(user.uid, status, "self", leaveReason || undefined);
      toast.success(`Marked as ${status.toUpperCase()}`);
      setLeaveReason("");
      setShowLeaveInput(false);
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to mark attendance");
    } finally {
      setMarking(false);
    }
  };

  const handleEarlyOff = async () => {
    if (!user) return;
    // Open Camera for Early Off / Out Time
    setPendingAction({ type: "early-off" });
    setShowCamera(true);
    startCamera();
  };

  const handleCloseCamera = () => {
    stopCamera();
    setShowCamera(false);
    setPendingAction(null);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      present: {
        className: "bg-green-100 text-green-700 hover:bg-green-100/80",
        label: "Present",
      },
      leave: {
        className: "bg-blue-100 text-blue-700 hover:bg-blue-100/80",
        label: "Leave",
      },
      off: {
        className: "bg-red-100 text-red-700 hover:bg-red-100/80",
        label: "Off",
      },
      late: {
        className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100/80",
        label: "Late",
      },
      holiday: {
        className: "bg-gray-100 text-gray-700 hover:bg-gray-100/80",
        label: "Holiday",
      },
    };
    const config = variants[status] || {
      className: "bg-gray-100 text-gray-700",
      label: status,
    };
    return (
      <Badge className={config.className} variant="secondary">
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto p-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const canMarkEarlyOff =
    todayRecord?.status === "present" || todayRecord?.status === "late";
  const hasMarkedToday = !!todayRecord;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-4 pb-20">
      {/* Camera Dialog */}
      <Dialog open={showCamera} onOpenChange={handleCloseCamera}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verify Identity</DialogTitle>
            <DialogDescription>
              Please capture a photo to mark your{" "}
              {pendingAction?.type === "present" ? "attendance" : "out time"}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center space-y-4 py-4">
            {cameraError ? (
              <div className="text-center text-red-500 bg-red-50 p-4 rounded-lg">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                <p>{cameraError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startCamera}
                  className="mt-2"
                >
                  <RefreshCw className="h-4 w-4 mr-2" /> Retry Camera
                </Button>
              </div>
            ) : (
              <div className="relative rounded-lg overflow-hidden bg-black aspect-video w-full flex items-center justify-center">
                {!stream && (
                  <div className="absolute inset-0 flex items-center justify-center text-white/50">
                    <Camera className="h-12 w-12 animate-pulse" />
                  </div>
                )}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  onLoadedMetadata={() => videoRef.current?.play()}
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>
            )}
          </div>
          <DialogFooter className="sm:justify-between gap-2">
            <Button variant="ghost" onClick={handleCloseCamera}>
              Cancel
            </Button>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={handleSkipPhoto}
                disabled={marking}
              >
                Skip Photo
              </Button>
              <Button
                onClick={handleCaptureAndSubmit}
                disabled={!stream || marking}
                className="w-full sm:w-auto"
              >
                {marking ? (
                  <>
                    <div className="h-4 w-4 mr-2 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 mr-2" />
                    Capture & Mark
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Holiday Alert - Current Week */}
      {weekHolidays.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border border-purple-200 dark:border-purple-800 rounded-lg p-4 flex items-start gap-3 shadow-sm">
          <PartyPopper className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-purple-900 dark:text-purple-100 flex items-center gap-2">
              🎉 Upcoming Holidays This Week
            </h3>
            <div className="mt-2 space-y-1">
              {weekHolidays.map((holiday, index) => (
                <p
                  key={index}
                  className="text-sm text-purple-700 dark:text-purple-300"
                >
                  📅 {formatHolidayDisplay(holiday)}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Network Status Alert */}
      {!checkingNetwork && !isAllowedNetwork && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
          <WifiOff className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900 dark:text-amber-100">
              Not on Office WiFi
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              You must be connected to the office WiFi network (IP:{" "}
              {getAllowedIP()}) to mark <strong>Present</strong> or{" "}
              <strong>Mark Out Time</strong>. However, you can still mark{" "}
              <strong>Leave</strong> or <strong>Off</strong> from any network.
              <br />
              Your current IP: {userIP || "Unknown"}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {getGreeting()},{" "}
            <span className="text-primary">
              {user?.displayName?.split(" ")[0] || "Employee"}
            </span>
          </h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {format(new Date(), "EEEE, MMMM dd, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Network Status Badge */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
              checkingNetwork
                ? "bg-gray-50 border-gray-200"
                : isAllowedNetwork
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            {checkingNetwork ? (
              <>
                <div className="h-4 w-4 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
                <span className="text-xs font-medium text-gray-600">
                  Checking...
                </span>
              </>
            ) : isAllowedNetwork ? (
              <>
                <Wifi className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium text-green-700">
                  Office WiFi
                </span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-600" />
                <span className="text-xs font-medium text-red-700">
                  Not Connected
                </span>
              </>
            )}
          </div>

          {/* Salary Display */}
          <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Est. Net Salary
              </p>
              <p className="text-lg font-bold text-primary leading-none">
                {currencySymbol}
                {stats?.estimatedNetSalary?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Action Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Card */}
        <Card className="lg:col-span-2 border-none shadow-lg bg-gradient-to-br from-white to-gray-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Today's Attendance
            </CardTitle>
            <CardDescription>
              {hasMarkedToday
                ? `Status: ${todayRecord.status.toUpperCase()}`
                : "Mark your attendance for today"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!hasMarkedToday ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Button
                    onClick={() => handleMarkAttendance("present")}
                    disabled={marking || !isAllowedNetwork || checkingNetwork}
                    className="h-24 flex flex-col gap-2 text-lg hover:scale-105 transition-transform bg-green-600 hover:bg-green-700 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle className="h-8 w-8" />
                    Present
                  </Button>
                  <Button
                    onClick={() => setShowLeaveInput(!showLeaveInput)}
                    disabled={marking}
                    variant="outline"
                    className="h-24 flex flex-col gap-2 text-lg hover:scale-105 transition-transform border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
                  >
                    <Coffee className="h-8 w-8" />
                    Leave
                  </Button>
                  <Button
                    onClick={() => handleMarkAttendance("off")}
                    disabled={marking}
                    variant="destructive"
                    className="h-24 flex flex-col gap-2 text-lg hover:scale-105 transition-transform shadow-md"
                  >
                    <XCircle className="h-8 w-8" />
                    Off
                  </Button>
                </div>

                {showLeaveInput && (
                  <div className="space-y-3 p-4 bg-white rounded-lg border shadow-sm animate-in fade-in slide-in-from-top-2">
                    <Label htmlFor="leaveReason">Reason for Leave</Label>
                    <Textarea
                      id="leaveReason"
                      placeholder="Please describe why you are taking leave..."
                      value={leaveReason}
                      onChange={(e) => setLeaveReason(e.target.value)}
                      className="resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => setShowLeaveInput(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => handleMarkAttendance("leave")}
                        disabled={marking || !leaveReason.trim()}
                      >
                        Submit Request
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-20"></div>
                  <div className="h-24 w-24 rounded-full bg-green-100 flex items-center justify-center relative z-10">
                    <CheckCircle className="h-12 w-12 text-green-600" />
                  </div>
                </div>

                <div className="text-center space-y-1">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {todayRecord.outTime
                      ? "You're all done for today!"
                      : "You're checked in!"}
                  </h3>
                  <p className="text-muted-foreground">
                    {todayRecord.outTime
                      ? `Out time marked at ${formatTime(todayRecord.outTime)}`
                      : `In time marked at ${formatTime(todayRecord.inTime)}`}
                  </p>
                </div>

                {canMarkEarlyOff && !todayRecord.outTime && (
                  <Button
                    onClick={handleEarlyOff}
                    disabled={marking || !isAllowedNetwork || checkingNetwork}
                    size="lg"
                    variant="outline"
                    className="w-full max-w-sm border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:text-orange-800 hover:border-orange-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Clock className="mr-2 h-5 w-5" />
                    {new Date().getHours() >= 18
                      ? "Mark Out Time"
                      : "Mark Early Off"}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats Column */}
        <div className="space-y-6">
          <Card className="border-none shadow-md bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Monthly Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-green-200 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-green-700" />
                  </div>
                  <span className="font-medium text-gray-700">Present</span>
                </div>
                <span className="text-xl font-bold text-green-700">
                  {stats?.presentDays || 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-yellow-200 flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 text-yellow-700" />
                  </div>
                  <span className="font-medium text-gray-700">Late</span>
                </div>
                <span className="text-xl font-bold text-yellow-700">
                  {stats?.lateDays || 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-blue-200 flex items-center justify-center">
                    <Coffee className="h-4 w-4 text-blue-700" />
                  </div>
                  <span className="font-medium text-gray-700">Leaves</span>
                </div>
                <span className="text-xl font-bold text-blue-700">
                  {stats?.leaveDays || 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-orange-200 flex items-center justify-center">
                    <Timer className="h-4 w-4 text-orange-700" />
                  </div>
                  <span className="font-medium text-gray-700">Early Leave</span>
                </div>
                <span className="text-xl font-bold text-orange-700">
                  {stats?.earlyLeaveHours || 0}h
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity Table */}
      <Card className="border-none shadow-md overflow-hidden">
        <CardHeader className="bg-gray-50/50 border-b">
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your last 10 attendance records</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[150px]">Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead className="text-right">Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentRecords.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No recent records found
                  </TableCell>
                </TableRow>
              ) : (
                recentRecords.map((record) => {
                  // Calculate duration if both times exist
                  let duration = "-";
                  const inDate = getSafeDate(record.inTime);
                  const outDate = getSafeDate(record.outTime);

                  if (inDate && outDate) {
                    const diff = outDate.getTime() - inDate.getTime();
                    const hours = Math.floor(diff / (1000 * 60 * 60));
                    const mins = Math.floor(
                      (diff % (1000 * 60 * 60)) / (1000 * 60)
                    );
                    duration = `${hours}h ${mins}m`;
                  }

                  return (
                    <TableRow key={record.date} className="hover:bg-gray-50/50">
                      <TableCell className="font-medium">
                        {format(new Date(record.date), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatTime(record.inTime)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatTime(record.outTime)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {duration}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
