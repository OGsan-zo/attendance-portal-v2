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
import { getSalaryMonthKey, calculateDeductions, calculateNetSalary, isLate, calculateEarlyLeaveHours, getSalaryMonthDates } from './salary';
import { getAllSundaysInMonth, getAllSundaysInYear } from './holidays';

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
  };

  await setDoc(doc(db, 'employees', uid), employeeData);
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
    // const existingData = existingRecord.data() as AttendanceRecord;
    const outTime = Timestamp.now();
    const earlyLeaveHours = calculateEarlyLeaveHours(outTime.toDate());
    
    await updateDoc(doc(db, recordPath), {
      outTime,
      earlyLeaveHours,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  if (existingRecord.exists() && !isEarlyOff) {
    throw new Error('Attendance already marked for today');
  }

  // Determine if late
  const inTime = Timestamp.now();
  const isLateMark = status === 'present' && isLate(inTime.toDate());
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
    recordData.lateMinutes = calculateLateMinutes(inTime.toDate());
  }

  // Ensure parent date document exists
  await setDoc(doc(db, dateDocPath), { date: dateStr }, { merge: true });

  await setDoc(doc(db, recordPath), {
    ...recordData,
    employeeUid,
    date: dateStr,
  });
};

const calculateLateMinutes = (time: Date): number => {
  const hours = time.getHours();
  const minutes = time.getMinutes();
  const lateStartMinutes = 10 * 60 + 15; // 10:15 AM in minutes
  const currentMinutes = hours * 60 + minutes;
  return Math.max(0, currentMinutes - lateStartMinutes);
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
  
  // Use batching or parallel requests for better performance
  const promises = sundays.map(async (sunday) => {
    const existing = await getHoliday(sunday);
    if (!existing) {
      await addHoliday(sunday, 'Sunday');
    }
  });

  await Promise.all(promises);
};

// ==================== REPORTS ====================

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
  const employees = await getAllEmployees();
  
  const reports: SalaryReport[] = [];
  
  for (const employee of employees) {
    const report = await calculateMonthlySalary(employee.uid, salaryMonthKey);
    if (report) {
      reports.push(report);
    }
  }
  
  return reports;
};
