'use client';

import { AlertTriangle, Info } from 'lucide-react';
import { compareSpecVersions, shouldWarnAboutSpecMismatch, NORMALIZATION_SPEC_VERSION } from '@/utils/normalizationSpec';

interface NormalizationSpecVersionProps {
  clientVersion?: string;
  serverVersion?: string;
  className?: string;
}

export default function NormalizationSpecVersion({
  clientVersion = NORMALIZATION_SPEC_VERSION,
  serverVersion,
  className = '',
}: NormalizationSpecVersionProps) {
  if (!serverVersion) {
    return null;
  }

  const comparison = compareSpecVersions(clientVersion, serverVersion);
  const shouldWarn = shouldWarnAboutSpecMismatch(clientVersion, serverVersion);
  const isOutdated = comparison < 0;

  if (!shouldWarn && comparison === 0) {
    return null; // Versions match, no warning needed
  }

  return (
    <div
      className={`flex items-start gap-2 p-3 rounded-[var(--radius)] ${
        isOutdated
          ? 'bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] border border-[var(--warning)]'
          : 'bg-[color-mix(in_srgb,var(--info)_12%,transparent)] border border-[var(--info)]'
      } ${className}`}
    >
      {isOutdated ? (
        <AlertTriangle className="text-[var(--warning)] shrink-0 mt-0.5" size={16} />
      ) : (
        <Info className="text-[var(--info)] shrink-0 mt-0.5" size={16} />
      )}
      <div className="flex-1 text-xs">
        <div className={`font-bold ${isOutdated ? 'text-[var(--warning)]' : 'text-[var(--info)]'}`}>
          Normalization Spec Mismatch
        </div>
        <div className={`mt-1 ${isOutdated ? 'text-[var(--warning)]' : 'text-[var(--info)]'}`}>
          {isOutdated ? (
            <>
              Client version ({clientVersion}) is older than server ({serverVersion}). Preview
              groupings may differ from final results.
            </>
          ) : (
            <>
              Client version ({clientVersion}) differs from server ({serverVersion}). Preview
              groupings are provisional.
            </>
          )}
        </div>
      </div>
    </div>
  );
}

