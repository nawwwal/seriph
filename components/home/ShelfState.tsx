'use client';

import { FontFamily } from '@/models/font.models';
import { IngestRecord } from '@/models/ingest.models';
import FamilyCover from '@/components/font/FamilyCover';

interface ShelfStateProps {
  families: FontFamily[];
  pendingIngests: IngestRecord[];
  shelfMode: 'spines' | 'covers';
  onAddFonts: () => void;
}

const formatUploadStatus = (status: string) => {
  switch (status) {
    case 'uploaded':
      return 'Queued';
    case 'processing':
    case 'finalized':
    case 'file_moved':
      return 'Processing';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
};

const statusBadgeClass = (status: string) => {
  if (status === 'failed') return 'bg-red-600 text-white';
  if (status === 'completed') return 'ink-bg text-[var(--paper)]';
  return 'btn-ink';
};

export default function ShelfState({
  families,
  pendingIngests,
  shelfMode,
  onAddFonts,
}: ShelfStateProps) {
  const activeUploads = pendingIngests.filter((ingest) => ingest.status !== 'completed');

  return (
    <main className="mt-6 sm:mt-8 md:mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 grid-poster-gap auto-rows-fr">
      {activeUploads.map((ingest) => {
        const statusLabel = formatUploadStatus(ingest.status);
        return (
          <div
            key={`ingest-${ingest.id}`}
            className="rule p-4 sm:p-5 md:p-6 rounded-[var(--radius)] flex flex-col justify-between gap-4 bg-[var(--surface)]"
          >
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="uppercase text-xs font-bold opacity-70">Upload</div>
                <span
                  className={`uppercase text-xs font-bold px-2 py-1 rounded-[var(--radius)] whitespace-nowrap ${statusBadgeClass(
                    ingest.status
                  )}`}
                >
                  {statusLabel}
                </span>
              </div>
              <div className="mt-3 font-bold text-lg truncate">{ingest.originalName}</div>
              {ingest.familyId && (
                <div className="text-sm opacity-70 mt-1 truncate">
                  Target family: {ingest.familyId}
                </div>
              )}
            </div>
            <div className="text-sm opacity-70">
              {ingest.error
                ? `Error: ${ingest.error}`
                : statusLabel === 'Queued'
                ? 'Waiting for processing to start.'
                : 'Processing in the background. This page updates when finished.'}
            </div>
          </div>
        );
      })}

      {families.map((family) => (
        <FamilyCover key={family.id} family={family} mode={shelfMode} />
      ))}

      <div
        className="relative rule p-4 sm:p-5 md:p-6 rounded-[var(--radius)] flex flex-col justify-between group cursor-pointer"
        onClick={onAddFonts}
      >
        <div>
          <div className="uppercase font-extrabold text-2xl sm:text-3xl md:text-4xl cap-tight">
            Drop Fonts
          </div>
          <p className="mt-2 text-sm sm:text-base">Drag files here or use Add Fonts.</p>
        </div>
        <div className="mt-6 rule-t pt-3 uppercase text-sm font-bold caret">
          TTF, OTF, WOFF, WOFF2
        </div>
        <div className="absolute inset-0 bg-[var(--accent)] opacity-0 transition-opacity pointer-events-none group-hover:opacity-5 rounded-[var(--radius)]"></div>
      </div>
    </main>
  );
}
