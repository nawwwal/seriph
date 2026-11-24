'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronUp, LoaderCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useUploadActions, useUploadState } from '@/lib/contexts/UploadContext';
import { createIdempotencyKey, createImportBatchActions, publicImportActionError } from '@/lib/imports/importBatchActions';
import { currentImportPercent, importStatus } from '@/lib/imports/importStatus';
import UploadFamilyRow from './UploadFamilyRow';
import UploadReviewPanel from './UploadReviewPanel';
import { uploadTrayPresentation } from './uploadTrayPresentation';

const attention = new Set(['failed', 'partial', 'needs_review']);
const average = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : undefined;

export default function UploadTray() {
  const { user } = useAuth();
  const { batches, childrenByBatch, isClientUploading, notice, sourcePreviews, sourceProgress } = useUploadState();
  const { cancelClientUpload, loadChildren, refreshChildren, collapseChildren, setNotice, setSourcePreviews } = useUploadActions();
  const [expanded, setExpanded] = useState(false); const expandedRef = useRef(false);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { expandedRef.current = expanded; }, [expanded]);
  useEffect(() => () => { if (doneTimerRef.current) clearTimeout(doneTimerRef.current); }, []);
  const [error, setError] = useState<string | null>(null); const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [attentionIds, setAttentionIds] = useState<Set<string>>(new Set()); const previous = useRef(new Map<string, string>());
  const batchActions = useMemo(() => user ? createImportBatchActions(() => user.getIdToken()) : undefined, [user]);
  const current = batches.filter((batch) => batch.outcome === 'active').slice(0, 1);
  const needsAttention = batches.filter((batch) => attention.has(batch.outcome) && attentionIds.has(batch.batchId));
  const visibleDone = batches.filter((batch) => batch.outcome === 'succeeded' && doneIds.has(batch.batchId));
  const headline = [...current, ...needsAttention, ...visibleDone][0];
  const progressValues = Object.values(sourceProgress); const uploadTransferred = isClientUploading && progressValues.length > 0 && progressValues.every((value) => value >= 100);
  const status = uploadTransferred ? 'Processing' : headline ? importStatus(headline, isClientUploading) : isClientUploading ? 'Uploading' : notice ? 'Needs attention' : null;
  const details = headline ? childrenByBatch[headline.batchId] : undefined; const families = details?.familyPlans ?? []; const reviewItems = details?.reviewItems ?? [];
  const progress = uploadTransferred ? undefined : average(progressValues) ?? (headline ? currentImportPercent(headline) : undefined);
  const usefulProgress = status === 'Uploading' || (progress ?? 0) > 0 ? progress : undefined;
  const presentation = uploadTrayPresentation({ batch: headline, families, sources: sourcePreviews, status, progress: usefulProgress, notice });
  const canExpand = Boolean(families.length || reviewItems.length || sourcePreviews.length || headline || error);
  const headlineId = headline?.batchId; const headlineUpdatedAt = headline?.updatedAt; const headlineOutcome = headline?.outcome;

  useEffect(() => {
    setAttentionIds((currentIds) => {
      const next = new Set(currentIds);
      batches.forEach((batch) => { const prior = previous.current.get(batch.batchId); const fresh = prior === 'active' || (prior === undefined && batch.updatedAt !== null && Date.now() - batch.updatedAt < 15_000); if (!attention.has(batch.outcome)) next.delete(batch.batchId); else if (fresh) next.add(batch.batchId); });
      return next;
    });
    batches.forEach((batch) => {
      const prior = previous.current.get(batch.batchId);
      if (batch.outcome === 'succeeded' && prior && prior !== 'succeeded') {
        setDoneIds((ids) => new Set(ids).add(batch.batchId)); setSourcePreviews([]);
        if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
        doneTimerRef.current = setTimeout(() => { if (!expandedRef.current) setDoneIds((ids) => { const next = new Set(ids); next.delete(batch.batchId); return next; }); }, 4800);
      }
      if (batch.outcome === 'canceled' && prior === 'active') setSourcePreviews([]);
      previous.current.set(batch.batchId, batch.outcome);
    });
  }, [batches, setSourcePreviews]);

  useEffect(() => {
    if (!headlineId) return;
    void loadChildren(headlineId).catch(() => undefined);
    return () => collapseChildren(headlineId);
  }, [headlineId, loadChildren, collapseChildren]);

  useEffect(() => {
    if (!headlineId || !expanded) return;
    void refreshChildren(headlineId).catch(() => undefined);
  }, [headlineId, headlineUpdatedAt, headlineOutcome, expanded, refreshChildren]);

  if (!status && !notice) return null;
  const cancel = async () => {
    if (isClientUploading) { cancelClientUpload(); return; }
    if (!headline || !batchActions) return; setError(null);
    try { await batchActions.cancel({ batchId: headline.batchId, idempotencyKey: createIdempotencyKey('cancel') }); }
    catch (cause) { setError(publicImportActionError(cause)); }
  };
  const dismiss = () => {
    if (headline && attention.has(headline.outcome)) setAttentionIds((ids) => { const next = new Set(ids); next.delete(headline.batchId); return next; });
    else if (headline?.outcome === 'succeeded') setDoneIds((ids) => { const next = new Set(ids); next.delete(headline.batchId); return next; });
    setExpanded(false); setSourcePreviews([]); if (notice) setNotice(null);
  };
  const active = status === 'Uploading' || status === 'Processing' || status === 'Enriching';
  const miniLabel = status === 'Needs attention' ? 'Import issue' : status === 'Done' ? 'Imported' : status === 'Uploading' ? 'Uploading' : status === 'Processing' ? 'Inspecting' : 'Enriching';

  return <div className="sm:relative flex h-full items-center normal-case" data-upload-tray>
    <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-label={`${miniLabel}: ${presentation.detail}`} className="flex h-full items-center gap-1.5 border-x border-[var(--ink)] px-3 text-[10px] font-bold uppercase hover:bg-[var(--control-track)]" title={`${presentation.title}: ${presentation.detail}`}>
      {status === 'Done' ? <Check size={13} className="text-[var(--success)]" aria-hidden /> : status === 'Needs attention' ? <AlertTriangle size={13} className="text-[var(--danger)]" aria-hidden /> : <LoaderCircle size={13} className="animate-spin" aria-hidden />}
      <span className="hidden sm:inline">{miniLabel}</span>{presentation.progress !== undefined && <span className="opacity-60">{presentation.progress}%</span>}
    </button>
    {expanded && <aside className="absolute bottom-full inset-x-2 sm:left-auto sm:right-0 z-40 mb-2 sm:w-[min(92vw,42rem)] rule rounded-[var(--radius)] bg-[var(--surface)] text-[var(--on-surface)] theme-shadow-lg">
      <div className="flex items-center gap-3 px-4 py-3">
        {status === 'Done' ? <Check size={17} className="text-[var(--success)]" aria-hidden /> : status === 'Needs attention' ? <AlertTriangle size={17} className="text-[var(--danger)]" aria-hidden /> : <LoaderCircle size={17} className="animate-spin" aria-hidden />}
        <div className="min-w-0 flex-1" role="status" aria-live="polite"><p className="truncate text-sm font-bold">{presentation.title}</p><p className="truncate text-xs opacity-70">{presentation.detail}{presentation.progress === undefined ? '' : ` · ${presentation.progress}%`}</p></div>
        {active && <Button type="button" size="sm" tone="danger" onClick={() => void cancel()}>Cancel</Button>}
        {!active && <Button type="button" size="icon" aria-label="Dismiss import status" onClick={dismiss}><X size={15} /></Button>}
        <Button type="button" size="icon" aria-label="Collapse import details" onClick={() => setExpanded(false)}><ChevronUp size={15} /></Button>
      </div>
      {presentation.progress !== undefined && <div className="h-1 bg-[var(--control-track)]"><div className="h-full origin-left bg-[var(--ink)] transition-transform duration-150 ease-out" style={{ transform: `scaleX(${Math.max(0, Math.min(1, presentation.progress / 100))})` }} /></div>}
      {error && <p className="border-t border-[var(--ink)] px-4 py-2 text-xs text-[var(--danger)]" role="alert">{error}</p>}
      {canExpand && <div className="max-h-72 overflow-auto border-t border-[var(--ink)] p-3"><div className="space-y-2">
        {families.map((family) => <UploadFamilyRow key={String(family.id)} family={family} batchId={headline!.batchId} actions={batchActions} />)}
        {families.length === 0 && reviewItems.length === 0 && sourcePreviews.map((source) => (
          <div key={source.sourceId} className="rule flex items-center justify-between gap-3 rounded-[var(--radius)] px-3 py-2 text-xs">
            <span className="truncate font-medium">{source.name}</span>
            <span className="shrink-0 opacity-70">{sourceProgress[source.sourceId] !== undefined ? `${sourceProgress[source.sourceId]}%` : active ? 'Processing…' : 'Queued'}</span>
          </div>
        ))}
        {reviewItems.length > 0 && headline && <UploadReviewPanel batchId={headline.batchId} reviewItems={reviewItems} actions={batchActions} />}
      </div></div>}
    </aside>}
  </div>;
}
