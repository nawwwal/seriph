'use client';

import { useEffect, useMemo } from 'react';
import type { FontFamily } from '@/models/font.models';
import { buildFamilyFontFaceRules } from '@/lib/hooks/fontFaceRules';

const registeredStyles = new Map<string, { count: number; fullCount: number }>();

export function useRegisterFamilyFonts(
  family: FontFamily | null | undefined,
  options?: { enabled?: boolean; representativeOnly?: boolean }
) {
  const enabled = options?.enabled ?? true;
  const representativeOnly = options?.representativeOnly ?? false;
  const styleId = family ? `seriph-fonts-${family.id}` : null;
  const fontFaceRules = useMemo(() => {
    if (!family || !family.fonts || family.fonts.length === 0) return '';
    return buildFamilyFontFaceRules(family, representativeOnly);
  }, [family, representativeOnly]);

  useEffect(() => {
    if (!styleId || !fontFaceRules || !enabled) return;
    const entry = registeredStyles.get(styleId) ?? { count: 0, fullCount: 0 };
    entry.count += 1;
    if (!representativeOnly) entry.fullCount += 1;
    registeredStyles.set(styleId, entry);

    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    if (!representativeOnly || entry.fullCount === 0 || !styleEl.textContent) {
      styleEl.textContent = fontFaceRules;
    }

    return () => {
      const current = registeredStyles.get(styleId);
      if (!current) return;
      current.count = Math.max(0, current.count - 1);
      if (!representativeOnly) current.fullCount = Math.max(0, current.fullCount - 1);
      if (current.count === 0) {
        registeredStyles.delete(styleId);
        document.getElementById(styleId)?.remove();
      }
    };
  }, [styleId, fontFaceRules, enabled, representativeOnly]);
}
