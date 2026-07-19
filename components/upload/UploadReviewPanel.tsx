'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { createIdempotencyKey, publicImportActionError, redactImportDisplayText, type ImportBatchActionClient } from '@/lib/imports/importBatchActions';
import type { ImportBatchChild } from '@/lib/imports/mapImportBatch';
import UploadFamilyRow from './UploadFamilyRow';
import UploadItemRow from './UploadItemRow';

const reason = (item: ImportBatchChild) => {
  const value = item.reason ?? item.reasonCode ?? item.action;
  return redactImportDisplayText(value, 'Unresolved import');
};

export interface UploadReviewPanelProps {
  batchId: string;
  families?: ImportBatchChild[];
  reviewItems: ImportBatchChild[];
  actions?: ImportBatchActionClient;
  cancellable?: boolean;
  onInspect?: (item: ImportBatchChild) => void;
}

export default function UploadReviewPanel({ batchId, families = [], reviewItems, actions, cancellable = false, onInspect }: UploadReviewPanelProps) {
  const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  const groups = [...reviewItems.reduce((map, item) => map.set(reason(item), [...(map.get(reason(item)) ?? []), item]), new Map<string, ImportBatchChild[]>()).entries()];
  const cancel = async () => {
    if (!actions || !cancellable) return;
    setPending(true); setError(null);
    try { await actions.cancel({ batchId, idempotencyKey: createIdempotencyKey('cancel') }); }
    catch (cause) { setError(publicImportActionError(cause)); }
    finally { setPending(false); }
  };
  return <section aria-label="Import review details" className="flex flex-col gap-3">
    <header className="flex items-center justify-between gap-3"><div><h3 className="font-bold">Review unresolved imports</h3><p className="text-xs opacity-70">{reviewItems.length} item{reviewItems.length === 1 ? '' : 's'} need attention.</p></div>{actions && cancellable && <Button type="button" size="sm" tone="danger" disabled={pending} onClick={() => void cancel()}>{pending ? 'Cancelling…' : 'Cancel batch'}</Button>}</header>
    {families.map((family) => <UploadFamilyRow key={String(family.id)} family={family} batchId={batchId} actions={actions} onInspect={onInspect} />)}
    {groups.length === 0 ? <p className="text-sm opacity-70">No unresolved imports.</p> : groups.map(([name, items]) => <section key={name} aria-label={name} className="flex flex-col gap-2"><h4 className="text-xs font-bold uppercase">{name.replace(/_/g, ' ')}</h4>{items.map((item) => <UploadItemRow key={String(item.id)} item={item} batchId={batchId} actions={actions} onInspect={onInspect} />)}</section>)}
    {error && <p className="text-xs text-[var(--danger)]" role="alert">{error}</p>}
  </section>;
}
