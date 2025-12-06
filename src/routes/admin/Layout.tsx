import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { LogOut, LayoutDashboard, Users, UserCog, Calendar, ClipboardList, FileText, Sun, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { getPortalSettings } from '../../lib/firestore';

export const AdminLayout: React.FC = () => {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getPortalSettings();
      if (settings?.logoUrl) {
        setLogoUrl(settings.logoUrl);
      }
    };
    loadSettings();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/employees', label: 'Employees', icon: Users },
    { path: '/admin/admins', label: 'Admins', icon: UserCog },
    { path: '/admin/attendance', label: 'Attendance', icon: ClipboardList },
    { path: '/admin/calendar', label: 'Calendar', icon: Calendar },
    { path: '/admin/holidays', label: 'Holidays', icon: Sun },
    { path: '/admin/reports', label: 'Reports', icon: FileText },
    { path: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r min-h-screen sticky top-0">
          <div className="p-6">
            {logoUrl ? (
              <img src={logoUrl} alt="Portal Logo" className="h-12 w-auto mb-2 object-contain" />
            ) : (
              <h1 className="text-2xl font-bold text-primary">Admin Portal</h1>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              {profile?.name || 'Administrator'}
            </p>
          </div>

          <nav className="px-3 space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={active ? 'default' : 'ghost'}
                    className="w-full justify-start"
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          <div className="absolute bottom-0 w-64 p-3 border-t bg-white">
            <Button onClick={handleSignOut} variant="outline" className="w-full">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
