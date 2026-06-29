import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { themeOptions, type ThemeName } from '@/lib/theme/themes';

export function useThemeListbox(theme: ThemeName, open: boolean, chooseTheme: (theme: ThemeName) => void, closeMenu: () => void) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(0, themeOptions.findIndex((option) => option.value === theme));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const activeTheme = themeOptions[activeIndex]?.value ?? theme;

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => listRef.current?.focus());
  }, [open]);

  const move = useCallback((delta: number) => {
    setActiveIndex((current) => (current + delta + themeOptions.length) % themeOptions.length);
  }, []);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') closeMenu();
    else if (event.key === 'ArrowDown') move(1);
    else if (event.key === 'ArrowUp') move(-1);
    else if (event.key === 'Home') setActiveIndex(0);
    else if (event.key === 'End') setActiveIndex(themeOptions.length - 1);
    else if (event.key === 'Enter' || event.key === ' ') chooseTheme(activeTheme);
    else return;
    event.preventDefault();
  }, [activeTheme, chooseTheme, closeMenu, move]);

  return { activeIndex, activeTheme, listRef, onKeyDown, selectedIndex, setActiveIndex };
}
