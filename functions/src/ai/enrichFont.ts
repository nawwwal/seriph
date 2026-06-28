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

const PROMPT_VERSION = 'enrich-v1';

const ANALYSIS_SCHEMA = {
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

function buildPrompt(family: FontFamilyDoc, hasImage: boolean): string {
  const axes = (family.axes ?? []).map((a) => a.tag).join(', ') || 'none';
  return [
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

function buildEmbeddingText(family: FontFamilyDoc, e: FontEnrichment): string {
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

async function analyze(family: FontFamilyDoc, png: Buffer | null): Promise<FontEnrichment | null> {
  const model = getGenerativeModelFromRC(RC_KEYS.analysisModelName, {
    responseMimeType: 'application/json',
    responseSchema: ANALYSIS_SCHEMA as unknown as Record<string, unknown>,
  });
  const parts: any[] = [];
  if (png) parts.push({ inlineData: { mimeType: 'image/png', data: png.toString('base64') } });
  parts.push({ text: buildPrompt(family, !!png) });

  const result = await model.generateContent({ contents: [{ role: 'user', parts }] } as any);
  const text = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim?.();
  if (!text) return null;
  let data: any;
  try {
    data = JSON.parse(text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim());
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

  await ref.set({ status: 'enriching', updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  // Render a specimen from the cover face's original (sfnt renders best).
  let png: Buffer | null = null;
  const cover = family.faces.find((f) => f.id === family.coverFaceId) || family.faces[0];
  if (cover) {
    try {
      const [buf] = await getStorage().bucket(publicBucketName()).file(cover.original.storagePath).download();
      png = renderSpecimen(buf)?.png ?? null;
    } catch (e: any) {
      logger.warn(`[enrich ${slug}] specimen render failed`, { message: e?.message });
    }
  }

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
  await ref.set(update, { merge: true });
  logger.info(`[enrich ${slug}] enriched (vector: ${vec ? 'yes' : 'no'}).`);
}
