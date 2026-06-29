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
export function useVariableFontFace(font: Font, fontFamilyName: string, enabled: boolean): string {
  const cssName = useMemo(
    () => `VFPlayground_${fontFamilyName.replace(/\s+/g, '_')}_${font.subfamily.replace(/\s+/g, '_')}`,
    [fontFamilyName, font.subfamily]
  );

  const cdn = metadataString(font, 'cdnUrl');
  const storagePath = metadataString(font, 'storagePath');

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
    el.textContent = `@font-face { font-family: '${cssString(cssName)}'; src: url('${cssString(src)}') format('${cssString(format)}'); font-weight: normal; font-style: normal; }`;
  }, [cdn, storagePath, font.format, cssName, enabled]);

  return cssName;
}
