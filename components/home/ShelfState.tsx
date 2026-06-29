'use client';

import { FontFamily } from '@/models/font.models';
import { IngestRecord } from '@/models/ingest.models';
import FamilyCover from '@/components/font/FamilyCover';
import ShelfUploadCard from './ShelfUploadCard';
import { getCombinedStatus } from '@/lib/upload/combinedStatus';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';
import { announceStatus } from '@/lib/utils/statusAnnouncer';

interface ShelfStateProps {
  families: FontFamily[];
  pendingIngests: IngestRecord[];
  shelfMode: 'spines' | 'covers';
  onAddFonts: () => void;
  coverSeed?: number;
}

// Above this many families, per-item layout animations (FLIP tracking on every
// card) cost more than they're worth — render plain cards so big shelves stay
// responsive while small libraries keep the springy entrance.
const LAYOUT_ANIMATION_LIMIT = 60;

export default function ShelfState({ families, pendingIngests, shelfMode, onAddFonts, coverSeed = 0 }: ShelfStateProps) {
  const activeUploads = pendingIngests.filter((ingest) => ingest.status !== 'completed');
  const shouldReduceMotion = useReducedMotion() ?? false;
  const animateCards = !shouldReduceMotion && families.length <= LAYOUT_ANIMATION_LIMIT;

  // Announce status changes for accessibility.
  useEffect(() => {
    activeUploads.forEach((ingest) => {
      const s = getCombinedStatus(ingest.uploadState, ingest.analysisState);
      if (s.analysisState === 'complete' || s.uploadState === 'uploaded') {
        announceStatus(`${ingest.originalName}: ${s.displayText}`);
      }
    });
  }, [activeUploads]);

  return (
    <main className="mt-6 sm:mt-8 md:mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 grid-poster-gap auto-rows-fr">
      <AnimatePresence mode="popLayout">
        {activeUploads.map((ingest) => (
          <ShelfUploadCard key={`ingest-${ingest.id}`} ingest={ingest} reduceMotion={shouldReduceMotion} />
        ))}
      </AnimatePresence>

      {animateCards ? (
        <AnimatePresence mode="popLayout">
          {families.map((family) => (
            <motion.div
              key={family.id}
              layout
              layoutId={`family-${family.id}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="h-full"
            >
              <FamilyCover family={family} mode={shelfMode} coverSeed={coverSeed} />
            </motion.div>
          ))}
        </AnimatePresence>
      ) : (
        families.map((family) => (
          <div key={family.id} className="h-full">
            <FamilyCover family={family} mode={shelfMode} coverSeed={coverSeed} />
          </div>
        ))
      )}

      <div
        className="relative rule p-4 sm:p-5 md:p-6 rounded-[var(--radius)] flex flex-col justify-between group cursor-pointer"
        onClick={onAddFonts}
      >
        <div>
          <div className="uppercase font-extrabold text-2xl sm:text-3xl md:text-4xl cap-tight">Drop Fonts</div>
          <p className="mt-2 text-sm sm:text-base">Drag files here or use Add Fonts.</p>
        </div>
        <div className="mt-6 rule-t pt-3 uppercase text-sm font-bold caret">TTF, OTF, WOFF, WOFF2</div>
        <div className="absolute inset-0 bg-[var(--accent)] opacity-0 transition-opacity pointer-events-none group-hover:opacity-5 rounded-[var(--radius)]"></div>
      </div>
    </main>
  );
}
