import { cn } from '@/lib/utils/cn';

interface ThemeMenuOptionStyleOptions {
  highlighted: boolean;
  selected: boolean;
}

const optionBaseClass =
  'flex h-10 w-full cursor-pointer items-center justify-between px-3 text-left uppercase text-sm font-bold leading-none';

export function themeMenuOptionClassName({ highlighted, selected }: ThemeMenuOptionStyleOptions): string {
  return cn(optionBaseClass, selected ? 'ink-bg' : 'btn-ink', highlighted && !selected ? 'bg-[var(--muted)]' : '');
}
