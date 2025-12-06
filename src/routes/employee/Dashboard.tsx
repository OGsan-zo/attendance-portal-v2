import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Skeleton } from '../../components/ui/skeleton';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import { CheckCircle, XCircle, Coffee, Clock } from 'lucide-react';
import { markAttendance, getAttendanceForDate, getMonthlyAttendance } from '../../lib/firestore';
import { getSalaryMonthKey, calculateDeductions, calculateNetSalary } from "../../lib/salary";
import { AttendanceRecord, Employee, AttendanceStats } from '../../types';
import { useSettings } from '../../context/SettingsContext';

export const EmployeeDashboard: React.FC = () => {
  const { currencySymbol, salaryStartDay } = useSettings();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [leaveReason, setLeaveReason] = useState('');
  const [showLeaveInput, setShowLeaveInput] = useState(false);

  const employeeProfile = profile as Employee;

  useEffect(() => {
    loadData();
  }, [user, salaryStartDay]);

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Load today's record
      const today = format(new Date(), 'yyyy-MM-dd');
      const todayRecords = await getAttendanceForDate(today, user.uid);
      setTodayRecord(todayRecords[0] || null);

      // Load recent 10 days
      const recent: AttendanceRecord[] = [];
      for (let i = 0; i < 10; i++) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        const records = await getAttendanceForDate(date, user.uid);
        if (records[0]) {
          recent.push(records[0]);
        }
      }
      setRecentRecords(recent);

      // Load monthly stats
      const salaryMonthKey = getSalaryMonthKey(new Date(), salaryStartDay);
      const monthlyRecords = await getMonthlyAttendance(user.uid, salaryMonthKey);
      
      let presentDays = 0;
      let leaveDays = 0;
      let offDays = 0;
      let lateDays = 0;
      let earlyLeaveHours = 0;

      monthlyRecords.forEach(record => {
        switch (record.status) {
          case 'present':
            presentDays++;
            break;
          case 'leave':
            leaveDays++;
            break;
          case 'off':
            offDays++;
            break;
          case 'late':
            lateDays++;
            presentDays++; // Late is still present
            break;
        }
        if (record.earlyLeaveHours) {
          earlyLeaveHours += record.earlyLeaveHours;
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
      console.error('Error loading data:', error);
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAttendance = async (status: 'present' | 'leave' | 'off') => {
    if (!user) return;

    if (status === 'leave' && !leaveReason.trim()) {
      toast.error('Please provide a reason for leave');
      return;
    }

    try {
      setMarking(true);
      await markAttendance(user.uid, status, 'self', leaveReason || undefined);
      toast.success(`Marked as ${status.toUpperCase()}`);
      setLeaveReason('');
      setShowLeaveInput(false);
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to mark attendance');
    } finally {
      setMarking(false);
    }
  };

  const handleEarlyOff = async () => {
    if (!user) return;

    try {
      setMarking(true);
      await markAttendance(user.uid, 'present', 'self', undefined, true);
      toast.success('Marked early off');
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to mark early off');
    } finally {
      setMarking(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      present: { variant: 'success', label: 'Present' },
      leave: { variant: 'default', label: 'Leave' },
      off: { variant: 'destructive', label: 'Off' },
      late: { variant: 'warning', label: 'Late' },
      holiday: { variant: 'secondary', label: 'Holiday' },
    };
    const config = variants[status] || { variant: 'outline', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const canMarkEarlyOff = todayRecord?.status === 'present' || todayRecord?.status === 'late';
  const hasMarkedToday = !!todayRecord;

  return (
    <div className="space-y-6">
      {/* Mark Attendance Section */}
      <Card>
        <CardHeader>
          <CardTitle>Mark Attendance</CardTitle>
          <CardDescription>
            {hasMarkedToday
              ? `You have already marked attendance as ${todayRecord.status.toUpperCase()}`
              : 'Mark your attendance for today'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasMarkedToday ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  onClick={() => handleMarkAttendance('present')}
                  disabled={marking}
                  size="lg"
                  className="h-20 text-lg"
                >
                  <CheckCircle className="mr-2 h-6 w-6" />
                  Mark Present
                </Button>
                <Button
                  onClick={() => setShowLeaveInput(!showLeaveInput)}
                  disabled={marking}
                  variant="outline"
                  size="lg"
                  className="h-20 text-lg"
                >
                  <Coffee className="mr-2 h-6 w-6" />
                  Mark Leave
                </Button>
                <Button
                  onClick={() => handleMarkAttendance('off')}
                  disabled={marking}
                  variant="destructive"
                  size="lg"
                  className="h-20 text-lg"
                >
                  <XCircle className="mr-2 h-6 w-6" />
                  Mark Off
                </Button>
              </div>

              {showLeaveInput && (
                <div className="space-y-2">
                  <Label htmlFor="leaveReason">Leave Reason</Label>
                  <Textarea
                    id="leaveReason"
                    placeholder="Enter reason for leave..."
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                  />
                  <Button
                    onClick={() => handleMarkAttendance('leave')}
                    disabled={marking || !leaveReason.trim()}
                  >
                    Submit Leave
                  </Button>
                </div>
              )}
            </>
          ) : canMarkEarlyOff && !todayRecord.outTime ? (
            <Button
              onClick={handleEarlyOff}
              disabled={marking}
              variant="outline"
              size="lg"
              className="w-full h-16 text-lg"
            >
              <Clock className="mr-2 h-6 w-6" />
              {new Date().getHours() >= 18 ? 'Mark Out Time' : 'Mark Early Off'}
            </Button>
          ) : (
            <div className="text-center space-y-2">
              <p className="text-muted-foreground text-lg font-medium">
                {todayRecord?.outTime ? 'Marked Today Out Time' : 'Attendance marked for today. See you tomorrow!'}
              </p>
              {todayRecord?.outTime && (
                <p className="text-sm text-muted-foreground">
                  Out Time: {format(todayRecord.outTime.toDate(), 'hh:mm a')}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Section */}
      <Card>
        <CardHeader>
          <CardTitle>Current Month Statistics</CardTitle>
          <CardDescription>
            Salary Month: {format(new Date(), 'MMMM yyyy')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-3xl font-bold text-green-600">{stats?.presentDays || 0}</p>
              <p className="text-sm text-muted-foreground">Present Days</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-3xl font-bold text-blue-600">{stats?.leaveDays || 0}</p>
              <p className="text-sm text-muted-foreground">Leave Days</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-3xl font-bold text-red-600">{stats?.offDays || 0}</p>
              <p className="text-sm text-muted-foreground">Off Days</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-3xl font-bold text-yellow-600">{stats?.lateDays || 0}</p>
              <p className="text-sm text-muted-foreground">Late Days</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <p className="text-3xl font-bold text-orange-600">{stats?.earlyLeaveHours || 0}</p>
              <p className="text-sm text-muted-foreground">Early Leave Hours</p>
            </div>
            <div className="text-center p-4 bg-primary/10 rounded-lg">
              <p className="text-3xl font-bold text-primary">
                {currencySymbol}{stats?.estimatedNetSalary?.toLocaleString() || 0}
              </p>
              <p className="text-sm text-muted-foreground">Estimated Net Salary</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Attendance */}
      <Card>
        <CardHeader>
          <CardTitle>Last 10 Days</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>In Time</TableHead>
                <TableHead>Out Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No attendance records found
                  </TableCell>
                </TableRow>
              ) : (
                recentRecords.map((record) => (
                  <TableRow key={record.date}>
                    <TableCell>{format(new Date(record.date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell>
                      {record.inTime ? format(record.inTime.toDate(), 'hh:mm a') : '-'}
                    </TableCell>
                    <TableCell>
                      {record.outTime ? format(record.outTime.toDate(), 'hh:mm a') : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
