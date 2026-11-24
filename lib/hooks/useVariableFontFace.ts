'use client';

import { useEffect, useMemo } from 'react';
import type { Font } from '@/models/font.models';
import { isItalicFace } from '@/components/font/typePlaygroundState';
import { escapeCssString, fontFormatFromUrl } from '@/lib/utils/cssFont';

const variableStyleRefs = new Map<string, number>();

function metadataString(font: Font, key: string): string | undefined {
  const value = font.metadata?.[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/** Inject a unique @font-face for a variable font and return its CSS family name. */
export function useVariableFontFace(font: Font | null | undefined, fontFamilyName: string, enabled: boolean): string {
  const safeId = (font?.id ?? 'default').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const safeSubfamily = (font?.subfamily ?? 'Regular').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const safeFamily = fontFamilyName.replace(/[^a-zA-Z0-9_-]+/g, '_');
  const cssName = useMemo(
    () => `VFPlayground_${safeFamily}_${safeSubfamily}_${safeId}`,
    [safeFamily, safeSubfamily, safeId]
  );

  const cdn = font ? metadataString(font, 'cdnUrl') : undefined;
  const format = font?.format ?? 'WOFF2';
  const hasDynamicItalicAxis = Boolean(font?.variableAxes?.some((axis) => axis.tag === 'ital' || axis.tag === 'slnt'));
  const faceIsItalic = font ? isItalicFace(font) : false;

  useEffect(() => {
    if (!enabled || !font || !cdn) return;
    const styleId = `font-style-${cssName}`;
    variableStyleRefs.set(styleId, (variableStyleRefs.get(styleId) ?? 0) + 1);
    let el = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = styleId;
      document.head.appendChild(el);
    }
    const cssFormat = fontFormatFromUrl(cdn, format);
    const styles: Array<'normal' | 'italic'> = hasDynamicItalicAxis
      ? ['normal', 'italic']
      : [faceIsItalic ? 'italic' : 'normal'];
    el.textContent = styles
      .map((style) => `@font-face { font-family: '${escapeCssString(cssName)}'; src: url('${escapeCssString(cdn)}') format('${escapeCssString(cssFormat)}'); font-weight: 1 1000; font-style: ${style}; font-display: swap; }`)
      .join('\n');

    return () => {
      const nextCount = (variableStyleRefs.get(styleId) ?? 1) - 1;
      if (nextCount <= 0) {
        variableStyleRefs.delete(styleId);
        document.getElementById(styleId)?.remove();
      } else {
        variableStyleRefs.set(styleId, nextCount);
      }
    };
  }, [cdn, format, cssName, enabled, font, hasDynamicItalicAxis, faceIsItalic]);

  return cssName;
}
