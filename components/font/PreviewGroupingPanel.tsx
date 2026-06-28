'use client';

import { useMemo } from 'react';
import { NORMALIZATION_SPEC_VERSION } from '@/utils/normalizationSpec';
import NormalizationSpecVersion from './NormalizationSpecVersion';
import PreviewFamilyCard from './PreviewFamilyCard';
import { groupFilesByFamily, type PreviewFile } from '@/lib/upload/previewGrouping';

export type { PreviewFile } from '@/lib/upload/previewGrouping';

interface PreviewGroupingPanelProps {
  files: PreviewFile[];
  onRemoveFile?: (id: string) => void;
  serverSpecVersion?: string;
}

export default function PreviewGroupingPanel({ files, onRemoveFile, serverSpecVersion }: PreviewGroupingPanelProps) {
  const families = useMemo(() => groupFilesByFamily(files), [files]);

  if (families.length === 0) {
    return (
      <div className="rule p-4 rounded-[var(--radius)] bg-[var(--surface)]">
        <p className="text-sm opacity-70">No families detected yet. Parsing fonts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rule-b pb-2">
        <h3 className="uppercase font-bold text-sm">Preview Grouping</h3>
        <span className="uppercase text-xs font-bold opacity-70 px-2 py-1 rule rounded-[var(--radius)]">Provisional</span>
      </div>

      {serverSpecVersion && (
        <NormalizationSpecVersion clientVersion={NORMALIZATION_SPEC_VERSION} serverVersion={serverSpecVersion} />
      )}

      <div className="space-y-3">
        {families.map((family) => (
          <PreviewFamilyCard key={family.normalizedName} family={family} onRemoveFile={onRemoveFile} />
        ))}
      </div>
    </div>
  );
}
