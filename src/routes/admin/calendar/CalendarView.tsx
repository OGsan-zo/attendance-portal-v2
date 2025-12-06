import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Select } from '../../../components/ui/select';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import { Button } from '../../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { ChevronLeft, ChevronRight, Clock, Calendar as CalendarIcon, Info } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth } from 'date-fns';
import { getAllEmployees, getMonthlyAttendance, getHoliday } from '../../../lib/firestore';
import { getSalaryMonthKey, getSalaryMonthDates } from "../../../lib/salary";
import { Employee, AttendanceRecord, Holiday } from '../../../types';
import { toast } from 'sonner';

export const CalendarView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [records, setRecords] = useState<Map<string, AttendanceRecord>>(new Map());
  const [holidays, setHolidays] = useState<Map<string, Holiday>>(new Map());
  
  // Modal State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDateDetails, setSelectedDateDetails] = useState<{
    date: Date;
    record?: AttendanceRecord;
    holiday?: Holiday;
  } | null>(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      loadCalendarData();
    }
  }, [selectedEmployee, currentMonth]);

  const loadEmployees = async () => {
    try {
      const data = await getAllEmployees();
      setEmployees(data);
      if (data.length > 0) {
        setSelectedEmployee(data[0].uid);
      }
    } catch (error) {
      toast.error('Failed to load employees');
    }
  };

  const loadCalendarData = async () => {
    if (!selectedEmployee) return;

    try {
      setLoading(true);
      const salaryMonthKey = getSalaryMonthKey(currentMonth);
      
      const monthlyRecords = await getMonthlyAttendance(selectedEmployee, salaryMonthKey);
      const recordsMap = new Map<string, AttendanceRecord>();
      monthlyRecords.forEach(record => {
        recordsMap.set(record.date, record);
      });
      setRecords(recordsMap);

      const { start, end } = getSalaryMonthDates(salaryMonthKey);
      const allDays = eachDayOfInterval({ start, end });
      const holidayMap = new Map<string, Holiday>();
      
      for (const day of allDays) {
        const dateStr = format(day, 'yyyy-MM-dd');
        const holiday = await getHoliday(dateStr);
        if (holiday) {
          holidayMap.set(dateStr, holiday);
        }
      }
      setHolidays(holidayMap);

    } catch (error) {
      toast.error('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  const getDayStyle = (dateStr: string, isCurrentMonth: boolean) => {
    const baseStyle = "h-24 w-full p-2 border rounded-lg flex flex-col items-start justify-start transition-all hover:shadow-md relative";
    const opacity = isCurrentMonth ? "opacity-100" : "opacity-40";
    
    if (holidays.has(dateStr)) {
      return `${baseStyle} ${opacity} bg-yellow-50 border-yellow-200 hover:bg-yellow-100`;
    }
    
    const record = records.get(dateStr);
    if (!record) return `${baseStyle} ${opacity} bg-white hover:bg-gray-50`;

    switch (record.status) {
      case 'present':
        return `${baseStyle} ${opacity} bg-green-50 border-green-200 hover:bg-green-100`;
      case 'leave':
        return `${baseStyle} ${opacity} bg-emerald-50 border-emerald-200 hover:bg-emerald-100`;
      case 'off':
        return `${baseStyle} ${opacity} bg-red-50 border-red-200 hover:bg-red-100`;
      case 'late':
        return `${baseStyle} ${opacity} bg-orange-50 border-orange-200 hover:bg-orange-100`;
      default:
        return `${baseStyle} ${opacity} bg-white hover:bg-gray-50`;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present': return <Badge className="bg-green-500">Present</Badge>;
      case 'leave': return <Badge className="bg-emerald-500">Leave</Badge>;
      case 'off': return <Badge variant="destructive">Off</Badge>;
      case 'late': return <Badge className="bg-orange-500">Late</Badge>;
      case 'holiday': return <Badge className="bg-yellow-500 text-black">Holiday</Badge>;
      default: return null;
    }
  };

  const handleDayClick = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const record = records.get(dateStr);
    const holiday = holidays.get(dateStr);

    setSelectedDateDetails({
      date: day,
      record,
      holiday
    });
    setIsDialogOpen(true);
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOfWeek = monthStart.getDay();

  if (loading && employees.length === 0) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Calendar View</h1>
        <p className="text-muted-foreground">View employee attendance calendar</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <CardTitle>Employee Calendar</CardTitle>
              <Select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-64"
              >
                {employees.map(emp => (
                  <option key={emp.uid} value={emp.uid}>
                    {emp.name} ({emp.empId})
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-semibold text-lg">{format(currentMonth, 'MMMM yyyy')}</span>
              <div className="flex gap-2">
                <Button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} variant="outline" size="icon">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} variant="outline" size="icon">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Legend */}
          <div className="mb-6 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 border border-green-200 rounded" />
              <span>Present</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-emerald-100 border border-emerald-200 rounded" />
              <span>Leave</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-100 border border-orange-200 rounded" />
              <span>Late</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 border border-red-200 rounded" />
              <span>Off</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-100 border border-yellow-200 rounded" />
              <span>Holiday</span>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center font-semibold text-muted-foreground py-2">
                {day}
              </div>
            ))}

            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-24" />
            ))}

            {calendarDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const record = records.get(dateStr);
              const holiday = holidays.get(dateStr);
              const isCurrent = isSameMonth(day, currentMonth);

              return (
                <button
                  key={dateStr}
                  onClick={() => handleDayClick(day)}
                  className={getDayStyle(dateStr, isCurrent)}
                >
                  <span className="font-semibold mb-1">{format(day, 'd')}</span>
                  
                  {holiday && (
                    <span className="text-xs text-yellow-700 font-medium truncate w-full text-left">
                      {holiday.reason || 'Holiday'}
                    </span>
                  )}
                  
                  {record && (
                    <div className="flex flex-col items-start w-full gap-1">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full w-fit
                        ${record.status === 'present' ? 'bg-green-200 text-green-800' :
                          record.status === 'leave' ? 'bg-emerald-200 text-emerald-800' :
                          record.status === 'late' ? 'bg-orange-200 text-orange-800' :
                          record.status === 'off' ? 'bg-red-200 text-red-800' : ''}
                      `}>
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </span>
                      {record.inTime && (
                        <span className="text-[10px] text-muted-foreground">
                          In: {format(record.inTime.toDate(), 'hh:mm a')}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              {selectedDateDetails && format(selectedDateDetails.date, 'MMMM dd, yyyy')}
            </DialogTitle>
            <DialogDescription>
              Daily attendance details
            </DialogDescription>
          </DialogHeader>

          {selectedDateDetails && (
            <div className="space-y-4 py-4">
              {/* Status Section */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="font-medium">Status</span>
                {selectedDateDetails.holiday ? (
                  getStatusBadge('holiday')
                ) : selectedDateDetails.record ? (
                  getStatusBadge(selectedDateDetails.record.status)
                ) : (
                  <Badge variant="outline">No Record</Badge>
                )}
              </div>

              {/* Holiday Details */}
              {selectedDateDetails.holiday && (
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2 text-yellow-600">
                    <Info className="h-4 w-4" /> Holiday Information
                  </h4>
                  <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
                    <p className="text-sm font-medium text-yellow-900">
                      Reason: {selectedDateDetails.holiday.reason || 'Public Holiday'}
                    </p>
                  </div>
                </div>
              )}

              {/* Attendance Details */}
              {selectedDateDetails.record && (
                <div className="space-y-4">
                  {/* Timings */}
                  {(selectedDateDetails.record.status === 'present' || selectedDateDetails.record.status === 'late') && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase font-bold">
                          <Clock className="h-3 w-3" /> In Time
                        </div>
                        <div className="font-mono font-medium">
                          {selectedDateDetails.record.inTime 
                            ? format(selectedDateDetails.record.inTime.toDate(), 'hh:mm a')
                            : '--:--'}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase font-bold">
                          <Clock className="h-3 w-3" /> Out Time
                        </div>
                        <div className="font-mono font-medium">
                          {selectedDateDetails.record.outTime 
                            ? format(selectedDateDetails.record.outTime.toDate(), 'hh:mm a')
                            : '--:--'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Leave Details */}
                  {selectedDateDetails.record.status === 'leave' && (
                    <div className="space-y-2">
                      <h4 className="font-semibold flex items-center gap-2 text-emerald-600">
                        <Info className="h-4 w-4" /> Leave Details
                      </h4>
                      <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                        <p className="text-sm font-medium text-emerald-900">
                          Reason: {selectedDateDetails.record.leaveReason || 'No reason provided'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Off Details */}
                  {selectedDateDetails.record.status === 'off' && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                      <p className="text-sm font-medium text-red-900">
                        Weekly Off / Non-working Day
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
