'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Font, FontFamily } from '@/models/font.models';
import { useOptionalFamilyDetail } from './FamilyDetailContext';
import { isItalicFace } from './typePlaygroundState';
import CopyRow from './CopyRow';

function css2Spec(fonts: Font[]): string {
  if (fonts.length === 0) return '';
  const hasItalic = fonts.some((font) => isItalicFace(font));
  if (hasItalic) {
    const tuples = [...new Set(fonts.map((font) => `${isItalicFace(font) ? 1 : 0},${font.weight || 400}`))]
      .sort((a, b) => {
        const [ia, wa] = a.split(',').map(Number);
        const [ib, wb] = b.split(',').map(Number);
        return ia! - ib! || wa! - wb!;
      });
    return `:ital,wght@${tuples.join(';')}`;
  }
  const weights = [...new Set(fonts.map((font) => font.weight || 400))].sort((a, b) => a - b);
  if (weights.length > 1) return `:wght@${weights.join(';')}`;
  return weights[0] && weights[0] !== 400 ? `:wght@${weights[0]}` : '';
}

export default function UseFontPanel({ family }: { family: FontFamily }) {
  const ctx = useOptionalFamilyDetail();
  const activeFace = ctx?.state.selectedFace;
  const [copied, setCopied] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }, []);

  const info = useMemo(() => {
    const fonts = family.fonts || [];
    const target = activeFace ?? fonts.find((f) => f.weight === 400 && !isItalicFace(f)) ?? fonts[0];
    const cdnUrl = typeof target?.metadata?.cdnUrl === 'string' ? target.metadata.cdnUrl : undefined;
    const downloadUrl = typeof target?.metadata?.downloadUrl === 'string' ? target.metadata.downloadUrl : undefined;
    let origin = '';
    try { if (cdnUrl) origin = new URL(cdnUrl).origin; } catch { origin = ''; }
    const familyParam = encodeURIComponent(family.name).replace(/%20/g, '+');
    const cssHref = origin ? `${origin}/css2?family=${familyParam}${css2Spec(fonts)}&display=swap` : '';
    const linkSnippet = cssHref ? `<link rel="stylesheet" href="${cssHref}">` : '';
    return { cdnUrl, downloadUrl, cssHref, linkSnippet };
  }, [activeFace, family.fonts, family.name]);

  if (!info.cdnUrl && !info.cssHref) return null;

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied((k) => (k === key ? null : k)), 1500);
    } catch { /* ignore */ }
  };

  return (
    <section className="mt-6 rule p-4 rounded-[var(--radius)]">
      <div className="space-y-2">
        {info.linkSnippet && <CopyRow label="CSS" value={info.linkSnippet} copyKey="css" copied={copied} onCopy={copy} />}
        {info.cdnUrl && <CopyRow label="WOFF2" value={info.cdnUrl} copyKey="woff2" copied={copied} onCopy={copy} />}
        {info.downloadUrl && (
          <div className="flex items-center pt-1">
            <a href={info.downloadUrl} className="uppercase text-xs font-bold rule px-2.5 py-1.5 rounded-[var(--radius)] btn-ink">
              Download original
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
