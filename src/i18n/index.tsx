import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import esTranslations from './es.json';
import enTranslations from './en.json';

type Translations = typeof esTranslations;

const translations: Record<string, Translations> = {
  es: esTranslations,
  en: enTranslations,
};

interface I18nContextType {
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

interface I18nProviderProps {
  children: ReactNode;
  initialLanguage?: string;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children, initialLanguage = 'es' }) => {
  const [language, setLanguageState] = useState(initialLanguage);

  const setLanguage = useCallback((lang: string) => {
    if (translations[lang]) {
      setLanguageState(lang);
    }
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = translations[language];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to Spanish if key not found
        value = translations['es'];
        for (const fallbackKey of keys) {
          if (value && typeof value === 'object' && fallbackKey in value) {
            value = value[fallbackKey];
          } else {
            return key; // Return key if not found in fallback either
          }
        }
        break;
      }
    }

    let result = typeof value === 'string' ? value : key;

    // Replace template placeholders like {{step}} with actual values
    if (params) {
      for (const [paramKey, paramValue] of Object.entries(params)) {
        result = result.replace(new RegExp(`\\{\\{${paramKey}\\}\\}`, 'g'), String(paramValue));
      }
    }

    return result;
  }, [language]);

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

export { esTranslations, enTranslations };
