'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronUp, ChevronDown, X, AlertTriangle, CheckCircle2, Hourglass, Filter } from 'lucide-react';
import { IngestRecord } from '@/models/ingest.models';
import { getCombinedStatus } from '@/lib/contexts/ImportContext';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

export type BatchFilter = 'all' | 'completed' | 'errors' | 'quarantined' | 'in_progress';

interface BatchHUDProps {
  ingests: IngestRecord[];
  onDismiss?: () => void;
}

export default function BatchHUD({ ingests, onDismiss }: BatchHUDProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filter, setFilter] = useState<BatchFilter>('all');
  const shouldReduceMotion = useReducedMotion();

  // Filter ingests based on selected filter
  const filteredIngests = useMemo(() => {
    switch (filter) {
      case 'completed':
        return ingests.filter(
          (ingest) =>
            ingest.status === 'completed' ||
            (ingest.analysisState === 'complete' && ingest.uploadState === 'uploaded')
        );
      case 'errors':
        return ingests.filter(
          (ingest) =>
            ingest.status === 'failed' ||
            ingest.uploadState === 'failed' ||
            ingest.analysisState === 'error'
        );
      case 'quarantined':
        return ingests.filter((ingest) => ingest.quarantined === true);
      case 'in_progress':
        return ingests.filter(
          (ingest) =>
            ingest.status !== 'completed' &&
            ingest.status !== 'failed' &&
            ingest.uploadState !== 'failed' &&
            ingest.analysisState !== 'error' &&
            ingest.analysisState !== 'complete'
        );
      default:
        return ingests;
    }
  }, [ingests, filter]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = ingests.length;
    const uploaded = ingests.filter(
      (ingest) => ingest.uploadState === 'uploaded' || ingest.status === 'uploaded'
    ).length;
    const analyzing = ingests.filter(
      (ingest) =>
        ingest.analysisState === 'analyzing' ||
        ingest.analysisState === 'enriching' ||
        ingest.analysisState === 'queued'
    ).length;
    const complete = ingests.filter(
      (ingest) =>
        ingest.status === 'completed' ||
        ingest.analysisState === 'complete'
    ).length;
    const errors = ingests.filter(
      (ingest) =>
        ingest.status === 'failed' ||
        ingest.uploadState === 'failed' ||
        ingest.analysisState === 'error'
    ).length;
    const quarantined = ingests.filter((ingest) => ingest.quarantined === true).length;

    return { total, uploaded, analyzing, complete, errors, quarantined };
  }, [ingests]);

  // Auto-expand if there are errors or quarantined items
  useEffect(() => {
    if (stats.errors > 0 || stats.quarantined > 0) {
      setIsExpanded(true);
    }
  }, [stats.errors, stats.quarantined]);

  if (ingests.length === 0) {
    return null;
  }

  const getStatusIcon = (ingest: IngestRecord) => {
    const combinedStatus = getCombinedStatus(ingest.uploadState, ingest.analysisState);
    
    if (ingest.quarantined) {
      return <AlertTriangle className="text-yellow-500" size={16} />;
    }
    
    if (ingest.status === 'failed' || ingest.uploadState === 'failed' || ingest.analysisState === 'error') {
      return <AlertTriangle className="text-red-500" size={16} />;
    }
    
    if (ingest.status === 'completed' || ingest.analysisState === 'complete') {
      return <CheckCircle2 className="text-green-500" size={16} />;
    }
    
    return <Hourglass className="text-blue-500 animate-spin" size={16} />;
  };

  const getStatusText = (ingest: IngestRecord) => {
    const combinedStatus = getCombinedStatus(ingest.uploadState, ingest.analysisState);
    return combinedStatus.displayText;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6">
      {/* Floating pill */}
      <motion.div
        initial={shouldReduceMotion ? false : { scale: 0.8, opacity: 0 }}
        animate={shouldReduceMotion ? {} : { scale: 1, opacity: 1 }}
        className="bg-[var(--surface)] rule rounded-full shadow-lg"
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-3 px-4 py-3 rounded-full hover:bg-[var(--accent)] transition-colors"
          aria-label={isExpanded ? 'Collapse batch status' : 'Expand batch status'}
          aria-expanded={isExpanded}
        >
          <div className="flex items-center gap-2">
            <div className="relative">
              <Hourglass className="text-blue-500" size={20} />
              {stats.errors > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {stats.errors}
                </span>
              )}
            </div>
            <span className="uppercase text-xs font-bold">
              {stats.complete}/{stats.total} Complete
            </span>
          </div>
          {isExpanded ? (
            <ChevronDown size={20} className="opacity-70" />
          ) : (
            <ChevronUp size={20} className="opacity-70" />
          )}
        </button>
      </motion.div>

      {/* Expanded drawer */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20, scale: 0.95 }}
            animate={shouldReduceMotion ? {} : { opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? false : { opacity: 0, y: 20, scale: 0.95 }}
            transition={shouldReduceMotion ? {} : { type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute bottom-full right-0 mb-2 w-[90vw] max-w-md bg-[var(--surface)] rule rounded-[var(--radius)] shadow-xl max-h-[70vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 rule-b">
              <h3 className="uppercase font-bold text-sm">Batch Status</h3>
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="text-[var(--ink)] hover:opacity-70 transition-opacity"
                  aria-label="Dismiss batch status"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Stats summary */}
            <div className="p-4 rule-b">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="opacity-70">Uploaded:</span>{' '}
                  <span className="font-bold">{stats.uploaded}/{stats.total}</span>
                </div>
                <div>
                  <span className="opacity-70">Analyzing:</span>{' '}
                  <span className="font-bold">{stats.analyzing}</span>
                </div>
                <div>
                  <span className="opacity-70">Complete:</span>{' '}
                  <span className="font-bold text-green-600">{stats.complete}</span>
                </div>
                <div>
                  <span className="opacity-70">Errors:</span>{' '}
                  <span className={`font-bold ${stats.errors > 0 ? 'text-red-600' : ''}`}>
                    {stats.errors}
                  </span>
                </div>
              </div>
              {stats.quarantined > 0 && (
                <div className="mt-2 text-xs">
                  <span className="opacity-70">Quarantined:</span>{' '}
                  <span className="font-bold text-yellow-600">{stats.quarantined}</span>
                </div>
              )}
            </div>

            {/* Filters */}
            <div className="p-4 rule-b">
              <div className="flex items-center gap-2 flex-wrap">
                <Filter size={14} className="opacity-70" />
                {(['all', 'completed', 'errors', 'quarantined', 'in_progress'] as BatchFilter[]).map(
                  (filterOption) => (
                    <button
                      key={filterOption}
                      onClick={() => setFilter(filterOption)}
                      className={`uppercase text-xs font-bold px-2 py-1 rounded-[var(--radius)] transition-colors ${
                        filter === filterOption
                          ? 'ink-bg text-[var(--paper)]'
                          : 'btn-ink'
                      }`}
                    >
                      {filterOption.replace('_', ' ')}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* File list */}
            <div className="overflow-y-auto flex-1">
              {filteredIngests.length === 0 ? (
                <div className="p-4 text-center text-sm opacity-70">
                  No items match this filter.
                </div>
              ) : (
                <div className="divide-y divide-[var(--ink)] divide-opacity-10">
                  {filteredIngests.map((ingest) => (
                    <div
                      key={ingest.id}
                      className="p-3 hover:bg-[var(--accent)] transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        {getStatusIcon(ingest)}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate" title={ingest.originalName}>
                            {ingest.originalName}
                          </div>
                          <div className="text-xs opacity-70 mt-1">
                            {getStatusText(ingest)}
                          </div>
                          {ingest.error && (
                            <div className="text-xs text-red-600 mt-1 truncate" title={ingest.error}>
                              {ingest.error}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

