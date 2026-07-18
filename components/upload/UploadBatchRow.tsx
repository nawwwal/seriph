'use client';

import { useState } from 'react';
import type { ImportBatchChildren, ImportBatchSummary } from '@/lib/imports/mapImportBatch';
import { Button } from '@/components/ui/Button';
import UploadCenterSummary, { currentPhase } from './UploadCenterSummary';

const outcomeLabel = (outcome: ImportBatchSummary['outcome']) => outcome === 'needs_review' ? 'Needs review' : outcome === 'succeeded' ? 'Completed' : outcome === 'partial' ? 'Partial' : outcome.replace(/^./, (letter) => letter.toUpperCase());
const outcomeClass = (outcome: ImportBatchSummary['outcome']) => outcome === 'succeeded' ? 'ink-bg text-[var(--paper)]' : outcome === 'failed' || outcome === 'partial' ? 'bg-[var(--danger)] text-[var(--paper)]' : outcome === 'needs_review' ? 'bg-[var(--warning)] text-[var(--paper)]' : 'btn-ink';
const phaseLabel = (value: string) => value.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());

interface UploadBatchRowProps {
  batch: ImportBatchSummary;
  clientProgress?: number;
  loadChildren?: (batchId: string) => Promise<ImportBatchChildren>;
}

export default function UploadBatchRow({ batch, clientProgress, loadChildren }: UploadBatchRowProps) {
  const [expanded, setExpanded] = useState(false); const [children, setChildren] = useState<ImportBatchChildren | null>(null);
  const phase = currentPhase(batch); const detailsId = `upload-batch-${batch.batchId}`;
  const toggle = () => { const next = !expanded; setExpanded(next); if (next && !children && loadChildren) void loadChildren(batch.batchId).then(setChildren).catch(() => undefined); };
  return <article className="rule rounded-[var(--radius)] p-3">
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1"><h3 className="truncate font-bold">{batch.label}</h3><p className="text-xs opacity-60">{phaseLabel(phase.name)} · {phaseLabel(phase.state)} · {phase.progress.percent === null ? 'Progress pending' : `Last progress: ${phase.progress.percent}%`}</p></div>
      <span className={`uppercase text-[10px] font-bold px-2 py-0.5 rounded-[var(--radius)] whitespace-nowrap ${outcomeClass(batch.outcome)}`}>{outcomeLabel(batch.outcome)}</span>
      <Button type="button" size="sm" tone="default" aria-expanded={expanded} aria-controls={detailsId} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${batch.label}`} onClick={toggle}>{expanded ? 'Hide' : 'Show'}</Button>
    </div>
    <UploadCenterSummary batch={batch} />
    {clientProgress !== undefined && <div className="mt-2" role="status" aria-label="Client upload overlay">Client upload overlay: {clientProgress}%<div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--control-track)]"><div className="h-full bg-[var(--ink)]" style={{ width: `${clientProgress}%` }} /></div></div>}
    <div id={detailsId} hidden={!expanded} className="mt-3 rule-t pt-3 text-xs">{children ? `${children.familyPlans.length} family plans · ${children.reviewItems.length} review items` : 'Batch details load when expanded.'}</div>
  </article>;
}
