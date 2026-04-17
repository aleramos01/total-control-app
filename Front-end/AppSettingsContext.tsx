import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from './services/api';
import { useAuth } from './hooks/useAuth';
import { AppSettings } from './types';

type SettingsSource = 'default' | 'server';

interface AppSettingsContextType {
  settings: AppSettings;
  source: SettingsSource;
  isLoading: boolean;
  refreshSettings: () => Promise<void>;
}

export const defaultAppSettings: AppSettings = {
  currency: 'BRL',
  locale: 'pt-BR',
  timezone: 'America/Sao_Paulo',
  billingDayDefault: 5,
};

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [source, setSource] = useState<SettingsSource>('default');
  const [isLoading, setIsLoading] = useState(false);

  const refreshSettings = useCallback(async () => {
    if (!isAuthenticated) {
      setSettings(defaultAppSettings);
      setSource('default');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const nextSettings = await api.fetchAppSettings();
      setSettings(nextSettings);
      setSource('server');
    } catch {
      setSettings(defaultAppSettings);
      setSource('default');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  const value = useMemo(() => ({
    settings,
    source,
    isLoading,
    refreshSettings,
  }), [isLoading, refreshSettings, settings, source]);

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
};

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error('useAppSettings must be used within an AppSettingsProvider');
  }

  return context;
}
