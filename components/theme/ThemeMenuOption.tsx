import { Select } from '@base-ui/react/select';
import type { ThemeName } from '@/lib/theme/themes';
import { themeMenuOptionClassName } from './themeMenuOptionStyles';

interface ThemeMenuOptionProps {
  option: { value: ThemeName; label: string };
  previewTheme: (theme: ThemeName) => void;
}

export function ThemeMenuOption({
  option,
  previewTheme,
}: ThemeMenuOptionProps) {
  return (
    <Select.Item
      value={option.value}
      label={option.label}
      onFocus={() => previewTheme(option.value)}
      onMouseEnter={() => previewTheme(option.value)}
      className={({ highlighted, selected }) => themeMenuOptionClassName({ highlighted, selected })}
    >
      <span>{option.label}</span>
      <span
        aria-hidden="true"
        data-theme={option.value}
        className="h-4 w-4 shrink-0 rule rounded-[var(--radius)] bg-[var(--paper)]"
        style={{ color: 'var(--ink)' }}
      />
    </Select.Item>
  );
}
