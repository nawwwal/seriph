'use client';

import { Button } from '@/components/ui/Button';

/** A labelled, truncated value with a copy-to-clipboard button. */
export default function CopyRow({
  label,
  value,
  copyKey,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copyKey: string;
  copied: string | null;
  onCopy: (value: string, key: string) => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex">
      <span className="col-span-2 sm:w-24 shrink-0 uppercase text-xs font-bold opacity-60">{label}</span>
      <code
        className="flex-1 min-w-0 truncate text-xs font-mono rule px-2 py-1.5 rounded-[var(--radius)] bg-transparent"
        title={value}
      >
        {value}
      </code>
      <Button
        type="button"
        onClick={() => onCopy(value, copyKey)}
        size="copy"
      >
        {copied === copyKey ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}
