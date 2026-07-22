'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronUp, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useUploads } from '@/lib/contexts/UploadContext';
import { createIdempotencyKey, createImportBatchActions, publicImportActionError } from '@/lib/imports/importBatchActions';
import { currentImportPercent, importStatus } from '@/lib/imports/importStatus';
import UploadReviewPanel from './UploadReviewPanel';

const attention = new Set(['failed', 'partial', 'needs_review']);
const average = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : undefined;

export default function UploadTray() {
  const { user } = useAuth();
  const uploads = useUploads();
  const batches = uploads.batches;
  const notice = uploads.notice ?? null;
  const isClientUploading = uploads.isClientUploading ?? false;
  const cancelClientUpload = uploads.cancelClientUpload ?? (() => undefined);
  const sourceProgress = uploads.sourceProgress ?? {};
  const loadChildren = uploads.loadChildren ?? (async () => ({ batch: null, familyPlans: [], reviewItems: [], familyPlansCursor: null, reviewItemsCursor: null }));
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<Record<string, Awaited<ReturnType<typeof loadChildren>>>>({});
  const [error, setError] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const previous = useRef(new Map<string, string>());
  const actions = useMemo(() => user ? createImportBatchActions(() => user.getIdToken()) : undefined, [user]);
  const clientProgress = average(Object.values(sourceProgress));
  const current = batches.filter((batch) => batch.outcome === 'active').slice(0, 1);
  const needsAttention = batches.filter((batch) => attention.has(batch.outcome));
  const visibleDone = batches.filter((batch) => batch.outcome === 'succeeded' && doneIds.has(batch.batchId));
  const visible = [...current, ...needsAttention, ...visibleDone];
  const headline = visible[0];
  const headlineStatus = headline ? importStatus(headline, isClientUploading) : isClientUploading ? 'Uploading' : notice ? 'Needs attention' : null;

  useEffect(() => {
    batches.forEach((batch) => {
      const prior = previous.current.get(batch.batchId);
      if (batch.outcome === 'succeeded' && prior && prior !== 'succeeded') {
        setDoneIds((current) => new Set(current).add(batch.batchId));
        window.setTimeout(() => setDoneIds((current) => { const next = new Set(current); next.delete(batch.batchId); return next; }), 3200);
      }
      previous.current.set(batch.batchId, batch.outcome);
    });
  }, [batches]);

  if (!headlineStatus && !notice) return null;
  const progress = clientProgress ?? (headline ? currentImportPercent(headline) : undefined);
  const canExpand = needsAttention.length > 0;
  const cancelBatch = async (batchId: string) => {
    if (!actions) return;
    setError(null);
    cancelClientUpload();
    try { await actions.cancel({ batchId, idempotencyKey: createIdempotencyKey('cancel') }); }
    catch (cause) { setError(publicImportActionError(cause)); }
  };
  const expandBatch = (batchId: string) => {
    setExpanded(true);
    if (!children[batchId]) void loadChildren(batchId).then((value) => setChildren((current) => ({ ...current, [batchId]: value }))).catch(() => undefined);
  };

  return (
    <aside className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-xl rule rounded-[var(--radius)] bg-[var(--surface)] text-[var(--on-surface)] theme-shadow-lg" data-upload-tray>
      <div className="flex items-center gap-3 px-3 py-2">
        {headlineStatus === 'Done' ? <Check size={16} aria-hidden="true" className="text-[var(--success)]" /> : headlineStatus === 'Needs attention' ? <AlertTriangle size={16} aria-hidden="true" className="text-[var(--danger)]" /> : <LoaderCircle size={16} aria-hidden="true" className="animate-spin" />}
        <div className="min-w-0 flex-1 text-sm" role="status" aria-live="polite"><div className="font-bold">{headline?.label ?? notice ?? 'Preparing import'}</div><div className="text-xs opacity-70">{headlineStatus}{progress === undefined ? '' : ` · ${progress}%`}</div></div>
        {headline?.outcome === 'active' ? <Button type="button" size="sm" tone="danger" onClick={() => void cancelBatch(headline.batchId)}>Cancel</Button> : isClientUploading ? <Button type="button" size="sm" tone="danger" onClick={cancelClientUpload}>Cancel</Button> : null}
        {canExpand && <Button type="button" size="icon" aria-expanded={expanded} aria-label={expanded ? 'Collapse import details' : 'Expand import details'} onClick={() => (expanded ? setExpanded(false) : expandBatch(needsAttention[0]!.batchId))}><ChevronUp size={15} className={expanded ? 'rotate-180' : ''} /></Button>}
      </div>
      {progress !== undefined && <div className="h-1 bg-[var(--control-track)]"><div className="h-full bg-[var(--ink)] transition-[width]" style={{ width: `${progress}%` }} /></div>}
      {error && <p className="border-t border-[var(--ink)] px-3 py-2 text-xs text-[var(--danger)]" role="alert">{error}</p>}
      {expanded && <div className="max-h-72 overflow-auto border-t border-[var(--ink)] p-3"><div className="space-y-3">{needsAttention.map((batch) => <section key={batch.batchId} className="space-y-2"><strong className="block truncate text-sm">{batch.label}</strong>{children[batch.batchId] ? <UploadReviewPanel batchId={batch.batchId} families={children[batch.batchId].familyPlans} reviewItems={children[batch.batchId].reviewItems} actions={actions} /> : <p className="text-xs opacity-70">Loading details…</p>}</section>)}</div></div>}
    </aside>
  );
}
