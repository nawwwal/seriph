import type { UploadItem, UploadStatus } from './ProcessingView';

const STATUS_LABELS: Record<UploadStatus, string> = {
  uploaded: 'Uploaded',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
};

export default function ProcessingRow({ upload }: { upload: UploadItem }) {
  const statusLabel = STATUS_LABELS[upload.status];
  const isTerminal = upload.status === 'completed' || upload.status === 'failed';
  const statusClass =
    upload.status === 'completed'
      ? 'ink-bg text-[var(--paper)]'
      : upload.status === 'failed'
        ? 'bg-[var(--danger)] text-[var(--paper)]'
        : 'btn-ink';

  return (
    <div className="rule p-4 rounded-[var(--radius)] slide-in flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate">{upload.fileName}</div>
          {upload.familyName ? (
            <div className="text-sm opacity-80 mt-1 truncate">
              Added to <span className="font-semibold">{upload.familyName}</span>
            </div>
          ) : upload.familyId && upload.status === 'completed' ? (
            <div className="text-sm opacity-70 mt-1 truncate">
              Family ID: <span className="font-semibold">{upload.familyId}</span>
            </div>
          ) : null}
          {upload.error && <div className="text-sm mt-1 text-[var(--danger)]">{upload.error}</div>}
        </div>
        <span className={`uppercase text-xs font-bold px-2 py-1 rounded-[var(--radius)] whitespace-nowrap ${statusClass}`}>
          {statusLabel}
        </span>
      </div>
      {!isTerminal && <div className="text-sm opacity-70">Waiting for processing to finish…</div>}
    </div>
  );
}
