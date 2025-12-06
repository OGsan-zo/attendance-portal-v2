import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Select } from '../../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Skeleton } from '../../../components/ui/skeleton';
import { generateMonthlyReport } from '../../../lib/firestore';
import { getSalaryMonthKey } from "../../../lib/salary";
import { SalaryReport } from '../../../types';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useSettings } from '../../../context/SettingsContext';

export const SalaryReports: React.FC = () => {
  const { currencySymbol, salaryStartDay } = useSettings();
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(getSalaryMonthKey(new Date(), salaryStartDay));
  const [reports, setReports] = useState<SalaryReport[]>([]);

  useEffect(() => {
    // Update selected month if start day changes
    setSelectedMonth(getSalaryMonthKey(new Date(), salaryStartDay));
  }, [salaryStartDay]);

  useEffect(() => {
    loadReports();
  }, [selectedMonth]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await generateMonthlyReport(selectedMonth);
      setReports(data);
    } catch (error) {
      console.error('Error loading reports:', error);
      toast.error('Failed to load salary reports');
    } finally {
      setLoading(false);
    }
  };

  // Generate month options (last 6 months)
  const monthOptions = [];
  for (let i = 0; i < 6; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const key = getSalaryMonthKey(date, salaryStartDay);
    monthOptions.push({
      value: key,
      label: format(date, 'MMMM yyyy'),
    });
  }

  const totalGrossSalary = reports.reduce((sum, r) => sum + r.monthlySalary, 0);
  const totalDeductions = reports.reduce((sum, r) => sum + r.totalDeductions, 0);
  const totalNetSalary = reports.reduce((sum, r) => sum + r.netSalary, 0);

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Salary Reports</h1>
          <p className="text-muted-foreground">Monthly salary and deduction reports</p>
        </div>
        <Select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-48"
        >
          {monthOptions.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Gross Salary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currencySymbol}{totalGrossSalary.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Deductions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{currencySymbol}{totalDeductions.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Net Payable</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{currencySymbol}{totalNetSalary.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Report Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Report ({reports.length} Employees)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Emp ID</TableHead>
                  <TableHead className="text-right">Monthly Salary</TableHead>
                  <TableHead className="text-center">Present</TableHead>
                  <TableHead className="text-center">Leave</TableHead>
                  <TableHead className="text-center">Off</TableHead>
                  <TableHead className="text-center">Unmarked</TableHead>
                  <TableHead className="text-center">Late</TableHead>
                  <TableHead className="text-right">Off Deduction</TableHead>
                  <TableHead className="text-right">Late Deduction</TableHead>
                  <TableHead className="text-right">Early Leave Ded.</TableHead>
                  <TableHead className="text-right">Total Deductions</TableHead>
                  <TableHead className="text-right">Net Salary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-muted-foreground">
                      No salary data available for this month
                    </TableCell>
                  </TableRow>
                ) : (
                  reports.map(report => (
                    <TableRow key={report.employeeUid}>
                      <TableCell className="font-medium">{report.employeeName}</TableCell>
                      <TableCell>{report.empId}</TableCell>
                      <TableCell className="text-right">{currencySymbol}{report.monthlySalary.toLocaleString()}</TableCell>
                      <TableCell className="text-center">{report.presentDays}</TableCell>
                      <TableCell className="text-center">{report.leaveDays}</TableCell>
                      <TableCell className="text-center">{report.offDays}</TableCell>
                      <TableCell className="text-center text-red-500 font-medium">{report.unmarkedDays}</TableCell>
                      <TableCell className="text-center">{report.lateCount}</TableCell>
                      <TableCell className="text-right text-red-600">
                        {currencySymbol}{report.offDeduction.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {currencySymbol}{report.lateDeduction.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {currencySymbol}{report.earlyLeaveDeduction.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {currencySymbol}{report.totalDeductions.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {currencySymbol}{report.netSalary.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
