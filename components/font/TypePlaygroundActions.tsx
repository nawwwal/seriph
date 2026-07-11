'use client';

import { Button } from '@/components/ui/Button';

/** Reset + Copy CSS — sits on the style toolbar row. */
export default function TypePlaygroundActions({
  copyLabel,
  onReset,
  onCopy,
}: {
  copyLabel: string;
  onReset: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      <Button onClick={onReset} size="compact">
        Reset
      </Button>
      <Button
        onClick={onCopy}
        size="compact"
        className="min-w-[6.5rem]"
        aria-label="Copy CSS"
      >
        {copyLabel}
      </Button>
    </div>
  );
}
