'use client';

import { useEffect, useRef, useState } from 'react';
import type { FontFamily } from '@/models/font.models';
import { Button } from '@/components/ui/Button';

export default function FamilyFooter({ family }: { family: FontFamily }) {
  const [shareLabel, setShareLabel] = useState<'Share' | 'Copied' | 'Failed'>('Share');
  const [downloadLabel, setDownloadLabel] = useState<'Download' | 'Preparing…' | 'Failed'>('Download');
  const shareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const downloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
    if (downloadTimerRef.current) clearTimeout(downloadTimerRef.current);
  }, []);

  const meta = family.metadata;
  const history = meta?.historical_context;
  const metadataValues = [
    meta?.foundry,
    meta?.subClassification,
    meta?.license?.type,
    family.fonts[0]?.metadata?.version,
    family.uploadDate ? new Date(family.uploadDate).toLocaleDateString() : undefined,
    history?.period,
    history?.cultural_influence?.join(', '),
  ].filter((v): v is string => Boolean(v && v.trim()));

  const share = async () => {
    try {
      await navigator.clipboard.writeText(typeof window !== 'undefined' ? window.location.href : '');
      setShareLabel('Copied');
    } catch {
      setShareLabel('Failed');
    }
    if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
    shareTimerRef.current = setTimeout(() => setShareLabel('Share'), 1500);
  };

  const download = async () => {
    setDownloadLabel('Preparing…');
    let failed = false;
    try {
      const { downloadFamilyZip } = await import('@/lib/utils/downloadFamilyZip');
      const ok = await downloadFamilyZip(family);
      failed = !ok;
      setDownloadLabel(ok ? 'Download' : 'Failed');
    } catch {
      failed = true;
      setDownloadLabel('Failed');
    }
    if (failed) {
      if (downloadTimerRef.current) clearTimeout(downloadTimerRef.current);
      downloadTimerRef.current = setTimeout(() => setDownloadLabel((cur) => (cur === 'Failed' ? 'Download' : cur)), 1500);
    }
  };

  return (
    <footer className="mt-10 rule-t pt-4 sm:pt-5 md:pt-6 text-sm sm:text-base">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {metadataValues.length > 0 && <p className="text-sm opacity-75">{metadataValues.join(' · ')}</p>}
        <div className="flex gap-2 shrink-0 sm:ml-auto">
          <Button onClick={download} disabled={downloadLabel === 'Preparing…'} size="compact">{downloadLabel}</Button>
          <Button onClick={share} size="compact">{shareLabel}</Button>
        </div>
      </div>
    </footer>
  );
}
