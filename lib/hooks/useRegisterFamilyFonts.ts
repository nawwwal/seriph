'use client';

import { useEffect, useMemo } from 'react';
import type { FontFamily } from '@/models/font.models';
import { buildFamilyFontFaceRules } from '@/lib/hooks/fontFaceRules';

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

    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = fontFaceRules;
    return () => {
      document.getElementById(styleId)?.remove();
    };
  }, [styleId, fontFaceRules, enabled]);
}
