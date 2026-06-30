'use client';

import { useState } from 'react';
import type { FontFamily } from '@/models/font.models';
import { Button } from '@/components/ui/Button';

export default function FamilyFooter({ family }: { family: FontFamily }) {
  const [shareLabel, setShareLabel] = useState<'Share' | 'Copied' | 'Failed'>('Share');
  const [downloadLabel, setDownloadLabel] = useState<'Download' | 'Preparing…' | 'Failed'>('Download');
  const meta = family.metadata;
  const history = meta?.historical_context;

  const share = async () => {
    try {
      await navigator.clipboard.writeText(typeof window !== 'undefined' ? window.location.href : '');
      setShareLabel('Copied');
    } catch {
      setShareLabel('Failed');
    }
    setTimeout(() => setShareLabel('Share'), 1500);
  };

  const download = async () => {
    setDownloadLabel('Preparing…');
    try {
      const { downloadFamilyZip } = await import('@/lib/utils/downloadFamilyZip');
      const ok = await downloadFamilyZip(family);
      setDownloadLabel(ok ? 'Download' : 'Failed');
    } catch {
      setDownloadLabel('Failed');
    }
    if (downloadLabel === 'Failed') setTimeout(() => setDownloadLabel('Download'), 1500);
  };

  return (
    <footer className="mt-10 rule-t pt-4 sm:pt-5 md:pt-6 text-sm sm:text-base">
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rule-r pr-4">
          <div className="uppercase font-bold">About</div>
          <p className="mt-2">{family.description || 'No description yet. Once analysis runs, this family earns its own write-up.'}</p>
          {history && (
            <div className="mt-3 space-y-1">
              {history.period && <p className="text-xs opacity-70"><span className="font-bold">Period:</span> {history.period}</p>}
              {history.cultural_influence && history.cultural_influence.length > 0 && (
                <p className="text-xs opacity-70"><span className="font-bold">Influences:</span> {history.cultural_influence.join(', ')}</p>
              )}
            </div>
          )}
        </div>
        <div className="rule-r pr-4">
          <div className="uppercase font-bold">Details</div>
          <div className="mt-2 text-sm space-y-1">
            {family.uploadDate && <p><span className="font-bold">Uploaded:</span> {new Date(family.uploadDate).toLocaleDateString()}</p>}
            {family.fonts[0]?.metadata?.version && <p><span className="font-bold">Version:</span> {family.fonts[0].metadata.version}</p>}
            {meta?.foundry && <p><span className="font-bold">Foundry:</span> {meta.foundry}</p>}
            {meta?.subClassification && <p><span className="font-bold">Style:</span> {meta.subClassification}</p>}
            {meta?.license && <p><span className="font-bold">License:</span> {meta.license.type}</p>}
          </div>
        </div>
        <div>
          <div className="uppercase font-bold">Actions</div>
          <div className="mt-2 flex gap-2">
            <Button onClick={download} disabled={downloadLabel === 'Preparing…'} size="compact">
              {downloadLabel}
            </Button>
            <Button onClick={share} size="compact">
              {shareLabel}
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}
