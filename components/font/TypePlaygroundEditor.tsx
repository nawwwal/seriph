'use client';

import type { CSSProperties } from 'react';

interface TypePlaygroundEditorProps {
  value: string;
  onChange: (value: string) => void;
  fontFamily: string;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  fontSize: number;
  letterSpacing: string;
  lineHeight: string;
  fontVariationSettings?: string;
}

export default function TypePlaygroundEditor({
  value,
  onChange,
  fontFamily,
  fontWeight,
  fontStyle,
  fontSize,
  letterSpacing,
  lineHeight,
  fontVariationSettings,
}: TypePlaygroundEditorProps) {
  const style: CSSProperties = {
    fontFamily,
    fontWeight,
    fontStyle,
    fontSize: `${fontSize}px`,
    letterSpacing,
    lineHeight,
    fontVariationSettings,
    direction: 'ltr',
    unicodeBidi: 'plaintext',
  };

  return (
    <textarea
      dir="ltr"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      aria-label="Type playground preview"
      className="w-full p-3 rule rounded-[var(--radius)] bg-[var(--paper)] resize-y theme-focus-ring min-h-[140px] md:min-h-[180px] outline-none"
      style={style}
    />
  );
}
