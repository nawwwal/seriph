'use client';

import { useRef } from 'react';

interface FamilyHeaderActionsProps {
  onAddStyleFiles: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onTestInText: () => void;
}

const ghostClass =
  'uppercase text-xs font-bold px-2.5 py-1 rounded-[var(--radius)] opacity-70 transition-colors hover:opacity-100 hover:bg-[var(--ink)] hover:text-[var(--paper)]';

/** Compact-header ghost CTAs for family detail (no outline, hover only). */
export default function FamilyHeaderActions({
  onAddStyleFiles,
  onTestInText,
}: FamilyHeaderActionsProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="ml-auto flex h-full shrink-0 items-center gap-1">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".ttf,.otf,.woff,.woff2"
        className="hidden"
        onChange={onAddStyleFiles}
      />
      <button type="button" className={ghostClass} onClick={() => inputRef.current?.click()}>
        Add Style
      </button>
      <button type="button" className={ghostClass} onClick={onTestInText}>
        Test in Text
      </button>
    </div>
  );
}
