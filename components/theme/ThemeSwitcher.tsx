'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { themeOptions, ThemeName } from '@/lib/theme/themes';
import { ThemeMenuOption } from './ThemeMenuOption';
import { useThemeListbox } from './useThemeListbox';

export default function ThemeSwitcher() {
  const { theme, setTheme, previewTheme, clearPreviewTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const currentTheme = themeOptions.find((option) => option.value === theme) ?? themeOptions[0];
  const closeMenu = useCallback(() => {
    setOpen(false);
    clearPreviewTheme();
  }, [clearPreviewTheme]);
  const chooseTheme = useCallback((newTheme: ThemeName) => {
    setTheme(newTheme);
    setOpen(false);
  }, [setTheme]);
  const { activeIndex, activeTheme, listRef, onKeyDown, selectedIndex, setActiveIndex } = useThemeListbox(theme, open, chooseTheme, closeMenu);
  useEffect(() => {
    if (open) previewTheme(activeTheme);
  }, [activeTheme, open, previewTheme]);
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) closeMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeMenu, open]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) closeMenu();
      }}
    >
      <button
        type="button"
        onClick={() => {
          if (!open) setActiveIndex(selectedIndex);
          setOpen((isOpen) => !isOpen);
        }}
        className="inline-flex h-8 min-w-24 items-center justify-between gap-3 uppercase text-sm font-bold rule px-3 rounded-[var(--radius)] bg-[var(--paper)] text-[var(--ink)] leading-none btn-ink"
        aria-label="Select theme"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
      >
        <span>{currentTheme.label}</span>
        <ChevronDown size={16} strokeWidth={2} />
      </button>
      {open && (
        <div
          id={menuId}
          role="listbox"
          aria-label="Theme"
          aria-activedescendant={`${menuId}-${activeTheme}`}
          ref={listRef}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onMouseLeave={clearPreviewTheme}
          className="absolute right-0 top-[calc(100%+var(--rule))] z-30 max-h-[min(70vh,32rem)] w-40 overflow-y-auto rule rounded-[var(--radius)] bg-[var(--paper)] text-[var(--ink)] shadow-[0_12px_30px_var(--shadow)]"
        >
          {themeOptions.map((option, index) => (
            <ThemeMenuOption
              key={option.value}
              active={index === activeIndex}
              chooseTheme={chooseTheme}
              index={index}
              menuId={menuId}
              option={option}
              previewTheme={previewTheme}
              selected={option.value === theme}
              setActiveIndex={setActiveIndex}
            />
          ))}
        </div>
      )}
    </div>
  );
}
