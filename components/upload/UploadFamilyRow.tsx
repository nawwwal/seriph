'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { createIdempotencyKey, publicImportActionError, type ImportBatchActionClient } from '@/lib/imports/importBatchActions';
import type { ImportBatchChild } from '@/lib/imports/mapImportBatch';
import type { RetryTarget } from '@/models/import-batch.models';

type Data = Record<string, unknown>;
const record = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
const text = (data: Data, keys: string[], fallback: string) => keys.map((key) => data[key]).find((value): value is string => typeof value === 'string' && Boolean(value.trim())) ?? fallback;
const count = (data: Data, key: string, nested: string) => typeof data[key] === 'number' ? data[key] as number : Array.isArray(data[nested]) ? data[nested].length : 0;
const label = (value: string) => value.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());

export interface UploadFamilyRowProps {
  family: ImportBatchChild;
  batchId: string;
  actions?: ImportBatchActionClient;
  onInspect?: (family: ImportBatchChild) => void;
}

const target = (data: Data): RetryTarget | null => {
  const id = text(data, ['familyPlanId', 'id', 'familyId'], '');
  return id ? { kind: 'family', familyPlanId: id } : null;
};

export default function UploadFamilyRow({ family, batchId, actions, onInspect }: UploadFamilyRowProps) {
  const data = record(family); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  const retryTarget = target(data); const familyName = text(data, ['familyName', 'intendedFamily', 'name'], 'Unnamed family');
  const state = text(data, ['state', 'status'], data.clean === true ? 'ready' : 'needs review');
  const aiState = text(data, ['aiState', 'enrichmentState', 'analysisState'], 'pending');
  const retry = async () => {
    if (!actions || !retryTarget) return;
    setPending(true); setError(null);
    try { await actions.retry({ batchId, idempotencyKey: createIdempotencyKey('retry'), target: retryTarget }); }
    catch (cause) { setError(publicImportActionError(cause)); }
    finally { setPending(false); }
  };
  return <article className="rule rounded-[var(--radius)] p-3" data-upload-family-row={retryTarget?.kind === 'family' ? retryTarget.familyPlanId : undefined}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><h4 className="truncate font-bold">{familyName}</h4><p className="text-xs opacity-70">{count(data, 'faceCount', 'faces')} faces · {count(data, 'assetCount', 'assets')} assets</p></div>
      <span className="shrink-0 text-[10px] font-bold uppercase">{label(state)}</span>
    </div>
    <dl className="mt-2 grid grid-cols-2 gap-2 text-xs"><div><dt className="opacity-60">Catalogue</dt><dd>{text(data, ['catalogueState', 'catalogState'], 'pending')}</dd></div><div><dt className="opacity-60">AI</dt><dd>{label(aiState)}</dd></div></dl>
    <div className="mt-3 flex flex-wrap gap-2">
      {onInspect && <Button type="button" size="sm" onClick={() => onInspect(family)} aria-label={`Inspect ${familyName}`}>Inspect</Button>}
      {actions && retryTarget && <Button type="button" size="sm" tone="warning" disabled={pending} onClick={() => void retry()}>{pending ? 'Retrying…' : 'Retry'}</Button>}
    </div>
    {error && <p className="mt-2 text-xs text-[var(--danger)]" role="alert">{error}</p>}
  </article>;
}
