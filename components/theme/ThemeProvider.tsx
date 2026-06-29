'use client';

import React, { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import { isThemeName, ThemeName } from '@/lib/theme/themes';

export type { ThemeName };

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  previewTheme: (theme: ThemeName) => void;
  clearPreviewTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'ink',
  setTheme: () => {},
  previewTheme: () => {},
  clearPreviewTheme: () => {},
});

const themeChangedEvent = 'seriph-theme-change';
const themeStorageKey = 'seriph-theme:v1';
const legacyThemeStorageKey = 'theme';

function readStoredTheme(): ThemeName {
  if (typeof window === 'undefined') return 'ink';
  try {
    const saved = window.localStorage.getItem(themeStorageKey) ?? window.localStorage.getItem(legacyThemeStorageKey);
    return isThemeName(saved) ? saved : 'ink';
  } catch {
    return 'ink';
  }
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
    try {
      localStorage.setItem(themeStorageKey, newTheme);
      localStorage.removeItem(legacyThemeStorageKey);
    } catch {
      // The DOM theme still updates when storage is blocked.
    }
    window.dispatchEvent(new Event(themeChangedEvent));
  };

  const previewTheme = (previewedTheme: ThemeName) => {
    document.documentElement.setAttribute('data-theme', previewedTheme);
  };

  const clearPreviewTheme = () => {
    document.documentElement.setAttribute('data-theme', readStoredTheme());
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, previewTheme, clearPreviewTheme }}>
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
