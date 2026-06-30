'use client';

import ProgressBar from '@/components/ui/ProgressBar';
import Link from 'next/link';
import ProcessingRow from './ProcessingRow';
import { buttonClassName } from '@/components/ui/buttonStyles';

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
        {uploads.map((upload) => (
          <ProcessingRow key={upload.ingestId ?? `${upload.fileName}-${upload.status}`} upload={upload} />
        ))}
      </div>

      <div className="mt-6 flex justify-between items-center">
        <div className="text-sm">
          <span className="font-bold">Progress:</span> {progress}% complete
        </div>

        <Link
          href="/"
          className={buttonClassName({ size: 'mdText' })}
        >
          View Shelf <span className="caret"></span>
        </Link>
      </div>
    </div>
  );
}
