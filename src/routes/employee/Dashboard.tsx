import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import {
  markAttendance,
  getAttendanceForDate,
  getMonthlyAttendance,
} from "../../lib/firestore";
import {
  getSalaryMonthKey,
  calculateDeductions,
  calculateNetSalary,
} from "../../lib/salary";
import { AttendanceRecord, Employee, AttendanceStats } from "../../types";
import { useSettings } from "../../context/SettingsContext";

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

  const employeeProfile = profile as Employee;

  useEffect(() => {
    loadData();
  }, [user, salaryStartDay]);

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const today = format(new Date(), "yyyy-MM-dd");
      const salaryMonthKey = getSalaryMonthKey(new Date(), salaryStartDay);

      // Parallel Fetching
      const [todayRecords, monthlyRecords] = await Promise.all([
        getAttendanceForDate(today, user.uid),
        getMonthlyAttendance(user.uid, salaryMonthKey),
      ]);

      setTodayRecord(todayRecords[0] || null);

      // Process Recent Records (Last 10 from monthly or fetch if needed)
      // For simplicity and speed, we'll just use the last 10 from the monthly records if available,
      // otherwise we might need a separate query if we want strictly last 10 days crossing months.
      // But for "Recent Activity" showing current month's latest is usually sufficient and faster.
      // If we really need cross-month, we can fetch separately. Let's stick to a simple recent list for now.
      const sortedRecords = [...monthlyRecords]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 10);
      setRecentRecords(sortedRecords);

      // Calculate Stats
      let presentDays = 0;
      let leaveDays = 0;
      let offDays = 0;
      let lateDays = 0;
      let earlyLeaveHours = 0;
      let overtimeHours = 0;

      monthlyRecords.forEach((record) => {
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

  const handleMarkAttendance = async (status: "present" | "leave" | "off") => {
    if (!user) return;

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

    try {
      setMarking(true);
      await markAttendance(user.uid, "present", "self", undefined, true);
      toast.success("Marked out time");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to mark out time");
    } finally {
      setMarking(false);
    }
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
                    disabled={marking}
                    className="h-24 flex flex-col gap-2 text-lg hover:scale-105 transition-transform bg-green-600 hover:bg-green-700 shadow-md"
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
                      ? `Out time marked at ${format(
                          todayRecord.outTime.toDate(),
                          "hh:mm a"
                        )}`
                      : `In time marked at ${
                          todayRecord.inTime
                            ? format(todayRecord.inTime.toDate(), "hh:mm a")
                            : "-"
                        }`}
                  </p>
                </div>

                {canMarkEarlyOff && !todayRecord.outTime && (
                  <Button
                    onClick={handleEarlyOff}
                    disabled={marking}
                    size="lg"
                    variant="outline"
                    className="w-full max-w-sm border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:text-orange-800 hover:border-orange-300 transition-all"
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
                  if (record.inTime && record.outTime) {
                    const diff =
                      record.outTime.toDate().getTime() -
                      record.inTime.toDate().getTime();
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
                        {record.inTime
                          ? format(record.inTime.toDate(), "hh:mm a")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {record.outTime
                          ? format(record.outTime.toDate(), "hh:mm a")
                          : "-"}
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
