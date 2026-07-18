import type { CreateBatchInput, CreatedBatch, DurableUploadDeps, RegisteredSource, SourceRegistrationInput, UploadFailure } from '@/models/import-batch.models';

type Reply<T> = { data?: T; error?: { message?: string } };
const headers = (token: string, extra: HeadersInit = {}) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extra });
async function request<T>(url: string, token: string, body?: unknown, extra?: HeadersInit): Promise<T> {
  const response = await fetch(url, { method: 'POST', headers: headers(token, extra), body: body === undefined ? undefined : JSON.stringify(body) });
  const reply = await response.json().catch(() => ({})) as Reply<T>;
  if (!response.ok || !reply.data) throw new Error(reply.error?.message ?? `Import request failed (${response.status})`);
  return reply.data;
}

export function importBatchApi(token: string): Pick<DurableUploadDeps, 'create' | 'register' | 'seal' | 'fail'> {
  return {
    create: (input: CreateBatchInput) => request<CreatedBatch>('/api/v1/import-batches', token, { label: input.label, expectedSourceCount: input.expectedSourceCount }, { 'Idempotency-Key': input.idempotencyKey }),
    async register(batchId: string, sources: SourceRegistrationInput[]) {
      const data = await request<{ kind: string; sources?: RegisteredSource[] }>(`/api/v1/import-batches/${batchId}/sources`, token, { sources });
      if (data.kind !== 'registered' || !data.sources) throw new Error(`Source registration ${data.kind}`);
      return data.sources;
    },
    async seal(batchId: string) { await request(`/api/v1/import-batches/${batchId}/seal`, token); },
    async fail(batchId: string, sourceId: string, error: UploadFailure) {
      await request(`/api/v1/import-batches/${batchId}/sources/${sourceId}/failure`, token, error);
    },
  };
}
