'use client';

import { useEffect } from 'react';
import type { FontFamily, Font as FontVariant } from '@/models/font.models';

function cssFormatFor(fontFormat: string): string {
  const fmt = (fontFormat || '').toLowerCase();
  if (fmt === 'ttf') return 'truetype';
  if (fmt === 'otf') return 'opentype';
  if (fmt === 'woff2') return 'woff2';
  if (fmt === 'woff') return 'woff';
  return fmt || 'truetype';
}

function buildFontFaceRule(
  familyName: string,
  variant: FontVariant,
  proxiedSrc: string
): string {
  const isItalic = (variant.style || variant.subfamily || '').toLowerCase().includes('italic');
  const weight = variant.weight || 400;
  const format = cssFormatFor(String(variant.format || ''));

  // For variable fonts with a weight axis defined, declare a range
  // This assumes downloadUrl points to the variable font file
  const weightRange = (() => {
    if (!variant.isVariable || !variant.variableAxes || variant.variableAxes.length === 0) return String(weight);
    const wght = variant.variableAxes.find(a => a.tag === 'wght');
    if (!wght) return String(weight);
    const min = Math.floor(wght.minValue);
    const max = Math.ceil(wght.maxValue);
    if (min >= max) return String(weight);
    return `${min} ${max}`;
  })();

  return `@font-face {
    font-family: '${familyName}';
    src: url('${proxiedSrc}') format('${format}');
    font-weight: ${weightRange};
    font-style: ${isItalic ? 'italic' : 'normal'};
    font-display: swap;
  }`;
}

export function useRegisterFamilyFonts(family: FontFamily | null | undefined) {
  useEffect(() => {
    if (!family || !family.fonts || family.fonts.length === 0) return;

    const styleId = `seriph-fonts-${family.id}`;
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    // Build rules for each variant, proxying URLs through our API to avoid CORS
    const rules: string[] = [];
    const seen = new Set<string>();
    for (const v of family.fonts) {
      const storagePath = v?.metadata?.storagePath || null;
      if (!storagePath) continue;
      // Deduplicate by font id or src
      const key = `${v.id}::${storagePath}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const proxied = `/api/font/gcs?path=${encodeURIComponent(storagePath)}`;
      rules.push(buildFontFaceRule(family.name, v, proxied));
    }

    styleEl.innerHTML = rules.join('\n\n');

    // No cleanup to persist loaded fonts; updating is handled by replacing innerHTML
  }, [family?.id, family?.name, JSON.stringify(family?.fonts ?? [])]);
}

