import type { ThemeName } from '@/lib/theme/themes';

interface ThemeMenuOptionProps {
  active: boolean;
  chooseTheme: (theme: ThemeName) => void;
  index: number;
  menuId: string;
  option: { value: ThemeName; label: string };
  previewTheme: (theme: ThemeName) => void;
  selected: boolean;
  setActiveIndex: (index: number) => void;
}

export function ThemeMenuOption({
  active,
  chooseTheme,
  index,
  menuId,
  option,
  previewTheme,
  selected,
  setActiveIndex,
}: ThemeMenuOptionProps) {
  const activeClass = active && !selected ? 'bg-[var(--muted)]' : '';
  const selectedClass = selected ? 'ink-bg' : 'btn-ink';
  return (
    <div
      id={`${menuId}-${option.value}`}
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      onMouseEnter={() => {
        setActiveIndex(index);
        previewTheme(option.value);
      }}
      onClick={() => chooseTheme(option.value)}
      className={`flex h-10 w-full cursor-pointer items-center justify-between px-3 text-left uppercase text-sm font-bold leading-none ${selectedClass} ${activeClass}`}
    >
      <span>{option.label}</span>
      <span
        aria-hidden="true"
        data-theme={option.value}
        className="h-4 w-4 shrink-0 rule rounded-[var(--radius)] bg-[var(--paper)]"
        style={{ color: 'var(--ink)' }}
      />
    </div>
  );
}
