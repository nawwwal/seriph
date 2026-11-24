'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { canRetryImportTarget, createIdempotencyKey, publicImportActionError, redactImportDisplayText, type ImportBatchActionClient } from '@/lib/imports/importBatchActions';
import type { ImportBatchChild } from '@/lib/imports/mapImportBatch';
import type { RetryTarget } from '@/models/import-batch.models';

type Data = Record<string, unknown>;
const record = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
const value = (data: Data, keys: string[]) => keys.map((key) => data[key]).find((item): item is string => typeof item === 'string' && Boolean(item.trim()));
const text = (data: Data, keys: string[], fallback: string) => redactImportDisplayText(value(data, keys), fallback);
const count = (data: Data, key: string, nested: string) => typeof data[key] === 'number' ? data[key] as number : Array.isArray(data[nested]) ? data[nested].length : 0;
const label = (raw: string) => redactImportDisplayText(raw).replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
const labels = (data: Data, key: string) => Array.isArray(data[key]) ? [...new Set(data[key].filter((item): item is string | number => typeof item === 'string' || typeof item === 'number').map(String))] : [];

export interface UploadFamilyRowProps {
  family: ImportBatchChild;
  batchId: string;
  actions?: ImportBatchActionClient;
  onInspect?: (family: ImportBatchChild) => void;
}

const target = (data: Data): RetryTarget | null => {
  const id = value(data, ['familyPlanId', 'id', 'familyId']);
  return id ? { kind: 'family', familyPlanId: id } : null;
};

export default function UploadFamilyRow({ family, batchId, actions, onInspect }: UploadFamilyRowProps) {
  const data = record(family); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  const retryTarget = target(data); const familyName = text(data, ['familyName', 'intendedFamily', 'name'], 'Unnamed family');
  const catalogueState = text(data, ['catalogueState', 'catalogState'], 'waiting');
  const state = text(data, ['state', 'status'], data.clean === true ? 'ready' : 'needs review');
  const aiState = text(data, ['aiState', 'enrichmentState', 'analysisState'], 'pending');
  const familySlug = value(data, ['familySlug', 'familyPlanId', 'id', 'familyId']);
  const familyHref = catalogueState === 'applied' && familySlug ? `/family/${encodeURIComponent(familySlug)}` : null;
  const canRetry = Boolean(actions && retryTarget && canRetryImportTarget(data));
  const retry = async () => {
    if (!actions || !retryTarget || !canRetryImportTarget(data)) return;
    setPending(true); setError(null);
    try { await actions.retry({ batchId, idempotencyKey: createIdempotencyKey('retry'), target: retryTarget }); }
    catch (cause) { setError(publicImportActionError(cause)); }
    finally { setPending(false); }
  };
  const styles = labels(data, 'styles'); const weights = labels(data, 'weights'); const chips = styles.length ? styles : weights.map((weight) => `Weight ${weight}`);
  return <article className="rule rounded-[var(--radius)] px-3 py-2" data-upload-family-row={retryTarget?.kind === 'family' ? retryTarget.familyPlanId : undefined}>
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        {familyHref ? <Link href={familyHref} className="block truncate text-sm font-bold underline decoration-1 underline-offset-2">{familyName}</Link> : <h4 className="truncate text-sm font-bold">{familyName}</h4>}
        <p className="text-xs opacity-65">{count(data, 'styleCount', 'faces')} {count(data, 'styleCount', 'faces') === 1 ? 'style' : 'styles'} · Catalogue {label(catalogueState)} · AI {label(aiState)}</p>
      </div>
      <span className="shrink-0 text-[10px] font-bold uppercase">{label(state)}</span>
    </div>
    {chips.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{chips.slice(0, 8).map((chip) => <span key={chip} className="rule rounded-[var(--radius)] px-1.5 py-0.5 text-[10px]">{chip}</span>)}{chips.length > 8 && <span className="px-1 py-0.5 text-[10px] opacity-60">+{chips.length - 8}</span>}</div>}
    <div className="mt-2 flex flex-wrap gap-2">
      {familyHref && <Link href={familyHref} className="rule rounded-[var(--radius)] px-2.5 py-1 text-[10px] font-bold uppercase hover:bg-[var(--control-track)]">View</Link>}
      {onInspect && <Button type="button" size="sm" onClick={() => onInspect(family)} aria-label={`Inspect ${familyName}`}>Inspect</Button>}
      {canRetry && <Button type="button" size="sm" tone="warning" disabled={pending} onClick={() => void retry()}>{pending ? 'Retrying…' : 'Retry'}</Button>}
    </div>
    {error && <p className="mt-2 text-xs text-[var(--danger)]" role="alert">{error}</p>}
  </article>;
}
