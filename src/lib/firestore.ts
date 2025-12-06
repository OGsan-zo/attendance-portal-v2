import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  Admin, 
  Employee, 
  AttendanceRecord, 
  Holiday, 
  SalaryReport,
  AttendanceStatus,
  PortalSettings
} from '../types';
import { format, eachDayOfInterval } from 'date-fns';
import { 
  getSalaryMonthKey, 
  calculateDeductions, 
  calculateNetSalary, 
  isLate, 
  calculateEarlyLeaveHours, 
  getSalaryMonthDates,
  calculateOvertimeHours 
} from './salary';
import { getAllSundaysInYear } from './holidays';

// ==================== ADMIN OPERATIONS ====================

export const addAdmin = async (uid: string, email: string, name: string) => {
  const adminData: Omit<Admin, 'uid'> = {
    name,
    email,
    role: 'admin',
    createdAt: serverTimestamp() as Timestamp,
  };

  await setDoc(doc(db, 'admins', uid), adminData);
};

export const getAdmin = async (uid: string): Promise<Admin | null> => {
  const adminDoc = await getDoc(doc(db, 'admins', uid));
  if (!adminDoc.exists()) return null;
  
  return { uid, ...adminDoc.data() } as Admin;
};

export const getAllAdmins = async (): Promise<Admin[]> => {
  const adminsSnapshot = await getDocs(collection(db, 'admins'));
  return adminsSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Admin));
};

// ==================== EMPLOYEE OPERATIONS ====================

export const addEmployee = async (
  uid: string,
  email: string,
  name: string,
  empId: string,
  monthlySalary: number,
  createdBy: string
) => {
  const employeeData: Omit<Employee, 'uid'> = {
    name,
    email,
    empId,
    monthlySalary,
    createdBy,
    createdAt: serverTimestamp() as Timestamp,
    isActive: true,
  };

  await setDoc(doc(db, 'employees', uid), employeeData);
};

export const toggleEmployeeStatus = async (uid: string, isActive: boolean) => {
  await updateDoc(doc(db, 'employees', uid), { isActive });
};

export const updateEmployee = async (
  uid: string,
  updates: Partial<Omit<Employee, 'uid' | 'createdAt' | 'createdBy'>>
) => {
  await updateDoc(doc(db, 'employees', uid), updates);
};

export const getEmployee = async (uid: string): Promise<Employee | null> => {
  const employeeDoc = await getDoc(doc(db, 'employees', uid));
  if (!employeeDoc.exists()) return null;
  
  return { uid, ...employeeDoc.data() } as Employee;
};

export const getAllEmployees = async (): Promise<Employee[]> => {
  const employeesSnapshot = await getDocs(collection(db, 'employees'));
  return employeesSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Employee));
};

export const deleteEmployee = async (uid: string) => {
  await deleteDoc(doc(db, 'employees', uid));
};

// ==================== SETTINGS OPERATIONS ====================

export const getPortalSettings = async (): Promise<PortalSettings | null> => {
  const settingsDoc = await getDoc(doc(db, 'settings', 'portal'));
  if (!settingsDoc.exists()) return null;
  return settingsDoc.data() as PortalSettings;
};

export const updatePortalSettings = async (settings: Partial<PortalSettings>) => {
  await setDoc(doc(db, 'settings', 'portal'), {
    ...settings,
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

// ==================== ATTENDANCE OPERATIONS ====================

export const markAttendance = async (
  employeeUid: string,
  status: AttendanceStatus,
  markedBy: string,
  leaveReason?: string,
  isEarlyOff: boolean = false
) => {
  const settings = await getPortalSettings();
  const startDay = settings?.salaryStartDay || 6;
  const officeStartTime = settings?.officeStartTime || "10:00";
  const officeEndTime = settings?.officeEndTime || "18:00";
  const lateBuffer = settings?.lateMarkAfterMinutes || 15;

  const now = new Date();
  const dateStr = format(now, 'yyyy-MM-dd');
  const salaryMonthKey = getSalaryMonthKey(now, startDay);
  
  const attendanceCollectionPath = `attendance_${salaryMonthKey}`;
  const dateDocPath = `${attendanceCollectionPath}/${dateStr}`;
  const recordPath = `${dateDocPath}/records/${employeeUid}`;

  // Check if already marked
  const existingRecord = await getDoc(doc(db, recordPath));
  
  if (isEarlyOff && existingRecord.exists()) {
    // Mark early off - update existing record
    const outTime = Timestamp.now();
    const earlyLeaveHours = calculateEarlyLeaveHours(outTime.toDate(), officeEndTime);
    const overtimeHours = calculateOvertimeHours(outTime.toDate(), officeEndTime);
    
    const updates: any = {
      outTime,
      earlyLeaveHours,
      updatedAt: serverTimestamp(),
    };

    if (overtimeHours > 0) {
      updates.overtimeHours = overtimeHours;
      updates.overtimeStatus = 'approved';
      updates.overtimeReason = null;
    } else {
      updates.overtimeHours = 0;
      updates.overtimeStatus = null;
      updates.overtimeReason = null;
    }

    await updateDoc(doc(db, recordPath), updates);
    return;
  }

  if (existingRecord.exists() && !isEarlyOff) {
    throw new Error('Attendance already marked for today');
  }

  // Determine if late
  const inTime = Timestamp.now();
  const isLateMark = status === 'present' && isLate(inTime.toDate(), officeStartTime, lateBuffer);
  const finalStatus: AttendanceStatus = isLateMark ? 'late' : status;

  const recordData: Record<string, any> = {
    status: finalStatus,
    markedBy,
    createdAt: serverTimestamp() as Timestamp,
  };

  if (status === 'present' || finalStatus === 'late') {
    recordData.inTime = inTime;
  }

  if (status === 'leave' && leaveReason) {
    recordData.leaveReason = leaveReason;
  }

  if (isLateMark) {
    recordData.lateMinutes = calculateLateMinutes(inTime.toDate(), officeStartTime, lateBuffer);
  }

  // Ensure parent date document exists
  await setDoc(doc(db, dateDocPath), { date: dateStr }, { merge: true });

  await setDoc(doc(db, recordPath), {
    ...recordData,
    employeeUid,
    date: dateStr,
  });
};

const calculateLateMinutes = (time: Date, startTime: string = "10:00", bufferMinutes: number = 15): number => {
  const hours = time.getHours();
  const minutes = time.getMinutes();
  
  const [startHour, startMinute] = startTime.split(':').map(Number);
  
  const thresholdMinutes = startHour * 60 + startMinute + bufferMinutes;
  const currentMinutes = hours * 60 + minutes;
  return Math.max(0, currentMinutes - thresholdMinutes);
};

export const getAttendanceForDate = async (
  dateStr: string,
  employeeUid?: string
): Promise<AttendanceRecord[]> => {
  const settings = await getPortalSettings();
  const startDay = settings?.salaryStartDay || 6;

  const date = new Date(dateStr);
  const salaryMonthKey = getSalaryMonthKey(date, startDay);
  const recordsPath = `attendance_${salaryMonthKey}/${dateStr}/records`;

  if (employeeUid) {
    const recordDoc = await getDoc(doc(db, recordsPath, employeeUid));
    if (!recordDoc.exists()) return [];
    return [{ ...recordDoc.data() } as AttendanceRecord];
  }

  const recordsSnapshot = await getDocs(collection(db, recordsPath));
  return recordsSnapshot.docs.map(doc => doc.data() as AttendanceRecord);
};

export const getMonthlyAttendance = async (
  employeeUid: string,
  salaryMonthKey: string
): Promise<AttendanceRecord[]> => {
  const settings = await getPortalSettings();
  const startDay = settings?.salaryStartDay || 6;

  const { start, end } = getSalaryMonthDates(salaryMonthKey, startDay);
  const days = eachDayOfInterval({ start, end });
  
  const promises = days.map(async (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const recordPath = `attendance_${salaryMonthKey}/${dateStr}/records/${employeeUid}`;
    const recordDoc = await getDoc(doc(db, recordPath));
    
    if (recordDoc.exists()) {
      return recordDoc.data() as AttendanceRecord;
    }
    return null;
  });

  const results = await Promise.all(promises);
  return results.filter((record): record is AttendanceRecord => record !== null);
};

export const updateAttendance = async (
  dateStr: string,
  employeeUid: string,
  updates: Partial<AttendanceRecord>
) => {
  const settings = await getPortalSettings();
  const startDay = settings?.salaryStartDay || 6;

  const date = new Date(dateStr);
  const salaryMonthKey = getSalaryMonthKey(date, startDay);
  const recordPath = `attendance_${salaryMonthKey}/${dateStr}/records/${employeeUid}`;

  await updateDoc(doc(db, recordPath), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const deleteAttendance = async (dateStr: string, employeeUid: string) => {
  const settings = await getPortalSettings();
  const startDay = settings?.salaryStartDay || 6;

  const date = new Date(dateStr);
  const salaryMonthKey = getSalaryMonthKey(date, startDay);
  const recordPath = `attendance_${salaryMonthKey}/${dateStr}/records/${employeeUid}`;

  await deleteDoc(doc(db, recordPath));
};

export const adminUpsertAttendance = async (
  employeeUid: string,
  dateStr: string,
  data: {
    status?: AttendanceStatus;
    inTime?: Date | null;
    outTime?: Date | null;
    leaveReason?: string;
    mode: 'attendance' | 'leave' | 'off';
  }
) => {
  const settings = await getPortalSettings();
  const startDay = settings?.salaryStartDay || 6;
  const officeStartTime = settings?.officeStartTime || "10:00";
  const officeEndTime = settings?.officeEndTime || "18:00";
  const lateBuffer = settings?.lateMarkAfterMinutes || 15;

  const date = new Date(dateStr);
  const salaryMonthKey = getSalaryMonthKey(date, startDay);
  
  const attendanceCollectionPath = `attendance_${salaryMonthKey}`;
  const dateDocPath = `${attendanceCollectionPath}/${dateStr}`;
  const recordPath = `${dateDocPath}/records/${employeeUid}`;

  // Determine status based on mode and inputs
  let finalStatus: AttendanceStatus = 'present'; // Default
  let lateMinutes = 0;
  let earlyLeaveHours = 0;

  if (data.mode === 'leave') {
    finalStatus = 'leave';
  } else if (data.mode === 'off') {
    finalStatus = 'off';
  } else {
    // Attendance mode
    if (data.inTime) {
      if (isLate(data.inTime, officeStartTime, lateBuffer)) {
        finalStatus = 'late';
        lateMinutes = calculateLateMinutes(data.inTime, officeStartTime, lateBuffer);
      } else {
        finalStatus = 'present';
      }
    } else {
      finalStatus = 'present';
    }
  }

  if (data.outTime) {
    earlyLeaveHours = calculateEarlyLeaveHours(data.outTime, officeEndTime);
  }

  const recordData: any = {
    status: finalStatus,
    markedBy: 'admin',
    updatedAt: serverTimestamp(),
  };

  if (data.mode === 'attendance') {
    if (data.inTime) recordData.inTime = Timestamp.fromDate(data.inTime);
    if (data.outTime) recordData.outTime = Timestamp.fromDate(data.outTime);
    recordData.leaveReason = null; 
  } else {
    if (data.leaveReason) recordData.leaveReason = data.leaveReason;
    recordData.inTime = null;
    recordData.outTime = null;
    recordData.lateMinutes = 0;
    recordData.earlyLeaveHours = 0;
  }
  
  if (finalStatus === 'late') {
    recordData.lateMinutes = lateMinutes;
  }
  
  if (data.outTime && data.mode === 'attendance') {
    recordData.earlyLeaveHours = earlyLeaveHours;
    
    // Calculate Overtime
    const overtimeHours = calculateOvertimeHours(data.outTime, officeEndTime);
    if (overtimeHours > 0) {
      recordData.overtimeHours = overtimeHours;
      recordData.overtimeStatus = 'approved'; // Default approved
      recordData.overtimeReason = null;
    } else {
      recordData.overtimeHours = 0;
      recordData.overtimeStatus = null;
      recordData.overtimeReason = null;
    }
  }

  // Ensure parent date document exists
  await setDoc(doc(db, dateDocPath), { date: dateStr }, { merge: true });

  // Use setDoc with merge to create or update
  await setDoc(doc(db, recordPath), {
    ...recordData,
    employeeUid,
    date: dateStr,
  }, { merge: true });
};

// ==================== HOLIDAY OPERATIONS ====================

export const addHoliday = async (dateStr: string, reason?: string) => {
  const holidayData: Record<string, any> = {
    createdAt: serverTimestamp() as Timestamp,
  };

  if (reason) {
    holidayData.reason = reason;
  }

  await setDoc(doc(db, 'holidays', dateStr), {
    ...holidayData,
    date: dateStr,
  });
};

export const getHoliday = async (dateStr: string): Promise<Holiday | null> => {
  const holidayDoc = await getDoc(doc(db, 'holidays', dateStr));
  if (!holidayDoc.exists()) return null;
  
  return holidayDoc.data() as Holiday;
};

export const getMonthHolidays = async (salaryMonthKey: string): Promise<Holiday[]> => {
  const settings = await getPortalSettings();
  const startDay = settings?.salaryStartDay || 6;

  const { start, end } = getSalaryMonthDates(salaryMonthKey, startDay);
  const startStr = format(start, 'yyyy-MM-dd');
  const endStr = format(end, 'yyyy-MM-dd');

  const holidaysSnapshot = await getDocs(collection(db, 'holidays'));
  const holidays = holidaysSnapshot.docs
    .map(doc => doc.data() as Holiday)
    .filter(h => h.date >= startStr && h.date <= endStr);

  return holidays;
};

export const deleteHoliday = async (dateStr: string) => {
  await deleteDoc(doc(db, 'holidays', dateStr));
};

export const markAllSundaysForYear = async (year: number) => {
  const sundays = getAllSundaysInYear(year);
  
  const promises = sundays.map(async (sunday) => {
    const existing = await getHoliday(sunday);
    if (!existing) {
      await addHoliday(sunday, 'Sunday');
    }
  });

  await Promise.all(promises);
};

export const calculateMonthlySalary = async (
  employeeUid: string,
  salaryMonthKey: string
): Promise<SalaryReport | null> => {
  const employee = await getEmployee(employeeUid);
  if (!employee) return null;

  const settings = await getPortalSettings();
  const startDay = settings?.salaryStartDay || 6;

  const { start, end } = getSalaryMonthDates(salaryMonthKey, startDay);
  const allDays = eachDayOfInterval({ start, end });
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const [records, holidays] = await Promise.all([
    getMonthlyAttendance(employeeUid, salaryMonthKey),
    getMonthHolidays(salaryMonthKey)
  ]);

  const recordsMap = new Map(records.map(r => [r.date, r]));
  const holidaysSet = new Set(holidays.map(h => h.date));

  let presentDays = 0;
  let leaveDays = 0;
  let offDays = 0;
  let unmarkedDays = 0;
  let lateCount = 0;
  let earlyLeaveHours = 0;

  allDays.forEach(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    
    // Skip future days
    if (dateStr > todayStr) return;

    const record = recordsMap.get(dateStr);
    const isHoliday = holidaysSet.has(dateStr);

    if (record) {
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
          lateCount++;
          presentDays++; // Late is still present
          break;
      }

      if (record.earlyLeaveHours) {
        earlyLeaveHours += record.earlyLeaveHours;
      }
    } else {
      // No record found
      if (!isHoliday) {
        // Not a holiday, so it's unmarked/absent
        unmarkedDays++;
      }
    }
  });

  // Treat unmarked days as OFF days for deduction
  const totalOffDaysForDeduction = offDays + unmarkedDays;

  const deductions = calculateDeductions(
    employee.monthlySalary,
    totalOffDaysForDeduction,
    lateCount,
    earlyLeaveHours
  );

  const netSalary = calculateNetSalary(employee.monthlySalary, deductions.totalDeductions);

  return {
    employeeUid,
    employeeName: employee.name,
    empId: employee.empId,
    monthlySalary: employee.monthlySalary,
    presentDays,
    leaveDays,
    offDays,
    unmarkedDays,
    lateCount,
    earlyLeaveHours,
    offDeduction: deductions.offDeduction,
    lateDeduction: deductions.lateDeduction,
    earlyLeaveDeduction: deductions.earlyLeaveDeduction,
    totalDeductions: deductions.totalDeductions,
    netSalary,
  };
};

export const generateMonthlyReport = async (
  salaryMonthKey: string
): Promise<SalaryReport[]> => {
  const settings = await getPortalSettings();
  const startDay = settings?.salaryStartDay || 6;
  
  // 1. Get all employees
  const employees = await getAllEmployees();
  
  // 2. Get date range
  const { start, end } = getSalaryMonthDates(salaryMonthKey, startDay);
  const days = eachDayOfInterval({ start, end });
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // 3. Fetch Holidays for the month
  const holidays = await getMonthHolidays(salaryMonthKey);
  const holidaysSet = new Set(holidays.map(h => h.date));

  // 4. Fetch Attendance for ALL days in parallel
  const attendancePromises = days.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return getAttendanceForDate(dateStr).then(records => ({ dateStr, records }));
  });

  const dailyRecords = await Promise.all(attendancePromises);

  // 5. Aggregate data per employee
  const employeeStats = new Map<string, {
    presentDays: number;
    leaveDays: number;
    offDays: number;
    lateCount: number;
    earlyLeaveHours: number;
    unmarkedDays: number;
  }>();

  // Initialize stats
  employees.forEach(emp => {
    employeeStats.set(emp.uid, {
      presentDays: 0,
      leaveDays: 0,
      offDays: 0,
      lateCount: 0,
      earlyLeaveHours: 0,
      unmarkedDays: 0
    });
  });

  // Process each day
  dailyRecords.forEach(({ dateStr, records }) => {
    if (dateStr > todayStr) return; // Skip future

    const isHoliday = holidaysSet.has(dateStr);
    
    // Create a set of employees who have a record for this day
    const recordedEmployeeIds = new Set<string>();

    records.forEach(record => {
      recordedEmployeeIds.add(record.employeeUid);
      const stats = employeeStats.get(record.employeeUid);
      if (!stats) return;

      if (record.status === 'present') {
        stats.presentDays++;
      } else if (record.status === 'late') {
        stats.presentDays++;
        stats.lateCount++;
      } else if (record.status === 'leave') {
        stats.leaveDays++;
      } else if (record.status === 'off') {
        stats.offDays++;
      }

      if (record.earlyLeaveHours) {
        stats.earlyLeaveHours += record.earlyLeaveHours;
      }
    });

    // Check for absent/unmarked employees
    employees.forEach(emp => {
      if (!recordedEmployeeIds.has(emp.uid)) {
        // No record
        if (!isHoliday) {
          const stats = employeeStats.get(emp.uid);
          if (stats) stats.unmarkedDays++;
        }
      }
    });
  });

  // 6. Calculate Final Report
  const reports: SalaryReport[] = employees.map(emp => {
    const stats = employeeStats.get(emp.uid)!;
    
    // Treat unmarked days as OFF days for deduction
    const totalOffDaysForDeduction = stats.offDays + stats.unmarkedDays;

    const deductions = calculateDeductions(
      emp.monthlySalary,
      totalOffDaysForDeduction,
      stats.lateCount,
      stats.earlyLeaveHours
    );

    const netSalary = calculateNetSalary(emp.monthlySalary, deductions.totalDeductions);

    return {
      employeeUid: emp.uid,
      employeeName: emp.name,
      empId: emp.empId,
      monthlySalary: emp.monthlySalary,
      presentDays: stats.presentDays,
      leaveDays: stats.leaveDays,
      offDays: stats.offDays,
      unmarkedDays: stats.unmarkedDays,
      lateCount: stats.lateCount,
      earlyLeaveHours: stats.earlyLeaveHours,
      offDeduction: deductions.offDeduction,
      lateDeduction: deductions.lateDeduction,
      earlyLeaveDeduction: deductions.earlyLeaveDeduction,
      totalDeductions: deductions.totalDeductions,
      netSalary,
    };
  });

  return reports;
};
