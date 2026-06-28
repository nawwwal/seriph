'use client';

import React, { createContext, useContext, useEffect, useSyncExternalStore } from 'react';

export type ThemeName = 'ink' | 'noir' | 'sunset' | 'ocean';

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'ink',
  setTheme: () => {},
});

const themeChangedEvent = 'seriph-theme-change';
const validThemes = new Set<ThemeName>(['ink', 'noir', 'sunset', 'ocean']);

function readStoredTheme(): ThemeName {
  if (typeof window === 'undefined') return 'ink';
  const saved = window.localStorage.getItem('theme');
  return validThemes.has(saved as ThemeName) ? (saved as ThemeName) : 'ink';
}

function subscribeToThemeChanges(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(themeChangedEvent, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(themeChangedEvent, onStoreChange);
  };
}

function getServerThemeSnapshot(): ThemeName {
  return 'ink';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribeToThemeChanges, readStoredTheme, getServerThemeSnapshot);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = (newTheme: ThemeName) => {
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    window.dispatchEvent(new Event(themeChangedEvent));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
