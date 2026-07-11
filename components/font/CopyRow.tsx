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
    <div className="flex items-center gap-2">
      <span className="w-20 sm:w-24 shrink-0 uppercase text-xs font-bold opacity-60">{label}</span>
      <code
        className="flex-1 min-w-0 truncate text-xs font-mono rule px-2 py-1.5 rounded-[var(--radius)] bg-[color-mix(in_srgb,var(--ink)_10%,var(--paper))] text-[var(--ink)]"
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
