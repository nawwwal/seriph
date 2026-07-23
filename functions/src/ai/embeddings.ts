/**
 * Text embeddings via Gemini embedding models on Vertex (`@google/genai`).
 *
 * Used to make font descriptions semantically searchable. We embed the textual
 * output of the multimodal analysis (plus key metadata); true image embeddings
 * are a follow-up once a multimodal embedding endpoint is wired.
 */
import { GoogleGenAI } from '@google/genai';
import { logger } from 'firebase-functions';
import { getConfigValue, getConfigNumber } from '../config/remoteConfig';
import { RC_KEYS, RC_DEFAULTS } from '../config/rcKeys';

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  if (client) return client;
  const project = process.env.GOOGLE_CLOUD_PROJECT || 'seriph';
  // gemini-embedding-2-preview is not served from asia-southeast1; embeddings use
  // their own location (default us-central1), independent of the analysis model.
  const location = getConfigValue(
    RC_KEYS.embeddingLocationId,
    RC_DEFAULTS[RC_KEYS.embeddingLocationId] || getConfigValue(RC_KEYS.vertexLocationId, RC_DEFAULTS[RC_KEYS.vertexLocationId]),
  );
  client = new GoogleGenAI({ vertexai: true, project, location });
  return client;
}

export function embeddingModelId(): string {
  return getConfigValue(RC_KEYS.embeddingModelName, RC_DEFAULTS[RC_KEYS.embeddingModelName]);
}

export function embeddingDims(): number {
  return getConfigNumber(RC_KEYS.embeddingDimensions, Number(RC_DEFAULTS[RC_KEYS.embeddingDimensions]));
}

/**
 * Embed text. `taskType` should be RETRIEVAL_DOCUMENT for stored docs and
 * RETRIEVAL_QUERY for search queries (asymmetric retrieval).
 */
export async function embedText(
  text: string,
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT'
): Promise<number[] | null> {
  return (await embedTexts([text], taskType))[0] ?? null;
}

/** Embed related texts in one provider request while preserving input order. */
export async function embedTexts(
  texts: readonly string[],
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT'
): Promise<Array<number[] | null>> {
  const trimmed = texts.map((text) => (text || '').trim());
  const present = trimmed.map((text, index) => ({ text, index })).filter(({ text }) => text.length > 0);
  const result: Array<number[] | null> = texts.map(() => null);
  if (!present.length) return result;
  try {
    const res = await ai().models.embedContent({
      model: embeddingModelId(),
      contents: present.map(({ text }) => text),
      config: { outputDimensionality: embeddingDims(), taskType },
    });
    present.forEach(({ index }, resultIndex) => {
      const values = res.embeddings?.[resultIndex]?.values;
      result[index] = values && values.length ? values : null;
    });
    return result;
  } catch (e: any) {
    logger.warn('embedTexts failed', { message: e?.message, count: present.length });
    return result;
  }
}
