'use client';

import ProgressBar from '@/components/ui/ProgressBar';
import Link from 'next/link';

export type UploadStatus = 'uploaded' | 'processing' | 'completed' | 'failed';

export interface UploadItem {
  ingestId?: string;
  fileName: string;
  status: UploadStatus;
  error?: string | null;
  familyId?: string | null;
  familyName?: string | null;
}

interface ProcessingViewProps {
  uploads: UploadItem[];
  phase: 'processing' | 'summary';
}

const STATUS_LABELS: Record<UploadStatus, string> = {
  uploaded: 'Uploaded',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
};

export default function ProcessingView({ uploads, phase }: ProcessingViewProps) {
  const total = uploads.length;
  const completed = uploads.filter((upload) => upload.status === 'completed').length;
  const failed = uploads.filter((upload) => upload.status === 'failed').length;
  const inProgress = uploads.filter(
    (upload) => upload.status === 'processing' || upload.status === 'uploaded'
  ).length;
  const progress = total === 0 ? 0 : Math.round(((completed + failed) / total) * 100);

  return (
    <div className="mt-6 sm:mt-8 md:mt-10 rule rounded-[var(--radius)] p-6 fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="uppercase font-black text-xl">
            {phase === 'processing' ? 'Processing Fonts' : 'Import Summary'}
          </h2>
          <p className="text-sm opacity-70 mt-1">
            {completed} completed · {inProgress} in progress · {failed} failed
          </p>
        </div>
        <div className="uppercase text-sm font-bold">
          <span>{completed + failed}</span>/<span>{total}</span> Done
        </div>
      </div>

      <ProgressBar progress={progress} />

      <div className="mt-6 space-y-3">
        {uploads.map((upload) => {
          const statusLabel = STATUS_LABELS[upload.status];
          const isTerminal = upload.status === 'completed' || upload.status === 'failed';
          const statusClass =
            upload.status === 'completed'
              ? 'ink-bg text-[var(--paper)]'
              : upload.status === 'failed'
              ? 'bg-red-600 text-white'
              : 'btn-ink';

          return (
            <div
              key={upload.ingestId ?? `${upload.fileName}-${statusLabel}`}
              className="rule p-4 rounded-[var(--radius)] slide-in flex flex-col gap-2"
            >
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
                  {upload.error && (
                    <div className="text-sm mt-1 text-red-600">{upload.error}</div>
                  )}
                </div>
                <span
                  className={`uppercase text-xs font-bold px-2 py-1 rounded-[var(--radius)] whitespace-nowrap ${statusClass}`}
                >
                  {statusLabel}
                </span>
              </div>
              {!isTerminal && (
                <div className="text-sm opacity-70">
                  Waiting for processing to finish…
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-between items-center">
        <div className="text-sm">
          <span className="font-bold">Progress:</span> {progress}% complete
        </div>

        <Link
          href="/"
          className="uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] btn-ink text-sm"
        >
          View Shelf <span className="caret"></span>
        </Link>
      </div>
    </div>
  );
}
