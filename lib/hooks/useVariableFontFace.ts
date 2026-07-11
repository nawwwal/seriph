'use client';

import { useEffect, useMemo } from 'react';
import type { Font } from '@/models/font.models';

function cssString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function metadataString(font: Font, key: string): string | undefined {
  const value = font.metadata?.[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/** Inject a unique @font-face for a variable font and return its CSS family name. */
export function useVariableFontFace(font: Font | null | undefined, fontFamilyName: string, enabled: boolean): string {
  const subfamily = font?.subfamily ?? 'Regular';
  const cssName = useMemo(
    () => `VFPlayground_${fontFamilyName.replace(/\s+/g, '_')}_${subfamily.replace(/\s+/g, '_')}`,
    [fontFamilyName, subfamily]
  );

  const cdn = font ? metadataString(font, 'cdnUrl') : undefined;
  const storagePath = font ? metadataString(font, 'storagePath') : undefined;
  const format = font?.format ?? 'WOFF2';

  useEffect(() => {
    if (!enabled || !font) return;
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
    const cssFormat = ext === 'woff2' ? 'woff2' : format === 'TTF' ? 'truetype' : format.toLowerCase();
    el.textContent = `@font-face { font-family: '${cssString(cssName)}'; src: url('${cssString(src)}') format('${cssString(cssFormat)}'); font-weight: 1 1000; font-style: normal; font-display: swap; }`;
  }, [cdn, storagePath, format, cssName, enabled, font]);

  return cssName;
}
