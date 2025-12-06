import { Timestamp } from 'firebase/firestore';

export type AttendanceStatus = 'present' | 'leave' | 'off' | 'holiday' | 'late';

export interface Admin {
  uid: string;
  name: string;
  email: string;
  role: 'admin';
  createdAt: Timestamp;
}

export interface Employee {
  uid: string;
  name: string;
  email: string;
  empId: string;
  monthlySalary: number; // in INR
  createdBy: string; // admin uid
  createdAt: Timestamp;
  isActive?: boolean;
}

export interface AttendanceRecord {
  employeeUid: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  inTime?: Timestamp;
  outTime?: Timestamp;
  leaveReason?: string;
  markedBy: string; // 'self' or admin uid
  lateMinutes?: number;
  earlyLeaveHours?: number;
  overtimeHours?: number;
  overtimeStatus?: 'approved' | 'rejected';
  overtimeReason?: string | null;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface Holiday {
  date: string; // YYYY-MM-DD
  reason?: string;
  createdAt: Timestamp;
}

export interface SalaryReport {
  employeeUid: string;
  employeeName: string;
  empId: string;
  monthlySalary: number;
  presentDays: number;
  leaveDays: number;
  offDays: number;
  unmarkedDays: number;
  lateCount: number;
  earlyLeaveHours: number;
  offDeduction: number;
  lateDeduction: number;
  earlyLeaveDeduction: number;
  totalDeductions: number;
  netSalary: number;
}
export interface AttendanceStats {
  presentDays: number;
  leaveDays: number;
  offDays: number;
  lateDays: number;
  earlyLeaveHours: number;
  estimatedNetSalary: number;
}

export interface PortalSettings {
  currency?: string;
  logoUrl?: string;
  salaryStartDay?: number;
  officeStartTime?: string; // "HH:mm"
  officeEndTime?: string;   // "HH:mm"
  lateMarkAfterMinutes?: number;
  updatedAt?: Timestamp;
}
