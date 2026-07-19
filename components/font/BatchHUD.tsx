'use client';

import { Hourglass, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';
import { useUploads } from '@/lib/contexts/UploadContext';

/**
 * Thin floating shortcut: shows live batch progress and opens the Upload Center
 * modal (the single source of truth). No drawer of its own.
 */
export default function BatchHUD() {
  const { batches, open } = useUploads();
  const shouldReduceMotion = useReducedMotion();

  const { active, complete, errors, total } = useMemo(() => {
    let active = 0;
    let complete = 0;
    let errors = 0;
    for (const batch of batches) {
      if (batch.outcome === 'succeeded') complete += 1;
      else if (batch.outcome === 'failed' || batch.outcome === 'partial') errors += 1;
      else active += 1;
    }
    return { active, complete, errors, total: batches.length };
  }, [batches]);

  if (total === 0) return null;

  const Icon = errors > 0 ? AlertTriangle : active > 0 ? Hourglass : CheckCircle2;
  const iconClass = errors > 0 ? 'text-[var(--danger)]' : active > 0 ? 'text-[var(--info)]' : 'text-[var(--success)]';

  return (
    <div className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6">
      <motion.button
        initial={shouldReduceMotion ? false : { scale: 0.8, opacity: 0 }}
        animate={shouldReduceMotion ? {} : { scale: 1, opacity: 1 }}
        onClick={open}
        className="flex items-center gap-2 px-4 py-3 rounded-full rule bg-[var(--surface)] theme-shadow-lg hover:bg-[var(--muted)] transition-colors"
        aria-label="Open upload center"
      >
        <Icon className={`${iconClass} ${active > 0 && errors === 0 ? 'animate-spin' : ''}`} size={18} />
        <span className="uppercase text-xs font-bold">
          {complete}/{total} done{errors > 0 ? ` · ${errors} err` : ''}
        </span>
      </motion.button>
    </div>
  );
}
