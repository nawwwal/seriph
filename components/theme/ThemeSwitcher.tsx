'use client';

import { Select } from '@base-ui/react/select';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { themeOptions, ThemeName } from '@/lib/theme/themes';
import { ThemeMenuOption } from './ThemeMenuOption';
import { buttonClassName } from '@/components/ui/buttonStyles';

export default function ThemeSwitcher() {
  const { theme, setTheme, previewTheme, clearPreviewTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const committedThemeRef = useRef(theme);
  const currentTheme = themeOptions.find((option) => option.value === theme) ?? themeOptions[0];
  useEffect(() => {
    committedThemeRef.current = theme;
  }, [theme]);
  const chooseTheme = useCallback((newTheme: ThemeName) => {
    committedThemeRef.current = newTheme;
    setTheme(newTheme);
    setOpen(false);
    clearPreviewTheme(newTheme);
  }, [clearPreviewTheme, setTheme]);
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) previewTheme(committedThemeRef.current);
    else clearPreviewTheme(committedThemeRef.current);
  }, [clearPreviewTheme, previewTheme]);
  const handleValueChange = useCallback((newTheme: ThemeName | null) => {
    if (newTheme) chooseTheme(newTheme);
  }, [chooseTheme]);

  return (
    <Select.Root<ThemeName> value={theme} open={open} onOpenChange={handleOpenChange} onValueChange={handleValueChange} modal={false}>
      <Select.Trigger
        type="button"
        className={buttonClassName({ size: 'themeSelect' })}
        aria-label="Select theme"
        aria-expanded={open}
      >
        <span>{currentTheme.label}</span>
        <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner side="bottom" align="end" sideOffset={1.5} alignItemWithTrigger={false} className="z-30">
          <Select.Popup
            data-theme={theme}
            onMouseLeave={() => clearPreviewTheme(committedThemeRef.current)}
            className="max-h-[min(70vh,32rem)] w-40 overflow-y-auto rule rounded-[var(--radius)] bg-[var(--paper)] text-[var(--ink)] theme-shadow-lg"
          >
            <Select.List>
              {themeOptions.map((option) => (
                <ThemeMenuOption key={option.value} option={option} previewTheme={previewTheme} />
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
