/**
 * Asynchronous enrichment: render a specimen, run ONE structured multimodal
 * Gemini pass over it, embed the result, and write enrichment + vector back to
 * the family doc. Replaces the legacy visual/web/enriched/summary chain.
 *
 * Fail-safe: any failure leaves the family at `ready` with its deterministic
 * metadata intact — a font is never made worse by enrichment.
 */
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { getGenerativeModelFromRC, isVertexEnabled } from './vertex/vertexClient';
import { renderSpecimen } from '../render/specimen';
import { embedText, embeddingModelId, embeddingDims } from './embeddings';
import { publicBucketName } from '../config/catalogConfig';
import { FAMILIES_COLLECTION } from '../storage/familyStore';
import { RC_KEYS } from '../config/rcKeys';
import { getConfigValue } from '../config/remoteConfig';
import type { FontEnrichment, FontFamilyDoc } from '../models/catalog.models';
import type { GfCategory } from '../storage/canonicalize';

export const PROMPT_VERSION = 'enrich-v1';

/** Line marker used to correlate batch output rows back to a family slug. */
export const CATALOG_KEY_PREFIX = 'Catalog-Key:';

export const ANALYSIS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    category: { type: 'STRING', enum: ['SERIF', 'SANS_SERIF', 'DISPLAY', 'HANDWRITING', 'MONOSPACE'] },
    classification: { type: 'STRING' },
    summary: { type: 'STRING' },
    moods: { type: 'ARRAY', items: { type: 'STRING' } },
    voice: { type: 'STRING' },
    useCases: { type: 'ARRAY', items: { type: 'STRING' } },
    pairingHints: { type: 'ARRAY', items: { type: 'STRING' } },
    confidence: { type: 'NUMBER' },
  },
  required: ['category', 'summary', 'moods', 'useCases'],
} as const;

export function buildPrompt(family: FontFamilyDoc, hasImage: boolean, withKey = false): string {
  const axes = (family.axes ?? []).map((a) => a.tag).join(', ') || 'none';
  return [
    ...(withKey ? [`${CATALOG_KEY_PREFIX} ${family.slug}`, ''] : []),
    'You are a typography expert cataloguing a font family for a searchable library.',
    hasImage
      ? 'You are shown a rendered specimen image of the typeface. Judge its visual character from the image.'
      : 'No specimen image is available; infer from the metadata only.',
    '',
    `Family: ${family.name}`,
    `Deterministic classification: ${family.classification ?? 'unknown'}`,
    `Foundry/designer: ${family.foundry ?? family.designer ?? 'unknown'}`,
    `Variable axes: ${axes}`,
    `Styles: ${family.faces.map((f) => f.styleName).join(', ')}`,
    '',
    'Return JSON describing: the primary category; a finer classification (e.g. "humanist sans", "transitional serif", "geometric display"); a 1–2 sentence summary of its character; 4–8 mood/voice adjectives (e.g. warm, technical, editorial, playful); a short "voice" phrase; 3–6 concrete use cases (e.g. body text, branding, UI, editorial headlines); 2–4 pairing hints (kinds of fonts that pair well); and a 0–1 confidence.',
  ].join('\n');
}

export function buildEmbeddingText(family: FontFamilyDoc, e: FontEnrichment): string {
  return [
    family.name,
    e.classification || family.classification,
    e.summary,
    e.voice,
    (e.moods || []).join(', '),
    (e.useCases || []).join(', '),
    (e.pairingHints || []).join(', '),
    family.foundry,
  ]
    .filter(Boolean)
    .join('. ');
}

/** Parse the model's JSON text into a FontEnrichment. Shared by realtime + batch. */
export function parseAnalysis(family: FontFamilyDoc, text: string | undefined | null): FontEnrichment | null {
  const trimmed = text?.trim?.();
  if (!trimmed) return null;
  let data: any;
  try {
    data = JSON.parse(trimmed.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim());
  } catch {
    logger.warn(`[enrich ${family.slug}] analysis returned non-JSON`);
    return null;
  }
  return {
    category: (data.category as GfCategory) || family.category,
    classification: data.classification,
    summary: data.summary,
    moods: Array.isArray(data.moods) ? data.moods : [],
    voice: data.voice,
    useCases: Array.isArray(data.useCases) ? data.useCases : [],
    pairingHints: Array.isArray(data.pairingHints) ? data.pairingHints : [],
    confidence: typeof data.confidence === 'number' ? data.confidence : undefined,
    modelId: getConfigValue(RC_KEYS.analysisModelName, ''),
    promptVersion: PROMPT_VERSION,
  };
}

/** Download the cover face and render its specimen PNG (null on any failure). */
export async function renderFamilySpecimen(family: FontFamilyDoc): Promise<Buffer | null> {
  const cover = family.faces.find((f) => f.id === family.coverFaceId) || family.faces[0];
  if (!cover) return null;
  try {
    const [buf] = await getStorage().bucket(publicBucketName()).file(cover.original.storagePath).download();
    return renderSpecimen(buf)?.png ?? null;
  } catch (e: any) {
    logger.warn(`[enrich ${family.slug}] specimen render failed`, { message: e?.message });
    return null;
  }
}

/** Current model/prompt/embedding identity — used for the idempotency guard. */
export function currentEnrichmentVersions(): { analysisModel: string; promptVersion: string; embedVersion: string } {
  return {
    analysisModel: getConfigValue(RC_KEYS.analysisModelName, ''),
    promptVersion: PROMPT_VERSION,
    embedVersion: `${embeddingModelId()}:${embeddingDims()}`,
  };
}

/** True when the family is already enriched at the current model/prompt/embedding. */
export function isEnrichedAtCurrentVersion(family: FontFamilyDoc): boolean {
  const prior = family.enrichment;
  const v = currentEnrichmentVersions();
  return (
    family.status === 'enriched' &&
    prior?.promptVersion === v.promptVersion &&
    prior?.modelId === v.analysisModel &&
    prior?.embeddingVersion === v.embedVersion
  );
}

/** Embed enrichment text + build the family doc update written after analysis. */
export async function buildEnrichmentUpdate(
  family: FontFamilyDoc,
  enrichment: FontEnrichment
): Promise<Record<string, unknown>> {
  const vec = await embedText(buildEmbeddingText(family, enrichment), 'RETRIEVAL_DOCUMENT');
  const update: Record<string, unknown> = {
    enrichment: {
      ...enrichment,
      embeddingModel: vec ? embeddingModelId() : undefined,
      embeddingVersion: vec ? `${embeddingModelId()}:${embeddingDims()}` : undefined,
      enrichedAt: FieldValue.serverTimestamp(),
    },
    status: 'enriched',
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (vec) update.text_vec = FieldValue.vector(vec);
  return update;
}

async function analyze(family: FontFamilyDoc, png: Buffer | null): Promise<FontEnrichment | null> {
  const model = getGenerativeModelFromRC(RC_KEYS.analysisModelName, {
    responseMimeType: 'application/json',
    responseSchema: ANALYSIS_SCHEMA as unknown as Record<string, unknown>,
  });
  const parts: any[] = [];
  if (png) parts.push({ inlineData: { mimeType: 'image/png', data: png.toString('base64') } });
  parts.push({ text: buildPrompt(family, !!png) });

  const result = await model.generateContent({ contents: [{ role: 'user', parts }] } as any);
  const text = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text;
  return parseAnalysis(family, text);
}

/** Enrich one family by slug. Idempotent; safe to re-run. */
export async function enrichFamily(slug: string): Promise<void> {
  const db = getFirestore();
  const ref = db.collection(FAMILIES_COLLECTION).doc(slug);
  const snap = await ref.get();
  if (!snap.exists) return;
  const family = snap.data() as FontFamilyDoc;

  if (!isVertexEnabled()) {
    logger.info(`[enrich ${slug}] Vertex disabled (kill-switch); leaving as ready.`);
    return;
  }

  // Idempotency guard. The family doc is written once per face during ingest, so
  // any trigger fires N times for an N-style family. Skip when we already have
  // enrichment at the current analysis model + prompt + embedding version, so one
  // family costs one analysis + one embedding — not N. Any change to the model,
  // prompt, or embedding version makes this fall through and (re)enrich.
  if (isEnrichedAtCurrentVersion(family)) {
    const v = currentEnrichmentVersions();
    logger.info(`[enrich ${slug}] already enriched at ${v.analysisModel}/${v.promptVersion}/${v.embedVersion}; skipping.`);
    return;
  }

  await ref.set({ status: 'enriching', updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  const png = await renderFamilySpecimen(family);

  let enrichment: FontEnrichment | null = null;
  try {
    enrichment = await analyze(family, png);
  } catch (e: any) {
    logger.error(`[enrich ${slug}] analysis failed`, { message: e?.message });
  }

  if (!enrichment) {
    await ref.set({ status: 'ready', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return;
  }

  const update = await buildEnrichmentUpdate(family, enrichment);
  await ref.set(update, { merge: true });
  logger.info(`[enrich ${slug}] enriched.`);
}
