import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Language, languages, getDefaultLanguage, getLanguageByCode } from '@/lib/languages';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  autoTranslate: boolean;
  setAutoTranslate: (value: boolean) => Promise<void>;
  loading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [language, setLanguageState] = useState<Language>(getDefaultLanguage());
  const [autoTranslate, setAutoTranslateState] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadPreferences();
    } else {
      // Load from localStorage for non-authenticated users
      const savedLang = localStorage.getItem('preferred_language');
      if (savedLang) {
        const lang = getLanguageByCode(savedLang);
        if (lang) setLanguageState(lang);
      }
      setLoading(false);
    }
  }, [user]);

  const loadPreferences = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_preferences' as any)
        .select('preferred_language, auto_translate')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading preferences:', error);
      }

      if (data) {
        const lang = getLanguageByCode((data as any).preferred_language);
        if (lang) setLanguageState(lang);
        setAutoTranslateState((data as any).auto_translate);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('preferred_language', lang.code);

    if (user) {
      try {
        const { error } = await supabase
          .from('user_preferences' as any)
          .upsert({
            user_id: user.id,
            preferred_language: lang.code,
            auto_translate: autoTranslate,
          } as any, { onConflict: 'user_id' });

        if (error) console.error('Error saving language:', error);
      } catch (error) {
        console.error('Error:', error);
      }
    }
  };

  const setAutoTranslate = async (value: boolean) => {
    setAutoTranslateState(value);

    if (user) {
      try {
        const { error } = await supabase
          .from('user_preferences' as any)
          .upsert({
            user_id: user.id,
            preferred_language: language.code,
            auto_translate: value,
          } as any, { onConflict: 'user_id' });

        if (error) console.error('Error saving auto_translate:', error);
      } catch (error) {
        console.error('Error:', error);
      }
    }
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, autoTranslate, setAutoTranslate, loading }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
