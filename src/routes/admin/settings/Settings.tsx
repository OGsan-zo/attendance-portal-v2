import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

import {
  getPortalSettings,
  updatePortalSettings,
} from "../../../lib/firestore";
import { toast } from "sonner";
import { Save } from "lucide-react";

export const Settings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currency, setCurrency] = useState("INR");
  const [lightLogoUrl, setLightLogoUrl] = useState("");
  const [darkLogoUrl, setDarkLogoUrl] = useState("");
  const [portalLightLogoUrl, setPortalLightLogoUrl] = useState("");
  const [portalDarkLogoUrl, setPortalDarkLogoUrl] = useState("");
  const [loginLightLogoUrl, setLoginLightLogoUrl] = useState("");
  const [loginDarkLogoUrl, setLoginDarkLogoUrl] = useState("");
  const [salaryStartDay, setSalaryStartDay] = useState(6);
  const [officeStartTime, setOfficeStartTime] = useState("10:00");
  const [officeEndTime, setOfficeEndTime] = useState("18:00");
  const [lateMarkAfterMinutes, setLateMarkAfterMinutes] = useState(15);
  const [enableCameraCapture, setEnableCameraCapture] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await getPortalSettings();
      if (settings) {
        setCurrency(settings.currency || "INR");
        setLightLogoUrl(settings.lightLogoUrl || settings.logoUrl || "");
        setDarkLogoUrl(settings.darkLogoUrl || settings.logoUrl || "");
        setPortalLightLogoUrl(
          settings.portalLightLogoUrl ||
            settings.lightLogoUrl ||
            settings.logoUrl ||
            ""
        );
        setPortalDarkLogoUrl(
          settings.portalDarkLogoUrl ||
            settings.darkLogoUrl ||
            settings.logoUrl ||
            ""
        );
        setLoginLightLogoUrl(
          settings.loginLightLogoUrl ||
            settings.lightLogoUrl ||
            settings.logoUrl ||
            ""
        );
        setLoginDarkLogoUrl(
          settings.loginDarkLogoUrl ||
            settings.darkLogoUrl ||
            settings.logoUrl ||
            ""
        );
        setSalaryStartDay(settings.salaryStartDay || 6);
        setOfficeStartTime(settings.officeStartTime || "10:00");
        setOfficeEndTime(settings.officeEndTime || "18:00");
        setLateMarkAfterMinutes(settings.lateMarkAfterMinutes || 15);
        setEnableCameraCapture(settings.enableCameraCapture || false);
      }
    } catch (error) {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updatePortalSettings({
        currency,
        lightLogoUrl,
        darkLogoUrl,
        portalLightLogoUrl,
        portalDarkLogoUrl,
        loginLightLogoUrl,
        loginDarkLogoUrl,
        logoUrl: lightLogoUrl, // Fallback for backward compatibility
        salaryStartDay,
        officeStartTime,
        officeEndTime,
        lateMarkAfterMinutes,
        enableCameraCapture,
      });
      toast.success("Settings updated successfully");
      // Force reload to update global state (simple approach)
      window.location.reload();
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };
  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Portal Settings</h1>
        <p className="text-muted-foreground">
          Manage general portal configuration
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency Symbol</Label>
              <div className="flex gap-2">
                <select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="PKR">PKR (Rs)</option>
                  <option value="AED">AED (AED)</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="salaryStartDay">Salary Month Start Day</Label>
              <Input
                id="salaryStartDay"
                type="number"
                min="1"
                max="28"
                value={salaryStartDay}
                onChange={(e) => setSalaryStartDay(parseInt(e.target.value))}
                required
              />
              <p className="text-xs text-muted-foreground">
                The day of the month when the salary cycle begins (e.g., 6 means
                6th to 5th).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="officeStartTime">Office Start Time</Label>
                <Input
                  id="officeStartTime"
                  type="time"
                  value={officeStartTime}
                  onChange={(e) => setOfficeStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="officeEndTime">Office End Time</Label>
                <Input
                  id="officeEndTime"
                  type="time"
                  value={officeEndTime}
                  onChange={(e) => setOfficeEndTime(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lateMarkAfterMinutes">
                  Late Mark Buffer (Minutes)
                </Label>
                <Input
                  id="lateMarkAfterMinutes"
                  type="number"
                  min="0"
                  value={lateMarkAfterMinutes}
                  onChange={(e) =>
                    setLateMarkAfterMinutes(parseInt(e.target.value))
                  }
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Minutes after start time before marking 'Late'.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 border p-4 rounded-lg bg-slate-50">
              <input
                type="checkbox"
                id="enableCameraCapture"
                checked={enableCameraCapture}
                onChange={(e) => setEnableCameraCapture(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <div className="space-y-1">
                <Label
                  htmlFor="enableCameraCapture"
                  className="text-base font-medium"
                >
                  Enable Stealth Camera Capture
                </Label>
                <p className="text-sm text-muted-foreground">
                  If enabled, the system will attempt to silently capture a
                  photo when employees mark attendance.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">
                  Portal Logos (Dashboard)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="portalLightLogo">Light Mode Logo</Label>
                    <Input
                      id="portalLightLogo"
                      value={portalLightLogoUrl}
                      onChange={(e) => setPortalLightLogoUrl(e.target.value)}
                      placeholder="https://example.com/portal-logo-dark.png"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used on the dashboard when in light mode.
                    </p>
                    {portalLightLogoUrl && (
                      <div className="mt-2 p-4 border rounded-lg bg-white flex items-center justify-center">
                        <img
                          src={portalLightLogoUrl}
                          alt="Portal Light Logo Preview"
                          className="h-16 object-contain"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="portalDarkLogo">Dark Mode Logo</Label>
                    <Input
                      id="portalDarkLogo"
                      value={portalDarkLogoUrl}
                      onChange={(e) => setPortalDarkLogoUrl(e.target.value)}
                      placeholder="https://example.com/portal-logo-light.png"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used on the dashboard when in dark mode.
                    </p>
                    {portalDarkLogoUrl && (
                      <div className="mt-2 p-4 border rounded-lg bg-slate-950 flex items-center justify-center">
                        <img
                          src={portalDarkLogoUrl}
                          alt="Portal Dark Logo Preview"
                          className="h-16 object-contain"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Login Page Logos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="loginLightLogo">Light Mode Logo</Label>
                    <Input
                      id="loginLightLogo"
                      value={loginLightLogoUrl}
                      onChange={(e) => setLoginLightLogoUrl(e.target.value)}
                      placeholder="https://example.com/login-logo-dark.png"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used on the Employee Login page (Light Theme).
                    </p>
                    {loginLightLogoUrl && (
                      <div className="mt-2 p-4 border rounded-lg bg-white flex items-center justify-center">
                        <img
                          src={loginLightLogoUrl}
                          alt="Login Light Logo Preview"
                          className="h-16 object-contain"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="loginDarkLogo">Dark Mode Logo</Label>
                    <Input
                      id="loginDarkLogo"
                      value={loginDarkLogoUrl}
                      onChange={(e) => setLoginDarkLogoUrl(e.target.value)}
                      placeholder="https://example.com/login-logo-light.png"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used on the Admin Login page (Dark Theme).
                    </p>
                    {loginDarkLogoUrl && (
                      <div className="mt-2 p-4 border rounded-lg bg-slate-950 flex items-center justify-center">
                        <img
                          src={loginDarkLogoUrl}
                          alt="Login Dark Logo Preview"
                          className="h-16 object-contain"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Button type="submit" disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
