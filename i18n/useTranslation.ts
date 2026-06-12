import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T, tList, weekDays, shortMonths, type LangCode } from './translations';

export { tList, weekDays, shortMonths };

const LANG_KEY = '@serenite/language';

let _globalLang: LangCode = 'fr';
const _listeners = new Set<(lang: LangCode) => void>();

export function setGlobalLang(code: LangCode) {
  _globalLang = code;
  _listeners.forEach((fn) => fn(code));
}

export function getGlobalLang(): LangCode {
  return _globalLang;
}

/**
 * Hook de traduction. Se met à jour automatiquement quand la langue change.
 *
 * Utilisation :
 *   const { t, lang, setLang } = useTranslation();
 *   <Text>{t('onboarding.title')}</Text>
 *   <Text>{t('onboarding.step', { n: 1 })}</Text>
 */
export function useTranslation() {
  const [lang, setLangState] = useState<LangCode>(_globalLang);

  // S'abonner aux changements globaux
  useState(() => {
    const handler = (code: LangCode) => setLangState(code);
    _listeners.add(handler);
    return () => { _listeners.delete(handler); };
  });

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const entry = T[key];
      if (!entry) return key;
      let text = entry[lang] ?? entry['fr'] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [lang],
  );

  const setLang = useCallback(async (code: LangCode) => {
    setGlobalLang(code);
    await AsyncStorage.setItem(LANG_KEY, code);
  }, []);

  /** Restaurer la langue sauvegardée au démarrage */
  const restoreLang = useCallback(async () => {
    const saved = await AsyncStorage.getItem(LANG_KEY);
    if (saved && (saved === 'fr' || saved === 'en' || saved === 'es' || saved === 'pt')) {
      setGlobalLang(saved as LangCode);
    }
  }, []);

  return { t, lang, setLang, restoreLang };
}
