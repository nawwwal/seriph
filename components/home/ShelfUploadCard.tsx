'use client';

import { motion } from 'framer-motion';
import type { IngestRecord } from '@/models/ingest.models';
import AnalysisStateIndicator from '@/components/font/AnalysisStateIndicator';
import { getCombinedStatus } from '@/lib/upload/combinedStatus';

function statusBadgeClass(status: string, priority?: 'upload' | 'analysis' | 'complete') {
  if (status === 'failed' || status === 'error') return 'bg-[var(--danger)] text-[var(--paper)]';
  if (status === 'completed' || priority === 'complete') return 'ink-bg text-[var(--paper)]';
  if (priority === 'analysis' && status !== 'complete') return 'btn-ink opacity-70';
  return 'btn-ink';
}

/** Live card for an in-flight upload/analysis on the shelf. */
export default function ShelfUploadCard({ ingest, reduceMotion }: { ingest: IngestRecord; reduceMotion: boolean }) {
  const status = getCombinedStatus(ingest.uploadState, ingest.analysisState);
  const priorityLabel = status.priority === 'upload' ? 'Upload' : status.priority === 'analysis' ? 'Analysis' : 'Complete';

  return (
    <motion.div
      layout={!reduceMotion}
      layoutId={reduceMotion ? undefined : `ingest-${ingest.id}`}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
      animate={reduceMotion ? {} : { opacity: 1, scale: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0, scale: 0.9 }}
      transition={reduceMotion ? {} : { type: 'spring', damping: 25, stiffness: 300 }}
      className="h-full rule p-4 sm:p-5 md:p-6 rounded-[var(--radius)] flex flex-col justify-between gap-4 bg-[var(--surface)]"
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="uppercase text-xs font-bold opacity-70">{priorityLabel}</div>
          <span className={`uppercase text-xs font-bold px-2 py-1 rounded-[var(--radius)] whitespace-nowrap ${statusBadgeClass(ingest.status, status.priority)}`}>
            {status.displayText}
          </span>
        </div>
        <div className="mt-3 font-bold text-lg truncate">{ingest.originalName}</div>
        {ingest.familyId && <div className="text-sm opacity-70 mt-1 truncate">Target family: {ingest.familyId}</div>}
        {ingest.quarantined && <div className="text-xs uppercase font-bold text-[var(--danger)] mt-1">Quarantined</div>}
      </div>
      <div className="text-sm opacity-70">
        {ingest.error ? (
          <div className="text-[var(--danger)]">Error: {ingest.error}</div>
        ) : (
          <AnalysisStateIndicator
            analysisState={status.analysisState || 'not_started'}
            showSteps={status.analysisState === 'analyzing' || status.analysisState === 'enriching'}
          />
        )}
      </div>
    </motion.div>
  );
}
