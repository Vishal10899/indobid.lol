'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type ThemeMode = 'dark' | 'light' | 'system';
export type ActiveTheme = 'dark' | 'light';

interface ThemeContextType {
  theme: ActiveTheme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  setTheme: (theme: ActiveTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  themeMode: 'dark',
  setThemeMode: () => {},
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [resolvedTheme, setResolvedTheme] = useState<ActiveTheme>('dark');
  const [mounted, setMounted] = useState(false);

  const applyTheme = useCallback((mode: ThemeMode) => {
    let active: ActiveTheme = 'dark';
    if (mode === 'system') {
      if (typeof window !== 'undefined' && window.matchMedia) {
        active = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
    } else {
      active = mode;
    }

    setResolvedTheme(active);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('light', active === 'light');
      document.documentElement.classList.toggle('dark', active === 'dark');
      document.documentElement.setAttribute('data-theme', active);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('indobid_theme') as ThemeMode | null;
    const initialMode: ThemeMode = (saved === 'dark' || saved === 'light' || saved === 'system') ? saved : 'dark';
    setThemeModeState(initialMode);
    applyTheme(initialMode);

    // Listen for OS system theme changes if in system mode
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        const currentSaved = localStorage.getItem('indobid_theme') as ThemeMode | null;
        if (currentSaved === 'system') {
          applyTheme('system');
        }
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [applyTheme]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem('indobid_theme', mode);
    applyTheme(mode);
  };

  const setTheme = (active: ActiveTheme) => {
    setThemeMode(active);
  };

  const toggleTheme = () => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: resolvedTheme,
        themeMode,
        setThemeMode,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
