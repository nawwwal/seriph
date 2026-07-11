import type { ThemeName } from '@/lib/theme/themes';

interface ThemeSwatchProps {
  theme: ThemeName;
  size?: 'chip' | 'well';
  className?: string;
}

/** Two-token specimen: paper + ink only. */
export default function ThemeSwatch({
  theme,
  size = 'well',
  className = '',
}: ThemeSwatchProps) {
  if (size === 'chip') {
    return (
      <span
        aria-hidden="true"
        data-theme={theme}
        className={`relative inline-flex h-3.5 w-3.5 shrink-0 overflow-hidden rounded-full border border-[var(--ink)] ${className}`}
      >
        <span className="h-full w-1/2 bg-[var(--paper)]" />
        <span className="h-full w-1/2 bg-[var(--ink)]" />
      </span>
    );
  }

  return (
    <div
      aria-hidden="true"
      data-theme={theme}
      className={`relative aspect-square w-full overflow-hidden rounded-full border-2 border-[var(--ink)] bg-[var(--paper)] ${className}`}
    >
      <span className="absolute inset-0 bg-[var(--paper)]" />
      <span className="absolute inset-[22%] rounded-full bg-[var(--ink)]" />
    </div>
  );
}
