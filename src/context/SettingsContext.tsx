import React, { createContext, useContext, useState, useEffect } from 'react';
import { getPortalSettings } from '../lib/firestore';
import { PortalSettings } from '../types';

interface SettingsContextType {
  settings: PortalSettings | null;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  currencySymbol: string;
  salaryStartDay: number;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<PortalSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSettings = async () => {
    try {
      const data = await getPortalSettings();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  const getCurrencySymbol = (currencyCode: string) => {
    switch (currencyCode) {
      case 'USD': return '$';
      case 'EUR': return '€';
      case 'GBP': return '£';
      case 'PKR': return 'Rs';
      case 'AED': return 'AED';
      default: return '₹'; // Default to INR symbol if not found or if INR
    }
  };

  const currencySymbol = getCurrencySymbol(settings?.currency || 'INR');
  const salaryStartDay = settings?.salaryStartDay || 6;

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings, currencySymbol, salaryStartDay }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
