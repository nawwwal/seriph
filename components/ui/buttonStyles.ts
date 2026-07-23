import { cn } from '@/lib/utils/cn';

export type ButtonSize =
  | 'authSubmit'
  | 'avatar'
  | 'clearIcon'
  | 'compact'
  | 'copy'
  | 'filterTiny'
  | 'icon'
  | 'iconText'
  | 'md'
  | 'mdInline'
  | 'mdText'
  | 'menuItem'
  | 'modalClose'
  | 'nav'
  | 'navAction'
  | 'navLink'
  | 'profileMenuItem'
  | 'quarantine'
  | 'roundIcon'
  | 'searchSuggestion'
  | 'sm'
  | 'text'
  | 'textIcon'
  | 'themeSelect'
  | 'uploadSubmit'
  | 'warningAction';

export type ButtonTone = 'active' | 'danger' | 'default' | 'info' | 'plain' | 'solid' | 'success' | 'warning' | 'warningSolid';
export type ButtonIconPosition = 'end' | 'none' | 'start';

export interface ButtonStyleOptions {
  className?: string;
  iconPosition?: ButtonIconPosition;
  size?: ButtonSize;
  tone?: ButtonTone;
}

const sizeClasses: Record<ButtonSize, string> = {
  authSubmit: 'inline-flex w-full h-11 items-center justify-center gap-2 uppercase font-bold rule rounded-[var(--radius)] text-sm',
  avatar: 'flex items-center justify-center w-5 h-5 rounded-full rule overflow-hidden theme-focus-ring transition',
  clearIcon: 'rule rounded-[var(--radius)] h-7 w-7 inline-flex items-center justify-center hover:ink-bg',
  compact: 'uppercase font-bold rule px-3 py-2 rounded-[var(--radius)] text-sm',
  copy: 'shrink-0 uppercase text-xs font-bold rule px-2 py-1.5 rounded-[var(--radius)] w-16 text-center',
  filterTiny: 'border border-[var(--ink)] rounded-[var(--radius)] px-2 py-1 text-xs uppercase font-bold',
  icon: 'inline-flex h-8 w-8 items-center justify-center rule rounded-[var(--radius)] p-2',
  iconText: 'inline-flex items-center gap-2 uppercase text-xs font-bold rule px-3 py-2 rounded-[var(--radius)]',
  md: 'uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] text-sm sm:text-base',
  mdInline: 'uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] inline-block',
  mdText: 'uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] text-sm',
  menuItem: 'flex w-full items-center gap-2 px-3 py-2 text-left uppercase text-xs font-bold',
  modalClose: 'absolute top-3 right-3 opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-[var(--muted)] theme-focus-ring',
  nav: 'uppercase font-bold rule px-3 py-1 rounded-[var(--radius)] text-sm transition-colors',
  navAction: 'relative h-8 uppercase font-bold rule px-3 py-1 rounded-[var(--radius)] text-sm',
  navLink: 'inline-flex h-8 min-w-24 items-center justify-center uppercase font-bold rule px-3 rounded-[var(--radius)] text-sm leading-none',
  profileMenuItem: 'w-full text-left uppercase font-bold text-sm px-3 py-2 rule-t hover:ink-bg transition',
  quarantine: 'flex items-center gap-2 uppercase text-xs font-bold px-3 py-2 rounded-[var(--radius)] transition-colors',
  roundIcon: 'inline-flex h-8 w-8 items-center justify-center rounded-full p-1',
  searchSuggestion: 'w-full flex items-center gap-2 px-3 py-2 text-left text-sm uppercase font-black hover:ink-bg',
  sm: 'uppercase text-xs font-bold rule px-2 py-1 rounded-[var(--radius)]',
  text: 'uppercase font-bold text-sm px-2 py-1',
  textIcon: 'inline-flex items-center gap-2 uppercase font-bold text-sm px-2 py-1',
  themeSelect:
    'inline-flex h-8 min-w-24 items-center justify-between gap-0 uppercase text-sm font-bold px-3 rounded-[var(--radius)] bg-[var(--paper)] text-[var(--ink)] leading-none outline-none focus:outline-none focus-visible:outline-none',
  uploadSubmit: 'w-full px-6 py-3 rounded-md font-semibold',
  warningAction: 'mt-2 uppercase text-xs font-bold px-3 py-1 rounded-[var(--radius)]',
};

function toneClass(size: ButtonSize, tone: ButtonTone): string {
  if (tone === 'plain') return '';
  if (size === 'roundIcon') {
    if (tone === 'danger') return 'text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]';
    if (tone === 'info') return 'text-[var(--info)] hover:bg-[color-mix(in_srgb,var(--info)_12%,transparent)]';
    if (tone === 'warning') return 'text-[var(--warning)] hover:bg-[color-mix(in_srgb,var(--warning)_12%,transparent)]';
  }

  if (tone === 'success') return 'bg-[var(--success)] text-[var(--paper)] hover:opacity-90 disabled:opacity-50 transition-colors';
  if (tone === 'warningSolid') return 'bg-[var(--warning)] text-[var(--paper)] hover:opacity-90 transition-colors';
  if (tone === 'danger') return 'text-[var(--danger)]';
  if (tone === 'active' || tone === 'solid') return 'btn-ink ink-bg';
  return 'btn-ink';
}

function sizeClass(size: ButtonSize, iconPosition: ButtonIconPosition | undefined): string {
  const base = sizeClasses[size];
  if (iconPosition !== 'end') return base;
  return base.startsWith('inline-flex ') ? base.replace('inline-flex ', 'inline-flex flex-row-reverse ') : cn('flex-row-reverse', base);
}

export function buttonClassName({
  className,
  iconPosition,
  size = 'md',
  tone = 'default',
}: ButtonStyleOptions = {}): string {
  return cn(sizeClass(size, iconPosition), toneClass(size, tone), className);
}
