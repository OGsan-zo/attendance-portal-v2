import { format, subMonths } from 'date-fns';

/**
 * Salary month runs from 6th of current month to 5th of next month
 * Example: Dec 6, 2025 - Jan 5, 2026 = attendance_2025_12
 */

export const getSalaryMonthKey = (date: Date = new Date(), startDay: number = 6): string => {
  const day = date.getDate();
  // const month = date.getMonth();
  // const year = date.getFullYear();

  // If date is before startDay, use previous month
  if (day < startDay) {
    const prevMonth = subMonths(date, 1);
    return format(prevMonth, 'yyyy_MM');
  }

  return format(date, 'yyyy_MM');
};

export const getSalaryMonthDates = (salaryMonthKey: string, startDay: number = 6): { start: Date; end: Date } => {
  // salaryMonthKey format: YYYY_MM
  const [year, month] = salaryMonthKey.split('_').map(Number);
  
  const start = new Date(year, month - 1, startDay); // startDay of the month
  const end = new Date(year, month, startDay - 1); // (startDay - 1) of next month
  
  return { start, end };
};

export const isLate = (time: Date): boolean => {
  const hours = time.getHours();
  const minutes = time.getMinutes();
  
  // Late if after 10:15 AM
  return hours > 10 || (hours === 10 && minutes > 15);
};

export const calculateEarlyLeaveHours = (outTime: Date): number => {
  const hours = outTime.getHours();
  const minutes = outTime.getMinutes();
  
  // Office ends at 6:00 PM (18:00)
  const endHour = 18;
  
  if (hours >= endHour) {
    return 0; // Not early
  }
  
  const totalMinutesLeft = (endHour - hours) * 60 - minutes;
  return Math.ceil(totalMinutesLeft / 60); // Round up to nearest hour
};

export interface DeductionCalculation {
  offDeduction: number;
  lateDeduction: number;
  earlyLeaveDeduction: number;
  totalDeductions: number;
}

export const calculateDeductions = (
  monthlySalary: number,
  offDays: number,
  lateCount: number,
  earlyLeaveHours: number
): DeductionCalculation => {
  const perDaySalary = monthlySalary / 30;
  const perHourSalary = perDaySalary / 8;

  // Off deduction: 1.2 × per day salary
  const offDeduction = offDays * perDaySalary * 1.2;

  // Late deduction: Every 3 lates = half-day deduction
  const lateDeductionDays = Math.floor(lateCount / 3);
  const lateDeduction = lateDeductionDays * (perDaySalary / 2);

  // Early leave deduction: per hour salary × hours
  const earlyLeaveDeduction = earlyLeaveHours * perHourSalary;

  const totalDeductions = offDeduction + lateDeduction + earlyLeaveDeduction;

  return {
    offDeduction: Math.round(offDeduction * 100) / 100,
    lateDeduction: Math.round(lateDeduction * 100) / 100,
    earlyLeaveDeduction: Math.round(earlyLeaveDeduction * 100) / 100,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
  };
};

export const calculateNetSalary = (
  monthlySalary: number,
  totalDeductions: number
): number => {
  return Math.round((monthlySalary - totalDeductions) * 100) / 100;
};
