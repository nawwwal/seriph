import type { IngestRecord } from '@/models/ingest.models';
import type { CombinedStatus } from '@/lib/upload/combinedStatus';

/** One upload row: name, stage badge, two-lane progress bar, optional error. */
export default function UploadCenterRow({ ing, status }: { ing: IngestRecord; status: CombinedStatus }) {
  const badgeClass =
    status.stage === 'complete'
      ? 'ink-bg text-[var(--paper)]'
      : status.stage === 'error' || status.stage === 'quarantined'
        ? 'bg-[var(--danger)] text-[var(--paper)]'
        : 'btn-ink';

  return (
    <div className="rule rounded-[var(--radius)] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="font-bold truncate">{ing.originalName}</div>
        <span className={`uppercase text-[10px] font-bold px-2 py-0.5 rounded-[var(--radius)] whitespace-nowrap ${badgeClass}`}>
          {status.displayText}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full bg-[var(--muted)] rounded-full overflow-hidden">
        <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${status.percent}%` }} />
      </div>
      {ing.error && <div className="mt-1 text-xs text-[var(--danger)] truncate">{ing.error}</div>}
    </div>
  );
}
