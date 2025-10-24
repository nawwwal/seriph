'use client';

import ProgressBar from '@/components/ui/ProgressBar';
import Link from 'next/link';

interface ProcessingViewProps {
  progress: number;
  processed: number;
  total: number;
  currentFile?: string;
  queuedFiles: string[];
  organizedFamilies: Array<{ name: string; styles: number; classification: string }>;
}

export default function ProcessingView({
  progress,
  processed,
  total,
  currentFile,
  queuedFiles,
  organizedFamilies,
}: ProcessingViewProps) {
  const estimatedTimeRemaining = Math.max(1, Math.ceil(((total - processed) * 5) / 60)); // Rough estimate

  return (
    <div className="mt-6 sm:mt-8 md:mt-10 rule rounded-[var(--radius)] p-6 fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="uppercase font-black text-xl">Processing Fonts</h2>
        <div className="uppercase text-sm font-bold">
          <span>{processed}</span>/<span>{total}</span> Files
        </div>
      </div>

      <ProgressBar progress={progress} />

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="uppercase text-sm font-bold mb-3">Files Being Processed</h3>
          <div className="space-y-4">
            {currentFile && (
              <div className="rule p-3 rounded-[var(--radius)] slide-in">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{currentFile}</div>
                    <div className="text-sm mt-1">Analyzing font metrics...</div>
                  </div>
                  <div className="pulse uppercase text-xs font-bold ml-2">Processing</div>
                </div>
                <div className="mt-3">
                  <ProgressBar progress={60} />
                </div>
              </div>
            )}

            {queuedFiles.slice(0, 3).map((file, idx) => (
              <div key={idx} className="rule p-3 rounded-[var(--radius)] slide-in">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{file}</div>
                    <div className="text-sm mt-1">Queued for processing</div>
                  </div>
                  <div className="uppercase text-xs font-bold opacity-70 ml-2">Queued</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="uppercase text-sm font-bold mb-3">Organized Families</h3>
          <div className="space-y-4">
            {organizedFamilies.map((family, idx) => (
              <div key={idx} className="rule p-3 rounded-[var(--radius)] slide-in">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-extrabold text-lg">{family.name}</div>
                    <div className="text-sm mt-1">
                      {family.styles === 0
                        ? 'New family detected'
                        : `Family complete with ${family.styles} style${family.styles !== 1 ? 's' : ''}`}
                    </div>
                  </div>
                  <div className="uppercase text-xs font-bold ink-bg px-2 py-1 rounded-[var(--radius)] ml-2 whitespace-nowrap">
                    {family.classification}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-between items-center">
        <div className="text-sm">
          <span className="font-bold">Estimated time remaining:</span> {estimatedTimeRemaining}{' '}
          minute{estimatedTimeRemaining !== 1 ? 's' : ''}
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

