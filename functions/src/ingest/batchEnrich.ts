/**
 * All-batch enrichment lane.
 *
 * Instead of enriching each family inline the moment it becomes `ready`, we
 * collect every pending family on a schedule and run the expensive multimodal
 * analysis through the Gemini **Batch API** (50% of realtime price, <=24h SLA).
 * The font stays instantly viewable/downloadable from the moment it parses; only
 * the moods/summary/search vector arrive on the batch cadence.
 *
 * Two halves, both driven by Cloud Scheduler (see index.ts):
 *   submitPendingEnrichmentBatch()  ready families -> GCS JSONL -> Vertex batch job
 *   pollEnrichmentBatches()         finished jobs  -> parse output -> embed inline -> write
 *
 * Embeddings are computed inline at result time (one cheap call per family);
 * batch embeddings aren't offered for Vertex by the SDK and would only save a
 * fraction of a cent while doubling latency.
 */
import { GoogleGenAI } from '@google/genai';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { isVertexEnabled } from '../ai/vertex/vertexClient';
import {
  ANALYSIS_SCHEMA,
  CATALOG_KEY_PREFIX,
  buildPrompt,
  parseAnalysis,
  renderFamilySpecimen,
  buildEnrichmentUpdate,
  isEnrichedAtCurrentVersion,
} from '../ai/enrichFont';
import { publicBucketName } from '../config/catalogConfig';
import { FAMILIES_COLLECTION } from '../storage/familyStore';
import { RC_KEYS, RC_DEFAULTS } from '../config/rcKeys';
import { getConfigValue, getConfigNumber, getConfigBoolean } from '../config/remoteConfig';
import type { FontFamilyDoc, FontEnrichment } from '../models/catalog.models';

const JOBS_COLLECTION = 'batchJobs';
const ACTIVE_STATES = ['JOB_STATE_QUEUED', 'JOB_STATE_PENDING', 'JOB_STATE_RUNNING', 'JOB_STATE_UPDATING'];
const SUCCESS_STATES = ['JOB_STATE_SUCCEEDED', 'JOB_STATE_PARTIALLY_SUCCEEDED'];
const FAIL_STATES = ['JOB_STATE_FAILED', 'JOB_STATE_CANCELLED', 'JOB_STATE_EXPIRED'];

let client: GoogleGenAI | null = null;
function batchClient(): GoogleGenAI {
  if (client) return client;
  const project = process.env.GOOGLE_CLOUD_PROJECT || 'seriph';
  const location = getConfigValue(RC_KEYS.batchLocationId, RC_DEFAULTS[RC_KEYS.batchLocationId]);
  client = new GoogleGenAI({ vertexai: true, project, location });
  return client;
}

function analysisModelId(): string {
  return getConfigValue(RC_KEYS.analysisModelName, RC_DEFAULTS[RC_KEYS.analysisModelName]);
}

function batchEnrichEnabled(): boolean {
  return getConfigBoolean(RC_KEYS.enrichBatchEnabled, RC_DEFAULTS[RC_KEYS.enrichBatchEnabled] === 'true');
}

/** Bucket for batch JSONL IO. Defaults to the public bucket under an inert prefix. */
function batchBucket(): string {
  const configured = getConfigValue(RC_KEYS.batchIoBucket, '');
  return configured && configured.trim() ? configured.trim() : publicBucketName();
}

/** Generation config mirroring the realtime analysis (getGenerativeModelFromRC). */
function batchGenerationConfig(): Record<string, unknown> {
  return {
    maxOutputTokens: getConfigNumber(RC_KEYS.maxOutputTokens, Number(RC_DEFAULTS[RC_KEYS.maxOutputTokens])),
    temperature: getConfigNumber(RC_KEYS.temperature, Number(RC_DEFAULTS[RC_KEYS.temperature])),
    topP: getConfigNumber(RC_KEYS.topP, Number(RC_DEFAULTS[RC_KEYS.topP])),
    topK: getConfigNumber(RC_KEYS.topK, Number(RC_DEFAULTS[RC_KEYS.topK])),
    responseMimeType: 'application/json',
    responseSchema: ANALYSIS_SCHEMA,
  };
}

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
];

/**
 * Collect families at `ready`, render their specimens, write one JSONL input
 * file, and submit a single Vertex batch prediction job. Marks each family
 * `enriching` and records a tracking doc in `batchJobs`.
 */
export async function submitPendingEnrichmentBatch(): Promise<{ submitted: number; jobName?: string }> {
  if (!batchEnrichEnabled() || !isVertexEnabled()) {
    logger.info('[batch] enrichment disabled (kill-switch); skipping submit.');
    return { submitted: 0 };
  }
  const db = getFirestore();
  const max = getConfigNumber(RC_KEYS.enrichBatchMax, Number(RC_DEFAULTS[RC_KEYS.enrichBatchMax]));
  const snap = await db.collection(FAMILIES_COLLECTION).where('status', '==', 'ready').limit(max).get();
  const families = snap.docs
    .map((d) => d.data() as FontFamilyDoc)
    .filter((f) => !isEnrichedAtCurrentVersion(f));
  if (!families.length) {
    logger.info('[batch] no pending families to enrich.');
    return { submitted: 0 };
  }

  const lines: string[] = [];
  const slugs: string[] = [];
  for (const family of families) {
    const png = await renderFamilySpecimen(family);
    const parts: any[] = [];
    if (png) parts.push({ inlineData: { mimeType: 'image/png', data: png.toString('base64') } });
    parts.push({ text: buildPrompt(family, !!png, true) });
    lines.push(
      JSON.stringify({
        request: {
          contents: [{ role: 'user', parts }],
          generationConfig: batchGenerationConfig(),
          safetySettings: SAFETY_SETTINGS,
        },
      })
    );
    slugs.push(family.slug);
  }

  const jobId = `enrich-${Date.now()}`;
  const bucket = batchBucket();
  const inputPath = `_batch/${jobId}/input.jsonl`;
  const outputPrefix = `_batch/${jobId}/output`;
  await getStorage()
    .bucket(bucket)
    .file(inputPath)
    .save(lines.join('\n'), { contentType: 'application/x-jsonlines' });

  const job = await batchClient().batches.create({
    model: analysisModelId(),
    src: { gcsUri: [`gs://${bucket}/${inputPath}`], format: 'jsonl' },
    config: {
      displayName: jobId,
      dest: { gcsUri: `gs://${bucket}/${outputPrefix}`, format: 'jsonl' },
    },
  });

  const writer = db.batch();
  for (const family of families) {
    writer.set(
      db.collection(FAMILIES_COLLECTION).doc(family.slug),
      { status: 'enriching', updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  }
  writer.set(db.collection(JOBS_COLLECTION).doc(jobId), {
    jobId,
    jobName: job.name,
    type: 'analysis',
    state: job.state ?? 'JOB_STATE_PENDING',
    slugs,
    bucket,
    inputUri: `gs://${bucket}/${inputPath}`,
    outputPrefix,
    model: analysisModelId(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await writer.commit();

  logger.info(`[batch] submitted ${families.length} families as ${job.name} (job ${jobId}).`);
  return { submitted: families.length, jobName: job.name ?? undefined };
}

/** Mark every ingest pointing at a family as fully complete (best-effort). */
async function finalizeIngestsForFamily(familyId: string): Promise<void> {
  const db = getFirestore();
  try {
    const snap = await db.collectionGroup('ingests').where('familyId', '==', familyId).get();
    await Promise.all(
      snap.docs.map((d) =>
        d.ref.update({
          analysisState: 'complete',
          status: 'completed',
          updatedAt: FieldValue.serverTimestamp(),
        })
      )
    );
  } catch (e: any) {
    logger.warn(`[batch] failed to finalize ingests for ${familyId}`, { message: e?.message });
  }
}

/** Pull the slug back out of an echoed batch request via the Catalog-Key marker. */
function slugFromRequest(request: any): string | null {
  const parts = request?.contents?.[0]?.parts ?? [];
  for (const p of parts) {
    const t: string | undefined = p?.text;
    if (t && t.includes(CATALOG_KEY_PREFIX)) {
      const m = t.match(new RegExp(`${CATALOG_KEY_PREFIX}\\s*(\\S+)`));
      if (m) return m[1];
    }
  }
  return null;
}

/** Read every JSONL line written under a finished job's output prefix. */
async function readOutputLines(bucket: string, outputPrefix: string): Promise<any[]> {
  const [files] = await getStorage().bucket(bucket).getFiles({ prefix: outputPrefix });
  const jsonl = files.filter((f) => f.name.endsWith('.jsonl'));
  const rows: any[] = [];
  for (const file of jsonl) {
    const [buf] = await file.download();
    for (const line of buf.toString('utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        rows.push(JSON.parse(trimmed));
      } catch {
        // skip malformed line
      }
    }
  }
  return rows;
}

/** Apply one batch output row to its family: parse analysis, embed inline, write. */
async function applyOutputRow(row: any): Promise<boolean> {
  const slug = slugFromRequest(row?.request);
  if (!slug) {
    logger.warn('[batch] output row missing Catalog-Key; cannot map to family.');
    return false;
  }
  const db = getFirestore();
  const ref = db.collection(FAMILIES_COLLECTION).doc(slug);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const family = snap.data() as FontFamilyDoc;

  const text: string | undefined = row?.response?.candidates?.[0]?.content?.parts?.[0]?.text;
  const enrichment: FontEnrichment | null = parseAnalysis(family, text);
  if (!enrichment) {
    // Leave it ready so the next batch retries it.
    await ref.set({ status: 'ready', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return false;
  }

  const update = await buildEnrichmentUpdate(family, enrichment);
  await ref.set(update, { merge: true });
  await finalizeIngestsForFamily(slug);
  return true;
}

/**
 * Check active batch jobs. On success, parse output, embed + write each family,
 * and finalize ingests. On failure, return families to `ready` for the next run.
 */
export async function pollEnrichmentBatches(): Promise<{ checked: number; completed: number }> {
  const db = getFirestore();
  const snap = await db.collection(JOBS_COLLECTION).where('state', 'in', ACTIVE_STATES).get();
  if (snap.empty) return { checked: 0, completed: 0 };

  let completed = 0;
  for (const jobDoc of snap.docs) {
    const job = jobDoc.data() as {
      jobName: string;
      state: string;
      slugs: string[];
      bucket: string;
      outputPrefix: string;
    };
    let state = job.state;
    try {
      const live = await batchClient().batches.get({ name: job.jobName });
      state = (live.state as string) ?? state;
    } catch (e: any) {
      logger.warn(`[batch] get failed for ${job.jobName}`, { message: e?.message });
      continue;
    }

    if (ACTIVE_STATES.includes(state)) {
      await jobDoc.ref.update({ state, updatedAt: FieldValue.serverTimestamp() });
      continue;
    }

    if (SUCCESS_STATES.includes(state)) {
      try {
        const rows = await readOutputLines(job.bucket, job.outputPrefix);
        let applied = 0;
        for (const row of rows) {
          if (await applyOutputRow(row)) applied++;
        }
        completed++;
        await jobDoc.ref.update({
          state,
          applied,
          rows: rows.length,
          finishedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        logger.info(`[batch] ${job.jobName} ${state}: applied ${applied}/${rows.length} rows.`);
      } catch (e: any) {
        logger.error(`[batch] failed processing output for ${job.jobName}`, { message: e?.message });
        await jobDoc.ref.update({ state, error: e?.message, updatedAt: FieldValue.serverTimestamp() });
      }
      continue;
    }

    if (FAIL_STATES.includes(state)) {
      // Return families to ready so the next submit retries them.
      const writer = db.batch();
      for (const slug of job.slugs ?? []) {
        writer.set(
          db.collection(FAMILIES_COLLECTION).doc(slug),
          { status: 'ready', updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
      }
      writer.update(jobDoc.ref, { state, finishedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      await writer.commit();
      logger.warn(`[batch] ${job.jobName} ${state}; returned ${job.slugs?.length ?? 0} families to ready.`);
    }
  }

  return { checked: snap.size, completed };
}
