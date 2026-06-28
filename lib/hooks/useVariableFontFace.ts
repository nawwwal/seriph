'use client';

import { useEffect, useMemo } from 'react';
import type { Font } from '@/models/font.models';

/** Inject a unique @font-face for a variable font and return its CSS family name. */
export function useVariableFontFace(font: Font, fontFamilyName: string, enabled: boolean): string {
  const cssName = useMemo(
    () => `VFPlayground_${fontFamilyName.replace(/\s+/g, '_')}_${font.subfamily.replace(/\s+/g, '_')}`,
    [fontFamilyName, font.subfamily]
  );

  const cdn = (font as any)?.metadata?.cdnUrl as string | undefined;
  const storagePath = (font as any)?.metadata?.storagePath as string | undefined;

  useEffect(() => {
    if (!enabled) return;
    const styleId = `font-style-${cssName}`;
    let el = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = styleId;
      document.head.appendChild(el);
    }
    const src = cdn || (storagePath ? `/api/font/gcs?path=${encodeURIComponent(storagePath)}` : undefined);
    if (!src) return;
    const ext = (src.split('?')[0].split('.').pop() || '').toLowerCase();
    const format = ext === 'woff2' ? 'woff2' : font.format === 'TTF' ? 'truetype' : font.format.toLowerCase();
    el.innerHTML = `@font-face { font-family: '${cssName}'; src: url('${src}') format('${format}'); font-weight: normal; font-style: normal; }`;
  }, [cdn, storagePath, font.format, cssName, enabled]);

  return cssName;
}
