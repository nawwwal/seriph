'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { canRetryImportTarget, createIdempotencyKey, publicImportActionError, redactImportDisplayText, type ImportBatchActionClient } from '@/lib/imports/importBatchActions';
import type { ImportBatchChild } from '@/lib/imports/mapImportBatch';
import type { RetryTarget } from '@/models/import-batch.models';

type Data = Record<string, unknown>;
const record = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
const value = (data: Data, keys: string[]) => keys.map((key) => data[key]).find((item): item is string => typeof item === 'string' && Boolean(item.trim()));
const text = (data: Data, keys: string[], fallback: string) => redactImportDisplayText(value(data, keys), fallback);
const integer = (data: Data, keys: string[], fallback: number) => keys.map((key) => data[key]).find((value): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0) ?? fallback;
const label = (value: string) => redactImportDisplayText(value).replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());

export interface UploadItemRowProps {
  item: ImportBatchChild;
  batchId: string;
  actions?: ImportBatchActionClient;
  onInspect?: (item: ImportBatchChild) => void;
}

const target = (data: Data): RetryTarget | null => {
  const id = value(data, ['itemId', 'id']);
  return id ? { kind: 'item', itemId: id } : null;
};

export default function UploadItemRow({ item, batchId, actions, onInspect }: UploadItemRowProps) {
  const data = record(item); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  const retryTarget = target(data); const itemId = retryTarget?.kind === 'item' ? retryTarget.itemId : undefined; const name = text(data, ['filename', 'originalName', 'name'], itemId ?? 'Unnamed item');
  const attempts = integer(data, ['attempts', 'retryCount'], 0); const maxAttempts = integer(data, ['maxAttempts'], 3);
  const retryable = Boolean(actions && retryTarget && canRetryImportTarget(data));
  const retry = async () => {
    if (!actions || !retryTarget || !canRetryImportTarget(data)) return;
    setPending(true); setError(null);
    try { await actions.retry({ batchId, idempotencyKey: createIdempotencyKey('retry'), target: retryTarget }); }
    catch (cause) { setError(publicImportActionError(cause)); }
    finally { setPending(false); }
  };
  const lineage = Array.isArray(data.archiveLineage) || Array.isArray(data.lineage) ? (Array.isArray(data.archiveLineage) ? data.archiveLineage : data.lineage as unknown[]).length : 0;
  const displayedError = (typeof data.error === 'string' && data.error) || (data.error && typeof data.error === 'object') ? publicImportActionError(data.error) : null;
  return <article className="rule rounded-[var(--radius)] p-3" data-upload-item-row={itemId}>
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h5 className="truncate font-bold">{name}</h5><p className="text-xs opacity-70">{text(data, ['format', 'detectedFormat', 'extension'], 'Unknown format')} · {text(data, ['technology', 'role'], 'Unclassified')}</p></div><span className="shrink-0 text-[10px] font-bold uppercase">{label(text(data, ['action', 'state'], 'review'))}</span></div>
    <dl className="mt-2 grid grid-cols-2 gap-2 text-xs"><div><dt className="opacity-60">Reason</dt><dd>{text(data, ['detail', 'errorMessage', 'reason', 'reasonCode'], 'Needs review')}</dd></div><div><dt className="opacity-60">Attempt</dt><dd>Attempt {attempts} of {maxAttempts}</dd></div><div><dt className="opacity-60">Provenance</dt><dd>{lineage ? `Archive lineage · ${lineage} level${lineage === 1 ? '' : 's'}` : text(data, ['provenance', 'sourceType'], 'Direct upload')}</dd></div></dl>
    {displayedError && <p className="mt-2 text-xs text-[var(--danger)]" role="alert">{displayedError}</p>}
    <div className="mt-3 flex flex-wrap gap-2">{onInspect && <Button type="button" size="sm" onClick={() => onInspect(item)} aria-label={`Inspect ${name}`}>Inspect</Button>}{retryable && <Button type="button" size="sm" tone="warning" disabled={pending} onClick={() => void retry()}>{pending ? 'Retrying…' : 'Retry'}</Button>}</div>
    {error && <p className="mt-2 text-xs text-[var(--danger)]" role="alert">{error}</p>}
  </article>;
}
