import React, { createContext, useState, useContext, useMemo, useCallback } from 'react';
import { useAppSettings } from './AppSettingsContext';
import { translations, Locale, AllTranslations } from './locales';

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: keyof AllTranslations['en-US']) => string;
  formatCurrency: (value: number) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
const LOCALE_STORAGE_KEY = 'app-locale';

const getStoredLocale = (): Locale | null => {
  try {
    const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (savedLocale === 'pt-BR' || savedLocale === 'en-US') {
      return savedLocale;
    }
  } catch (error) {
    console.error('Failed to get locale from localStorage', error);
  }
  return null;
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings, source } = useAppSettings();
  const [localeOverride, setLocaleOverride] = useState<Locale | null>(getStoredLocale);

  const locale = localeOverride ?? (source === 'server' ? settings.locale : 'pt-BR');
  const currency = source === 'server' ? settings.currency : locale === 'en-US' ? 'USD' : 'BRL';

  const setLocale = useCallback((newLocale: Locale) => {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
    } catch (error) {
      console.error('Failed to save locale in localStorage', error);
    }
    setLocaleOverride(newLocale);
  }, []);

  const t = useCallback((key: keyof AllTranslations['en-US']) => {
    return translations[locale][key] || translations['en-US'][key];
  }, [locale]);

  const formatCurrency = useCallback((value: number) => {
    return value.toLocaleString(locale, {
      style: 'currency',
      currency,
    });
  }, [currency, locale]);

  const value = useMemo(() => ({
    locale,
    setLocale,
    t,
    formatCurrency,
  }), [locale, setLocale, t, formatCurrency]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
