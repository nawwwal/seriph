import type { RetryTarget } from '@/models/import-batch.models';

export interface ImportBatchActionRequest {
  batchId: string;
  idempotencyKey: string;
  target: RetryTarget;
}

export interface ImportBatchCancelRequest {
  batchId: string;
  idempotencyKey: string;
}

export interface ImportBatchActionClient {
  retry(request: ImportBatchActionRequest): Promise<unknown>;
  cancel(request: ImportBatchCancelRequest): Promise<unknown>;
}

export function publicImportActionError(value: unknown): string {
  const message = value instanceof Error ? value.message : typeof value === 'string' ? value : 'Import action failed';
  return message.replace(/gs:\/\/\S+|(?:\b[A-Za-z]:[\\/]|\B\/)[^\s]+/g, '[private path]');
}

type Envelope<T> = { data?: T; error?: { message?: string } };
const targetKeys: Record<RetryTarget['kind'], string> = {
  source: 'sourceId', item: 'itemId', family: 'familyPlanId', enrichment: 'jobId',
};

export function isRetryTarget(value: unknown): value is RetryTarget {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  const key = typeof data.kind === 'string' ? targetKeys[data.kind as RetryTarget['kind']] : undefined;
  return Boolean(key) && Object.keys(data).length === 2 && typeof data[key!] === 'string' && Boolean(data[key!]);
}

export function createIdempotencyKey(prefix = 'upload-action'): string {
  const id = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

async function post<T>(path: string, getIdToken: () => Promise<string>, key: string, body?: unknown): Promise<T> {
  const token = await getIdToken();
  const response = await fetch(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as Envelope<T>;
  if (!response.ok || payload.data === undefined) throw new Error(payload.error?.message ?? `Import action failed (${response.status})`);
  return payload.data;
}

export function createImportBatchActions(getIdToken: () => Promise<string>): ImportBatchActionClient {
  return {
    retry: async (request) => {
      if (!request.batchId || !request.idempotencyKey || !isRetryTarget(request.target)) throw new Error('Invalid import retry target');
      return post(`/api/v1/import-batches/${encodeURIComponent(request.batchId)}/actions/retry`, getIdToken, request.idempotencyKey, { target: request.target });
    },
    cancel: async (request) => {
      if (!request.batchId || !request.idempotencyKey) throw new Error('Invalid import cancel request');
      return post(`/api/v1/import-batches/${encodeURIComponent(request.batchId)}/actions/cancel`, getIdToken, request.idempotencyKey);
    },
  };
}

export const retryImportTarget = (getIdToken: () => Promise<string>, request: ImportBatchActionRequest) => createImportBatchActions(getIdToken).retry(request);
export const cancelImportBatch = (getIdToken: () => Promise<string>, request: ImportBatchCancelRequest) => createImportBatchActions(getIdToken).cancel(request);
