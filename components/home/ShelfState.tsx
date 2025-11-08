'use client';

import { FontFamily } from '@/models/font.models';
import { IngestRecord } from '@/models/ingest.models';
import FamilyCover from '@/components/font/FamilyCover';
import AnalysisStateIndicator from '@/components/font/AnalysisStateIndicator';
import { getCombinedStatus } from '@/lib/contexts/ImportContext';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';
import { announceStatus } from '@/lib/utils/statusAnnouncer';

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

const statusBadgeClass = (status: string, priority?: 'upload' | 'analysis' | 'complete') => {
  if (status === 'failed' || status === 'error') return 'bg-red-600 text-white';
  if (status === 'completed' || priority === 'complete') return 'ink-bg text-[var(--paper)]';
  if (priority === 'analysis' && status !== 'complete') return 'btn-ink opacity-70';
  return 'btn-ink';
};

export default function ShelfState({
  families,
  pendingIngests,
  shelfMode,
  onAddFonts,
}: ShelfStateProps) {
  const activeUploads = pendingIngests.filter((ingest) => ingest.status !== 'completed');
  const shouldReduceMotion = useReducedMotion();

  // Announce status changes for accessibility
  useEffect(() => {
    activeUploads.forEach((ingest) => {
      const combinedStatus = getCombinedStatus(ingest.uploadState, ingest.analysisState);
      if (combinedStatus.analysisState === 'complete' || combinedStatus.uploadState === 'uploaded') {
        announceStatus(`${ingest.originalName}: ${combinedStatus.displayText}`);
      }
    });
  }, [activeUploads]);

  return (
    <main className="mt-6 sm:mt-8 md:mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 grid-poster-gap auto-rows-fr">
      <AnimatePresence mode="popLayout">
        {activeUploads.map((ingest) => {
        // Get combined status for two-lane status model
        const combinedStatus = getCombinedStatus(ingest.uploadState, ingest.analysisState);
        const statusLabel = combinedStatus.displayText;
        
        return (
          <motion.div
            key={`ingest-${ingest.id}`}
            layout={!shouldReduceMotion}
            layoutId={shouldReduceMotion ? undefined : `ingest-${ingest.id}`}
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
            animate={shouldReduceMotion ? {} : { opacity: 1, scale: 1 }}
            exit={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
            transition={shouldReduceMotion ? {} : { type: 'spring', damping: 25, stiffness: 300 }}
            className="rule p-4 sm:p-5 md:p-6 rounded-[var(--radius)] flex flex-col justify-between gap-4 bg-[var(--surface)]"
          >
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="uppercase text-xs font-bold opacity-70">
                  {combinedStatus.priority === 'upload' ? 'Upload' : 
                   combinedStatus.priority === 'analysis' ? 'Analysis' : 'Complete'}
                </div>
                <span
                  className={`uppercase text-xs font-bold px-2 py-1 rounded-[var(--radius)] whitespace-nowrap ${statusBadgeClass(
                    ingest.status,
                    combinedStatus.priority
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
              {ingest.quarantined && (
                <div className="text-xs uppercase font-bold text-red-600 mt-1">
                  Quarantined
                </div>
              )}
            </div>
            <div className="text-sm opacity-70">
              {ingest.error ? (
                <div className="text-red-600">Error: {ingest.error}</div>
              ) : (
                <AnalysisStateIndicator
                  analysisState={combinedStatus.analysisState || 'not_started'}
                  showSteps={combinedStatus.analysisState === 'analyzing' || combinedStatus.analysisState === 'enriching'}
                />
              )}
            </div>
          </motion.div>
        );
        })}
      </AnimatePresence>

      <AnimatePresence mode="popLayout">
        {families.map((family) => (
        <motion.div
          key={family.id}
          layout={!shouldReduceMotion}
          layoutId={shouldReduceMotion ? undefined : `family-${family.id}`}
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
          animate={shouldReduceMotion ? {} : { opacity: 1, scale: 1 }}
          exit={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
          transition={shouldReduceMotion ? {} : { type: 'spring', damping: 25, stiffness: 300 }}
        >
          <FamilyCover family={family} mode={shelfMode} />
        </motion.div>
        ))}
      </AnimatePresence>

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
