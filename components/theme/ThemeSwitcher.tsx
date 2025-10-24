'use client';

import { useTheme, ThemeName } from './ThemeProvider';

const themes: { value: ThemeName; label: string }[] = [
  { value: 'ink', label: 'Ink' },
  { value: 'noir', label: 'Noir' },
  { value: 'sunset', label: 'Sunset' },
  { value: 'ocean', label: 'Ocean' },
];

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="relative">
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as ThemeName)}
        className="uppercase text-xs font-bold rule px-3 py-2 rounded-[var(--radius)] bg-[var(--paper)] text-[var(--ink)] btn-ink cursor-pointer appearance-none pr-8"
        aria-label="Select theme"
      >
        {themes.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--ink)]">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

