'use client';

import { useCallback, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { useOptionalFamilyDetail } from './FamilyDetailContext';

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
  familyId?: string;
}

/** Specimen container: live playground preview (type here, no separate tester box). */
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
  const ctx = useOptionalFamilyDetail();
  const localRef = useRef<HTMLTextAreaElement | null>(null);

  const registerEditor = ctx?.actions.registerEditor;

  const assignRef = useCallback((node: HTMLTextAreaElement | null) => {
    localRef.current = node;
    registerEditor?.(node);
  }, [registerEditor]);

  useLayoutEffect(() => {
    const el = localRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value, fontSize, lineHeight, letterSpacing, fontFamily, fontWeight, fontStyle, fontVariationSettings]);

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
    <section className="mt-4">
      <div
        className="specimen-container relative rule overflow-hidden rounded-[var(--radius)] p-6"
        style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--ink) 10%, transparent), transparent 60%)' }}
      >
        <div className="cover-stripe pointer-events-none absolute inset-0" />
        <textarea
          ref={assignRef}
          dir="ltr"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          aria-label="Type playground preview"
          className="specimen-text specimen-edge-fade relative z-10 w-full min-h-[12rem] resize-y border-0 bg-transparent p-0 outline-none theme-focus-ring md:min-h-[16rem]"
          style={style}
        />
      </div>
    </section>
  );
}
