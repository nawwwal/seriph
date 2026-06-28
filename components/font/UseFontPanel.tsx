'use client';

import { useMemo, useState } from 'react';
import type { FontFamily } from '@/models/font.models';

function CopyRow({
  label,
  value,
  copyKey,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copyKey: string;
  copied: string | null;
  onCopy: (value: string, key: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 uppercase text-xs font-bold opacity-60">{label}</span>
      <code className="flex-1 truncate text-xs bg-[var(--surface,#f2f2f2)] px-2 py-1 rounded">{value}</code>
      <button
        type="button"
        onClick={() => onCopy(value, copyKey)}
        className="uppercase text-xs font-bold rule px-2 py-1 rounded-[var(--radius)] btn-ink"
      >
        {copied === copyKey ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

/**
 * Surfaces the stable, copyable ways to *use* a font: the CDN woff2 url, the
 * original download, and a Google-Fonts-style CSS <link> (the one-line drop-in).
 */
export default function UseFontPanel({ family }: { family: FontFamily }) {
  const [copied, setCopied] = useState<string | null>(null);

  const info = useMemo(() => {
    const fonts = family.fonts || [];
    const cover =
      fonts.find((f) => f.weight === 400 && !/italic/i.test(f.subfamily || f.style)) || fonts[0];
    const cdnUrl = (cover?.metadata as any)?.cdnUrl as string | undefined;
    const downloadUrl = (cover?.metadata as any)?.downloadUrl as string | undefined;

    let origin = '';
    try {
      if (cdnUrl) origin = new URL(cdnUrl).origin;
    } catch {
      origin = '';
    }

    const weights = [...new Set(fonts.map((f) => f.weight).filter(Boolean))].sort((a, b) => a - b);
    const spec =
      weights.length > 1
        ? `:wght@${weights.join(';')}`
        : weights[0] && weights[0] !== 400
          ? `:wght@${weights[0]}`
          : '';
    const familyParam = encodeURIComponent(family.name).replace(/%20/g, '+');
    const cssHref = origin ? `${origin}/css2?family=${familyParam}${spec}&display=swap` : '';
    const linkSnippet = cssHref ? `<link rel="stylesheet" href="${cssHref}">` : '';

    return { cdnUrl, downloadUrl, cssHref, linkSnippet };
  }, [family]);

  if (!info.cdnUrl && !info.cssHref) return null;

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((k) => (k === key ? null : k)), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="mt-6 rule p-4 rounded-[var(--radius)]">
      <h2 className="uppercase font-bold text-sm mb-3">Use this font</h2>
      <div className="space-y-2">
        {info.linkSnippet && (
          <CopyRow label="CSS link" value={info.linkSnippet} copyKey="css" copied={copied} onCopy={copy} />
        )}
        {info.cdnUrl && (
          <CopyRow label="woff2 URL" value={info.cdnUrl} copyKey="woff2" copied={copied} onCopy={copy} />
        )}
        {info.downloadUrl && (
          <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 uppercase text-xs font-bold opacity-60">Download</span>
            <a
              href={info.downloadUrl}
              className="uppercase text-xs font-bold rule px-2 py-1 rounded-[var(--radius)] btn-ink"
            >
              Download original
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
