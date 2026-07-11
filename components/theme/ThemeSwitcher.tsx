'use client';

import { Select } from '@base-ui/react/select';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from './ThemeProvider';
import type { ThemeName } from '@/lib/theme/themes';
import { themeMetaFor } from '@/lib/theme/themeMeta';
import ThemeSwitcherPanel from './ThemeSwitcherPanel';
import ThemeSwitcherTrigger from './ThemeSwitcherTrigger';

export default function ThemeSwitcher() {
  const { theme, setTheme, previewTheme, clearPreviewTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const committedThemeRef = useRef(theme);
  /** Last theme under the roller band (preview + pending commit). */
  const pendingThemeRef = useRef(theme);
  const committed = themeMetaFor(theme);

  useEffect(() => {
    committedThemeRef.current = theme;
    // Keep pending in sync when theme changes outside the menu.
    if (!open) pendingThemeRef.current = theme;
  }, [theme, open]);

  const chooseTheme = useCallback(
    (next: ThemeName) => {
      committedThemeRef.current = next;
      pendingThemeRef.current = next;
      setTheme(next);
      setOpen(false);
      clearPreviewTheme(next);
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(10);
      }
    },
    [clearPreviewTheme, setTheme],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen) {
        pendingThemeRef.current = committedThemeRef.current;
        previewTheme(committedThemeRef.current);
        return;
      }
      // Closing the menu commits whatever is centered on the roller —
      // not the theme from when the menu opened.
      const next = pendingThemeRef.current;
      committedThemeRef.current = next;
      setTheme(next);
      clearPreviewTheme(next);
    },
    [clearPreviewTheme, previewTheme, setTheme],
  );

  const handlePreview = useCallback(
    (next: ThemeName) => {
      if (pendingThemeRef.current === next) return;
      pendingThemeRef.current = next;
      previewTheme(next);
    },
    [previewTheme],
  );

  return (
    <Select.Root<ThemeName>
      value={theme}
      open={open}
      onOpenChange={handleOpenChange}
      onValueChange={(next) => {
        if (next) chooseTheme(next);
      }}
      modal={false}
    >
      <ThemeSwitcherTrigger open={open} current={committed} />
      <ThemeSwitcherPanel
        committedValue={theme}
        onPreview={handlePreview}
        onCommit={chooseTheme}
      />
    </Select.Root>
  );
}
