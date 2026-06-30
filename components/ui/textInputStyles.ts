import { cn } from '@/lib/utils/cn';

export type TextInputSize = 'confirm' | 'form' | 'navSearch' | 'search';

interface TextInputStyleOptions {
  className?: string;
  size?: TextInputSize;
}

const sizeClasses: Record<TextInputSize, string> = {
  confirm: 'mt-4 w-full rule rounded-[var(--radius)] bg-[var(--surface)] px-3 py-2 font-bold theme-focus-ring',
  form: 'w-full rule rounded-[var(--radius)] bg-[var(--paper)] px-3 py-2 text-base theme-focus-ring',
  navSearch: 'h-8 w-full rule rounded-[var(--radius)] bg-[var(--paper)] px-3 py-1 text-sm theme-focus-ring',
  search: 'flex-1 rule rounded-[var(--radius)] bg-[var(--paper)] px-4 py-2 text-sm theme-focus-ring',
};

export function textInputClassName({ className, size = 'form' }: TextInputStyleOptions = {}): string {
  return cn(sizeClasses[size], className);
}
