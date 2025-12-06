import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import { getMonthlyAttendance, getHoliday } from '../../lib/firestore';
import { getSalaryMonthKey, getSalaryMonthDates } from "../../lib/salary";
import { AttendanceRecord } from '../../types';
import { toast } from 'sonner';

import { useSettings } from '../../context/SettingsContext';

export const EmployeeCalendar: React.FC = () => {
  const { salaryStartDay } = useSettings();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [records, setRecords] = useState<Map<string, AttendanceRecord>>(new Map());
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<AttendanceRecord | null>(null);

  useEffect(() => {
    loadCalendarData();
  }, [currentMonth, user, salaryStartDay]);

  const loadCalendarData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const salaryMonthKey = getSalaryMonthKey(currentMonth, salaryStartDay);
      
      // Load attendance records
      const monthlyRecords = await getMonthlyAttendance(user.uid, salaryMonthKey);
      const recordsMap = new Map<string, AttendanceRecord>();
      monthlyRecords.forEach(record => {
        recordsMap.set(record.date, record);
      });
      setRecords(recordsMap);

      // Load holidays
      const { start, end } = getSalaryMonthDates(salaryMonthKey, salaryStartDay);
      const allDays = eachDayOfInterval({ start, end });
      const holidaySet = new Set<string>();
      
      for (const day of allDays) {
        const dateStr = format(day, 'yyyy-MM-dd');
        const holiday = await getHoliday(dateStr);
        if (holiday) {
          holidaySet.add(dateStr);
        }
      }
      setHolidays(holidaySet);

    } catch (error) {
      console.error('Error loading calendar:', error);
      toast.error('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  const getDayColor = (dateStr: string): string => {
    if (holidays.has(dateStr)) return 'bg-yellow-200 hover:bg-yellow-300';
    
    const record = records.get(dateStr);
    if (!record) return 'bg-white hover:bg-gray-50';

    switch (record.status) {
      case 'present':
        return 'bg-green-200 hover:bg-green-300';
      case 'leave':
        return 'bg-blue-200 hover:bg-blue-300';
      case 'off':
        return 'bg-red-200 hover:bg-red-300';
      case 'late':
        return 'bg-orange-200 hover:bg-orange-300';
      default:
        return 'bg-white hover:bg-gray-50';
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleDayClick = (dateStr: string) => {
    const record = records.get(dateStr);
    setSelectedDate(record || null);
  };

  const salaryMonthKey = getSalaryMonthKey(currentMonth, salaryStartDay);
  const { start: monthStart, end: monthEnd } = getSalaryMonthDates(salaryMonthKey, salaryStartDay);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get first day of month to calculate offset
  const firstDayOfWeek = monthStart.getDay();

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{format(currentMonth, 'MMMM yyyy')}</CardTitle>
            <div className="flex gap-2">
              <Button onClick={handlePrevMonth} variant="outline" size="sm">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button onClick={handleNextMonth} variant="outline" size="sm">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Day headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center font-semibold text-sm p-2">
                {day}
              </div>
            ))}

            {/* Empty cells for offset */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="p-2" />
            ))}

            {/* Calendar days */}
            {calendarDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const isToday = isSameDay(day, new Date());
              const dayColor = getDayColor(dateStr);

              return (
                <button
                  key={dateStr}
                  onClick={() => handleDayClick(dateStr)}
                  className={`
                    p-3 rounded-lg border-2 transition-all
                    ${dayColor}
                    ${isToday ? 'border-primary ring-2 ring-primary/50' : 'border-transparent'}
                  `}
                >
                  <div className="text-center">
                    <div className="font-semibold">{format(day, 'd')}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 flex flex-wrap gap-4 justify-center">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-200 rounded border" />
              <span className="text-sm">Present</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-200 rounded border" />
              <span className="text-sm">Leave</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-red-200 rounded border" />
              <span className="text-sm">Off</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-yellow-200 rounded border" />
              <span className="text-sm">Holiday</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-orange-200 rounded border" />
              <span className="text-sm">Late</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Date Details */}
      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle>
              {format(new Date(selectedDate.date), 'MMMM dd, yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Status:</span>
              <Badge variant={
                selectedDate.status === 'present' ? 'success' :
                selectedDate.status === 'leave' ? 'default' :
                selectedDate.status === 'off' ? 'destructive' :
                selectedDate.status === 'late' ? 'warning' : 'secondary'
              }>
                {selectedDate.status.toUpperCase()}
              </Badge>
            </div>
            {selectedDate.inTime && (
              <div>
                <span className="font-semibold">In Time:</span>{' '}
                {format(selectedDate.inTime.toDate(), 'hh:mm a')}
              </div>
            )}
            {selectedDate.outTime && (
              <div>
                <span className="font-semibold">Out Time:</span>{' '}
                {format(selectedDate.outTime.toDate(), 'hh:mm a')}
              </div>
            )}
            {selectedDate.leaveReason && (
              <div>
                <span className="font-semibold">Reason:</span>{' '}
                {selectedDate.leaveReason}
              </div>
            )}
            {selectedDate.earlyLeaveHours && selectedDate.earlyLeaveHours > 0 && (
              <div>
                <span className="font-semibold">Early Leave:</span>{' '}
                {selectedDate.earlyLeaveHours} hours
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
