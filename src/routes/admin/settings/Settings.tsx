import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { getPortalSettings, updatePortalSettings } from '../../../lib/firestore';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

export const Settings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currency, setCurrency] = useState('INR');
  const [logoUrl, setLogoUrl] = useState('');
  const [salaryStartDay, setSalaryStartDay] = useState(6);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await getPortalSettings();
      if (settings) {
        setCurrency(settings.currency || 'INR');
        setLogoUrl(settings.logoUrl || '');
        setSalaryStartDay(settings.salaryStartDay || 6);
      }
    } catch (error) {
      toast.error('Failed to load settings');
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
        logoUrl,
        salaryStartDay 
      });
      toast.success('Settings updated successfully');
      // Force reload to update global state (simple approach)
      window.location.reload();
    } catch (error) {
      toast.error('Failed to save settings');
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
        <p className="text-muted-foreground">Manage general portal configuration</p>
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
                The day of the month when the salary cycle begins (e.g., 6 means 6th to 5th).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo">Logo URL</Label>
              <Input
                id="logo"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
              />
              <p className="text-xs text-muted-foreground">
                Enter a direct URL to your logo image.
              </p>
            </div>

            {logoUrl && (
              <div className="mt-4 p-4 border rounded-lg bg-slate-50 flex items-center justify-center">
                <img src={logoUrl} alt="Logo Preview" className="h-16 object-contain" />
              </div>
            )}

            <Button type="submit" disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
