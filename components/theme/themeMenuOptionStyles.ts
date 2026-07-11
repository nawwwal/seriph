/** Class names for theme menu list options (Base UI Select item states). */

const BASE =
  'flex h-10 w-full cursor-pointer items-center justify-between px-3 text-left uppercase text-sm font-bold leading-none';

export function themeMenuOptionClassName(opts: {
  highlighted: boolean;
  selected: boolean;
}): string {
  if (opts.selected) return `${BASE} ink-bg`;
  if (opts.highlighted) return `${BASE} btn-ink bg-[var(--muted)]`;
  return `${BASE} btn-ink`;
}
