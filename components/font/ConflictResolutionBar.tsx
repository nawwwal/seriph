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
          ? 'bg-green-50 border border-green-200'
          : 'bg-yellow-50 border border-yellow-200'
      } ${className}`}
    >
      {isResolved ? (
        <CheckCircle2 className="text-green-600 shrink-0 mt-0.5" size={16} />
      ) : (
        <AlertTriangle className="text-yellow-600 shrink-0 mt-0.5" size={16} />
      )}
      <div className="flex-1 text-xs">
        <div className={`font-bold ${isResolved ? 'text-green-800' : 'text-yellow-800'}`}>
          Style Conflict Detected
        </div>
        <div className={`mt-1 ${isResolved ? 'text-green-700' : 'text-yellow-700'}`}>
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
            className="mt-2 uppercase text-xs font-bold px-3 py-1 bg-yellow-600 text-white rounded-[var(--radius)] hover:bg-yellow-700 transition-colors"
          >
            Accept Decision
          </button>
        )}
      </div>
    </div>
  );
}

