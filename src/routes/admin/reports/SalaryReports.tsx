import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Select } from "../../../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { Skeleton } from "../../../components/ui/skeleton";
import { generateMonthlyReport } from "../../../lib/firestore";
import { SalaryReport } from "../../../types";
import { toast } from "sonner";
import { useAuth } from "../../../context/AuthContext";
import { Button } from "../../../components/ui/button";
import { Download, CheckCircle, DollarSign } from "lucide-react";
import { addSalaryPayment, getSalaryPayments } from "../../../lib/firestore";
import { Timestamp } from "firebase/firestore";
import { useSettings } from "../../../context/SettingsContext";

export const SalaryReports: React.FC = () => {
  const { user } = useAuth();
  const { currencySymbol, salaryStartDay } = useSettings();
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonthNum, setSelectedMonthNum] = useState(
    new Date().getMonth() + 1
  );
  const [reports, setReports] = useState<SalaryReport[]>([]);
  const [paidEmployees, setPaidEmployees] = useState<Set<string>>(new Set());
  const [markingPay, setMarkingPay] = useState(false);

  // Calculate selectedMonth from year and month
  const selectedMonth = `${selectedYear}_${String(selectedMonthNum).padStart(
    2,
    "0"
  )}`;

  useEffect(() => {
    const currentDate = new Date();
    setSelectedYear(currentDate.getFullYear());
    setSelectedMonthNum(currentDate.getMonth() + 1);
  }, [salaryStartDay]);

  useEffect(() => {
    loadReports();
  }, [selectedMonth]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const [data, payments] = await Promise.all([
        generateMonthlyReport(selectedMonth),
        getSalaryPayments(selectedMonth),
      ]);
      setReports(data);
      setPaidEmployees(new Set(payments.map((p) => p.employeeUid)));
    } catch (error) {
      console.error("Error loading reports:", error);
      toast.error("Failed to load salary reports");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const headers = [
      "Employee Name",
      "Emp ID",
      "Monthly Salary",
      "Present",
      "Leave",
      "Off",
      "Unmarked",
      "Holidays",
      "Late",
      "Off Deduction",
      "Late Deduction",
      "Early Leave Ded.",
      "Total Deductions",
      "Net Salary",
      "Status",
    ];

    const csvContent = [
      headers.join(","),
      ...reports.map((r) => {
        const isPaid = paidEmployees.has(r.employeeUid);
        return [
          `"${r.employeeName}"`,
          r.empId,
          r.monthlySalary,
          r.presentDays,
          r.leaveDays,
          r.offDays,
          r.unmarkedDays,
          r.holidayDays,
          r.lateCount,
          r.offDeduction,
          r.lateDeduction,
          r.earlyLeaveDeduction,
          r.totalDeductions,
          r.netSalary,
          isPaid ? "Paid" : "Unpaid",
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `salary_report_${selectedMonth}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMarkAsPaid = async (report: SalaryReport) => {
    if (!user) return;
    if (
      !confirm(
        `Mark ${report.employeeName} as PAID? Amount: ${currencySymbol}${report.netSalary}`
      )
    )
      return;

    try {
      setMarkingPay(true);
      await addSalaryPayment({
        employeeUid: report.employeeUid,
        salaryMonthKey: selectedMonth,
        amount: report.netSalary,
        paidAt: Timestamp.now(),
        paidBy: user.uid,
        notes: "Salary Payment",
      });
      toast.success("Marked as Paid");

      // Update local state
      const newSet = new Set(paidEmployees);
      newSet.add(report.employeeUid);
      setPaidEmployees(newSet);
    } catch (e) {
      console.error(e);
      toast.error("Failed to mark as paid");
    } finally {
      setMarkingPay(false);
    }
  };

  // Generate year options (last 5 years + current year)
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let i = 0; i <= 5; i++) {
    yearOptions.push(currentYear - i);
  }

  // Month options
  const monthOptions = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  const totalGrossSalary = reports.reduce((sum, r) => sum + r.monthlySalary, 0);
  const totalDeductions = reports.reduce(
    (sum, r) => sum + r.totalDeductions,
    0
  );
  const totalNetSalary = reports.reduce((sum, r) => sum + r.netSalary, 0);

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Salary Reports</h1>
          <p className="text-muted-foreground">
            Monthly salary and deduction reports
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Select
              value={selectedYear.toString()}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-32 border rounded-md p-2"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>
            <Select
              value={selectedMonthNum.toString()}
              onChange={(e) => setSelectedMonthNum(Number(e.target.value))}
              className="w-40 border rounded-md p-2"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={handleExport} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Total Gross Salary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currencySymbol}
              {totalGrossSalary.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Total Deductions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {currencySymbol}
              {totalDeductions.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Total Net Payable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {currencySymbol}
              {totalNetSalary.toLocaleString()}
            </div>
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
                  <TableHead className="text-center">Holidays</TableHead>
                  <TableHead className="text-center">Late</TableHead>
                  <TableHead className="text-right">Off Deduction</TableHead>
                  <TableHead className="text-right">Late Deduction</TableHead>
                  <TableHead className="text-right">Early Leave Ded.</TableHead>
                  <TableHead className="text-right">Total Deductions</TableHead>
                  <TableHead className="text-right">Net Salary</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={14}
                      className="text-center text-muted-foreground"
                    >
                      No salary data available for this month
                    </TableCell>
                  </TableRow>
                ) : (
                  reports.map((report) => (
                    <TableRow key={report.employeeUid}>
                      <TableCell className="font-medium">
                        {report.employeeName}
                      </TableCell>
                      <TableCell>{report.empId}</TableCell>
                      <TableCell className="text-right">
                        {currencySymbol}
                        {report.monthlySalary.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        {report.presentDays}
                      </TableCell>
                      <TableCell className="text-center">
                        {report.leaveDays}
                      </TableCell>
                      <TableCell className="text-center">
                        {report.offDays}
                      </TableCell>
                      <TableCell className="text-center text-red-500 font-medium">
                        {report.unmarkedDays}
                      </TableCell>
                      <TableCell className="text-center text-blue-600 font-medium">
                        {report.holidayDays}
                      </TableCell>
                      <TableCell className="text-center">
                        {report.lateCount}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {currencySymbol}
                        {report.offDeduction.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {currencySymbol}
                        {report.lateDeduction.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {currencySymbol}
                        {report.earlyLeaveDeduction.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {currencySymbol}
                        {report.totalDeductions.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {currencySymbol}
                        {report.netSalary.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        {paidEmployees.has(report.employeeUid) ? (
                          <div className="flex items-center justify-center text-green-600 font-medium gap-1">
                            <CheckCircle className="h-4 w-4" />
                            Already Paid
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleMarkAsPaid(report)}
                            disabled={markingPay}
                            className="h-8"
                          >
                            <DollarSign className="mr-1 h-3 w-3" />
                            Pay
                          </Button>
                        )}
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
