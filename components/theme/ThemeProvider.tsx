'use client';

import React, { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import { isThemeName, ThemeName } from '@/lib/theme/themes';

export type { ThemeName };

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  previewTheme: (theme: ThemeName) => void;
  clearPreviewTheme: (theme?: ThemeName) => void;
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

/** Avoid redundant DOM writes when roller re-fires the same theme. */
let paintedKey = '';

function readStoredTheme(): ThemeName {
  if (typeof window === 'undefined') return 'ink';
  try {
    const saved =
      window.localStorage.getItem(themeStorageKey) ??
      window.localStorage.getItem(legacyThemeStorageKey);
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

function paintTheme(next: ThemeName, preview: boolean) {
  const key = `${next}:${preview ? '1' : '0'}`;
  if (paintedKey === key) return;
  paintedKey = key;
  const root = document.documentElement;
  // Preview flag first so duration/ease apply to this paint.
  root.dataset.themePreview = preview ? 'true' : 'false';
  root.setAttribute('data-theme', next);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeToThemeChanges,
    readStoredTheme,
    getServerThemeSnapshot,
  );

  useEffect(() => {
    paintTheme(theme, false);
  }, [theme]);

  const setTheme = (newTheme: ThemeName) => {
    paintTheme(newTheme, false);
    try {
      localStorage.setItem(themeStorageKey, newTheme);
      localStorage.removeItem(legacyThemeStorageKey);
    } catch {
      // DOM theme still updates when storage is blocked.
    }
    window.dispatchEvent(new Event(themeChangedEvent));
  };

  const previewTheme = (previewedTheme: ThemeName) => {
    paintTheme(previewedTheme, true);
  };

  const clearPreviewTheme = (committedTheme?: ThemeName) => {
    paintTheme(committedTheme ?? readStoredTheme(), false);
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
