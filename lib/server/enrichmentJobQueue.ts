import { createHash } from 'node:crypto';
import type { Firestore, WriteBatch } from 'firebase-admin/firestore';
import { getApps } from 'firebase-admin/app';
import { getRemoteConfig } from 'firebase-admin/remote-config';

const ENRICHMENT_JOBS_COLLECTION = 'enrichmentJobs';
const CACHE_TTL_MS = 60_000;
const FALLBACK = { promptVersion: 'enrich-v2', analysisModel: 'gemini-3.5-flash-lite', embeddingVersion: 'gemini-embedding-2:2048' };

let cachedConfig: { expiresAt: number; value: typeof FALLBACK } | null = null;

function rcString(params: Record<string, { defaultValue?: { value?: string } }>, key: string): string | undefined {
  const value = params[key]?.defaultValue?.value;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export async function resolveEnrichmentJobConfig(): Promise<{ promptVersion: string; analysisModel: string; embeddingVersion: string }> {
  if (cachedConfig && cachedConfig.expiresAt > Date.now()) return cachedConfig.value;
  const app = getApps()[0];
  if (!app) return FALLBACK;
  try {
    const template = await getRemoteConfig(app).getServerTemplate();
    const evaluated = template.evaluate();
    const analysisModel = evaluated.getString('analysis_model_name') || FALLBACK.analysisModel;
    const embModel = evaluated.getString('embedding_model_name') || 'gemini-embedding-2';
    const embDims = evaluated.getNumber('embedding_dimensions') || 2048;
    const promptVersion = evaluated.getString('analysis_prompt_version') || FALLBACK.promptVersion;
    const value = { promptVersion, analysisModel, embeddingVersion: `${embModel}:${embDims}` };
    cachedConfig = { expiresAt: Date.now() + CACHE_TTL_MS, value };
    return value;
  } catch {
    try {
      const tpl = await getRemoteConfig(app).getTemplate();
      const params = tpl.parameters as Record<string, { defaultValue?: { value?: string } }>;
      const analysisModel = rcString(params, 'analysis_model_name') ?? FALLBACK.analysisModel;
      const embModel = rcString(params, 'embedding_model_name') ?? 'gemini-embedding-2';
      const embDims = rcString(params, 'embedding_dimensions') ?? '2048';
      const promptVersion = rcString(params, 'analysis_prompt_version') ?? FALLBACK.promptVersion;
      const value = { promptVersion, analysisModel, embeddingVersion: `${embModel}:${embDims}` };
      cachedConfig = { expiresAt: Date.now() + CACHE_TTL_MS, value };
      return value;
    } catch {
      return FALLBACK;
    }
  }
}

function jobIdFor(input: { ownerId: string; familyId: string; familyVersion: number; promptVersion: string; analysisModel: string; embeddingVersion: string }): string {
  const identity = [input.ownerId, input.familyId, input.familyVersion, input.promptVersion, input.analysisModel, input.embeddingVersion]
    .map((value) => `${String(value).length}:${String(value)}`)
    .join('|');
  return `enrichment-${createHash('sha256').update(identity).digest('hex')}`;
}

export function queueEnrichmentJobInBatch(
  batch: WriteBatch,
  db: Firestore,
  input: { ownerId: string; familySlug: string; familyVersion: number; now?: Date; config?: typeof FALLBACK },
): string {
  const now = input.now ?? new Date();
  const cfg = input.config ?? cachedConfig?.value ?? FALLBACK;
  const jobId = jobIdFor({ ownerId: input.ownerId, familyId: input.familySlug, familyVersion: input.familyVersion, ...cfg });
  batch.set(db.collection(ENRICHMENT_JOBS_COLLECTION).doc(jobId), {
    jobId, ownerId: input.ownerId, batchId: 'manual-mutation', planVersion: 0, familyId: input.familySlug,
    familyVersion: input.familyVersion, promptVersion: cfg.promptVersion, analysisModel: cfg.analysisModel,
    embeddingVersion: cfg.embeddingVersion, state: 'queued', createdAt: now, updatedAt: now,
  });
  return jobId;
}
