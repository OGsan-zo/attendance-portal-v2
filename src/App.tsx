import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { Toaster } from "sonner";
import { RequireAuth } from "./components/auth/RequireAuth";
import { ThemeProvider } from "./context/ThemeContext";

// Shared
import { Login } from "./routes/shared/Login";
import { AdminLogin } from "./routes/shared/AdminLogin";
import { AccessDenied } from "./routes/shared/AccessDenied";

// Employee
import { EmployeeLayout } from "./routes/employee/Layout";
import { EmployeeDashboard } from "./routes/employee/Dashboard";
import { EmployeeCalendar } from "./routes/employee/Calendar";
import { EmployeeSalary } from "./routes/employee/Salary";

// Admin
import { AdminLayout } from "./routes/admin/Layout";
import { AdminDashboard } from "./routes/admin/dashboard/Dashboard";
import { EmployeeList } from "./routes/admin/employees/EmployeeList";
import { AdminList } from "./routes/admin/admins/AdminList";
import { AttendanceView } from "./routes/admin/attendance/AttendanceView";
import { CalendarView } from "./routes/admin/calendar/CalendarView";
import { HolidayManagement } from "./routes/admin/holidays/HolidayManagement";
import { SalaryReports } from "./routes/admin/reports/SalaryReports";
import { PaidSalaries } from "./routes/admin/reports/PaidSalaries";
import { OvertimePage } from "./routes/admin/overtime/Overtime";
import { Settings } from "./routes/admin/settings/Settings";
import { SettingsProvider } from "./context/SettingsContext";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SettingsProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/access-denied" element={<AccessDenied />} />

              {/* Employee Routes */}
              <Route
                path="/"
                element={
                  <RequireAuth role="employee">
                    <EmployeeLayout />
                  </RequireAuth>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<EmployeeDashboard />} />
                <Route path="calendar" element={<EmployeeCalendar />} />
                <Route path="salary" element={<EmployeeSalary />} />
              </Route>

              {/* Admin Routes */}
              <Route
                path="/admin"
                element={
                  <RequireAuth role="admin">
                    <AdminLayout />
                  </RequireAuth>
                }
              >
                <Route
                  index
                  element={<Navigate to="/admin/dashboard" replace />}
                />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="employees" element={<EmployeeList />} />
                <Route path="admins" element={<AdminList />} />
                <Route path="attendance" element={<AttendanceView />} />
                <Route path="calendar" element={<CalendarView />} />
                <Route path="holidays" element={<HolidayManagement />} />
                <Route path="reports" element={<SalaryReports />} />
                <Route path="paid-salaries" element={<PaidSalaries />} />
                <Route path="overtime" element={<OvertimePage />} />
                <Route path="settings" element={<Settings />} />
              </Route>

              {/* Catch all */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </BrowserRouter>

          <Toaster position="bottom-right" richColors />
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
