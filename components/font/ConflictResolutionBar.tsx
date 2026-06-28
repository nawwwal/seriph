'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ConflictResolution } from '@/models/ingest.models';

interface ConflictResolutionBarProps {
  conflictResolution: ConflictResolution;
  onAccept?: () => void;
  className?: string;
}

const CONFLICT_TYPE_LABELS: Record<ConflictResolution['type'], string> = {
  keep_alternates: 'Keep Alternates',
  replace_older: 'Replace Older',
  merge_stylistic_sets: 'Merge Stylistic Sets',
  quarantine: 'Quarantine',
};

export default function ConflictResolutionBar({
  conflictResolution,
  onAccept,
  className = '',
}: ConflictResolutionBarProps) {
  const isResolved = conflictResolution.resolvedAt !== undefined;

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-[var(--radius)] ${
        isResolved
          ? 'bg-[color-mix(in_srgb,var(--success)_12%,transparent)] border border-[var(--success)]'
          : 'bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] border border-[var(--warning)]'
      } ${className}`}
    >
      {isResolved ? (
        <CheckCircle2 className="text-[var(--success)] shrink-0 mt-0.5" size={16} />
      ) : (
        <AlertTriangle className="text-[var(--warning)] shrink-0 mt-0.5" size={16} />
      )}
      <div className="flex-1 text-xs">
        <div className={`font-bold ${isResolved ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
          Style Conflict Detected
        </div>
        <div className={`mt-1 ${isResolved ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
          Server decision: <strong>{CONFLICT_TYPE_LABELS[conflictResolution.type]}</strong>
          {conflictResolution.resolvedAt && (
            <span className="ml-2 opacity-70">
              (Resolved {new Date(conflictResolution.resolvedAt).toLocaleDateString()})
            </span>
          )}
        </div>
        {!isResolved && onAccept && (
          <button
            onClick={onAccept}
            className="mt-2 uppercase text-xs font-bold px-3 py-1 bg-[var(--warning)] text-[var(--paper)] rounded-[var(--radius)] hover:opacity-90 transition-colors"
          >
            Accept Decision
          </button>
        )}
      </div>
    </div>
  );
}

