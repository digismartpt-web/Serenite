import React, {
  createContext, useContext, useState, useEffect, useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────

export interface Theme {
  id:             string;
  name:           string;
  emoji:          string;
  isChildTheme:   boolean;
  // Couleurs principales
  primary:        string;
  primaryDark:    string;
  accent:         string;
  // Fond & surfaces
  background:     string;
  surface:        string;
  surfaceAlt:     string;
  border:         string;
  // Texte
  text:           string;
  textSecondary:  string;
  textOnPrimary:  string;
  // Tab bar
  tabBar:         string;
  tabBarActive:   string;
  tabBarInactive: string;
  // Header
  headerBg:       string;
  headerText:     string;
  // États
  success:        string;
  danger:         string;
  warning:        string;
}

// ─── 8 thèmes adultes + 2 thèmes enfants ─────────────────────

export const THEMES: Record<string, Theme> = {

  // ── Adultes ───────────────────────────────────────────────

  ciel: {
    id: 'ciel', name: 'Ciel', emoji: '🌤️', isChildTheme: false,
    primary: '#1A3A5C', primaryDark: '#0F2340', accent: '#1D9E75',
    background: '#F4F6FA', surface: '#FFFFFF', surfaceAlt: '#EEF2FF',
    border: '#E2E8F0', text: '#1A202C', textSecondary: '#5A7499', textOnPrimary: '#FFFFFF',
    tabBar: '#FFFFFF', tabBarActive: '#1A3A5C', tabBarInactive: '#A0AEC0',
    headerBg: '#1A3A5C', headerText: '#FFFFFF',
    success: '#1D9E75', danger: '#E53E3E', warning: '#D97706',
  },

  foret: {
    id: 'foret', name: 'Forêt', emoji: '🌲', isChildTheme: false,
    primary: '#1A4A2A', primaryDark: '#0F2E19', accent: '#38A169',
    background: '#F0F7F2', surface: '#FFFFFF', surfaceAlt: '#E6F4EC',
    border: '#C6E8D0', text: '#1A202C', textSecondary: '#4A7060', textOnPrimary: '#FFFFFF',
    tabBar: '#FFFFFF', tabBarActive: '#1A4A2A', tabBarInactive: '#A0AEC0',
    headerBg: '#1A4A2A', headerText: '#FFFFFF',
    success: '#38A169', danger: '#E53E3E', warning: '#D97706',
  },

  soleil: {
    id: 'soleil', name: 'Soleil', emoji: '☀️', isChildTheme: false,
    primary: '#7A4F00', primaryDark: '#5A3800', accent: '#D97706',
    background: '#FFFBF0', surface: '#FFFFFF', surfaceAlt: '#FEF3C7',
    border: '#FDE68A', text: '#1A202C', textSecondary: '#7A6030', textOnPrimary: '#FFFFFF',
    tabBar: '#FFFFFF', tabBarActive: '#7A4F00', tabBarInactive: '#A0AEC0',
    headerBg: '#7A4F00', headerText: '#FFFFFF',
    success: '#38A169', danger: '#E53E3E', warning: '#D97706',
  },

  lavande: {
    id: 'lavande', name: 'Lavande', emoji: '💜', isChildTheme: false,
    primary: '#4A3580', primaryDark: '#32226A', accent: '#7C3AED',
    background: '#F5F0FF', surface: '#FFFFFF', surfaceAlt: '#EDE9FE',
    border: '#DDD6FE', text: '#1A202C', textSecondary: '#5B4A90', textOnPrimary: '#FFFFFF',
    tabBar: '#FFFFFF', tabBarActive: '#4A3580', tabBarInactive: '#A0AEC0',
    headerBg: '#4A3580', headerText: '#FFFFFF',
    success: '#38A169', danger: '#E53E3E', warning: '#D97706',
  },

  corail: {
    id: 'corail', name: 'Corail', emoji: '🪸', isChildTheme: false,
    primary: '#8C2B1E', primaryDark: '#6A1E14', accent: '#E53E3E',
    background: '#FFF5F0', surface: '#FFFFFF', surfaceAlt: '#FED7CC',
    border: '#FEB2B2', text: '#1A202C', textSecondary: '#8C4A3A', textOnPrimary: '#FFFFFF',
    tabBar: '#FFFFFF', tabBarActive: '#8C2B1E', tabBarInactive: '#A0AEC0',
    headerBg: '#8C2B1E', headerText: '#FFFFFF',
    success: '#38A169', danger: '#E53E3E', warning: '#D97706',
  },

  ardoise: {
    id: 'ardoise', name: 'Ardoise', emoji: '🪨', isChildTheme: false,
    primary: '#2D3748', primaryDark: '#1A202C', accent: '#4A90D9',
    background: '#F7F8FA', surface: '#FFFFFF', surfaceAlt: '#EDF2F7',
    border: '#E2E8F0', text: '#1A202C', textSecondary: '#4A5568', textOnPrimary: '#FFFFFF',
    tabBar: '#FFFFFF', tabBarActive: '#2D3748', tabBarInactive: '#A0AEC0',
    headerBg: '#2D3748', headerText: '#FFFFFF',
    success: '#38A169', danger: '#E53E3E', warning: '#D97706',
  },

  rose: {
    id: 'rose', name: 'Rose', emoji: '🌸', isChildTheme: false,
    primary: '#7A1F4C', primaryDark: '#5A1538', accent: '#D53F8C',
    background: '#FFF0F7', surface: '#FFFFFF', surfaceAlt: '#FDEEF6',
    border: '#FBB6CE', text: '#1A202C', textSecondary: '#7A3060', textOnPrimary: '#FFFFFF',
    tabBar: '#FFFFFF', tabBarActive: '#7A1F4C', tabBarInactive: '#A0AEC0',
    headerBg: '#7A1F4C', headerText: '#FFFFFF',
    success: '#38A169', danger: '#E53E3E', warning: '#D97706',
  },

  ocean: {
    id: 'ocean', name: 'Océan', emoji: '🌊', isChildTheme: false,
    primary: '#0D5060', primaryDark: '#083A47', accent: '#00B5D8',
    background: '#F0F9FF', surface: '#FFFFFF', surfaceAlt: '#E0F7FA',
    border: '#BEE3F8', text: '#1A202C', textSecondary: '#2C7A8C', textOnPrimary: '#FFFFFF',
    tabBar: '#FFFFFF', tabBarActive: '#0D5060', tabBarInactive: '#A0AEC0',
    headerBg: '#0D5060', headerText: '#FFFFFF',
    success: '#38A169', danger: '#E53E3E', warning: '#D97706',
  },

  // ── Enfants ───────────────────────────────────────────────

  arcenciel: {
    id: 'arcenciel', name: 'Arc-en-ciel', emoji: '🌈', isChildTheme: true,
    primary: '#5B3FA0', primaryDark: '#3D2870', accent: '#F6AD55',
    background: '#FAF5FF', surface: '#FFFFFF', surfaceAlt: '#EDE9FE',
    border: '#E9D8FD', text: '#1A202C', textSecondary: '#6B46C1', textOnPrimary: '#FFFFFF',
    tabBar: '#FFFFFF', tabBarActive: '#5B3FA0', tabBarInactive: '#A0AEC0',
    headerBg: '#5B3FA0', headerText: '#FFFFFF',
    success: '#38A169', danger: '#E53E3E', warning: '#F6AD55',
  },

  espace: {
    id: 'espace', name: 'Espace', emoji: '🚀', isChildTheme: true,
    primary: '#1A1060', primaryDark: '#0D0840', accent: '#9F7AEA',
    background: '#0D0840', surface: '#1A1060', surfaceAlt: '#2D2080',
    border: '#2D2080', text: '#FFFFFF', textSecondary: '#9F7AEA', textOnPrimary: '#FFFFFF',
    tabBar: '#1A1060', tabBarActive: '#9F7AEA', tabBarInactive: '#4A3580',
    headerBg: '#0D0840', headerText: '#FFFFFF',
    success: '#9F7AEA', danger: '#FC8181', warning: '#F6AD55',
  },
};

const THEME_STORAGE_KEY = '@serenite/theme';

// ─── Context ──────────────────────────────────────────────────

interface ThemeContextValue {
  theme:     Theme;
  themeId:   string;
  setTheme:  (id: string) => void;
  allThemes: typeof THEMES;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState('ciel');

  // Restaurer le thème sauvegardé
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved && THEMES[saved]) setThemeId(saved);
    });
  }, []);

  const setTheme = useCallback((id: string) => {
    if (!THEMES[id]) return;
    setThemeId(id);
    AsyncStorage.setItem(THEME_STORAGE_KEY, id);
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme: THEMES[themeId], themeId, setTheme, allThemes: THEMES }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme doit être utilisé dans <ThemeProvider>');
  return ctx;
}
