'use client';

import { motion } from 'framer-motion';
import type { ImportBatchSummary } from '@/lib/imports/mapImportBatch';
import { currentPhase } from '@/components/upload/UploadCenterSummary';

function statusBadgeClass(status: string, priority?: 'upload' | 'analysis' | 'complete') {
  if (status === 'failed' || status === 'error') return 'bg-[var(--danger)] text-[var(--paper)]';
  if (status === 'completed' || priority === 'complete') return 'ink-bg text-[var(--paper)]';
  if (priority === 'analysis' && status !== 'complete') return 'btn-ink opacity-70';
  return 'btn-ink';
}

/** Live card for an in-flight upload/analysis on the shelf. */
export default function ShelfUploadCard({ batch, reduceMotion }: { batch: ImportBatchSummary; reduceMotion: boolean }) {
  const phase = currentPhase(batch);
  const priorityLabel = phase.name === 'upload' ? 'Upload' : 'Analysis';
  const statusText = batch.outcome === 'needs_review' ? 'Needs review' : phase.state.replace(/_/g, ' ');

  return (
    <motion.div
      layout={!reduceMotion}
      layoutId={reduceMotion ? undefined : `batch-${batch.batchId}`}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
      animate={reduceMotion ? {} : { opacity: 1, scale: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0, scale: 0.9 }}
      transition={reduceMotion ? {} : { type: 'spring', damping: 25, stiffness: 300 }}
      className="h-full rule p-4 sm:p-5 md:p-6 rounded-[var(--radius)] flex flex-col justify-between gap-4 bg-[var(--surface)]"
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="uppercase text-xs font-bold opacity-70">{priorityLabel}</div>
          <span className={`uppercase text-xs font-bold px-2 py-1 rounded-[var(--radius)] whitespace-nowrap ${statusBadgeClass(batch.outcome, batch.outcome === 'succeeded' ? 'complete' : undefined)}`}>
            {statusText}
          </span>
        </div>
        <div className="mt-3 font-bold text-lg truncate">{batch.label}</div>
      </div>
      <div className="text-sm opacity-70">
        {batch.counters.failures > 0 && <div className="text-[var(--danger)]">Error: {batch.counters.failures} failed</div>}
        {batch.counters.failures === 0 && <div>{phase.name.replace(/_/g, ' ')}: {phase.state.replace(/_/g, ' ')}</div>}
      </div>
    </motion.div>
  );
}
