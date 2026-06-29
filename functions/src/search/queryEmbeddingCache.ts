import { createHash } from "crypto";
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { embedText, embeddingDims, embeddingModelId } from "../ai/embeddings";
import { normalizeSearchText, type SearchVectorLane } from "./searchDocument";

const CACHE_COLLECTION = "searchQueryCache";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface QueryEmbeddingCacheInput {
  db: Firestore;
  query: string;
  lane: SearchVectorLane;
}

export function queryEmbeddingVersion(): { embeddingModel: string; embeddingVersion: string } {
  const embeddingModel = embeddingModelId();
  return { embeddingModel, embeddingVersion: `${embeddingModel}:${embeddingDims()}` };
}

export function queryCacheKey(input: { query: string; lane: SearchVectorLane; embeddingVersion: string }): string {
  const normalizedQuery = normalizeSearchText(input.query);
  return createHash("sha256")
    .update(JSON.stringify({ q: normalizedQuery, lane: input.lane, embeddingVersion: input.embeddingVersion }))
    .digest("hex");
}

function isFreshCacheDoc(data: FirebaseFirestore.DocumentData | undefined, now: number): data is { vector: number[] } {
  const expiresAt = data?.expiresAt;
  const expiresAtMs =
    expiresAt instanceof Timestamp
      ? expiresAt.toMillis()
      : typeof expiresAt?.toMillis === "function"
        ? expiresAt.toMillis()
        : 0;
  return Array.isArray(data?.vector) && data.vector.length > 0 && expiresAtMs > now;
}

export async function getOrCreateQueryEmbedding(input: QueryEmbeddingCacheInput): Promise<number[] | null> {
  const started = Date.now();
  const { embeddingModel, embeddingVersion } = queryEmbeddingVersion();
  const key = queryCacheKey({ query: input.query, lane: input.lane, embeddingVersion });
  const ref = input.db.collection(CACHE_COLLECTION).doc(key);
  const now = Date.now();

  try {
    const snap = await ref.get();
    const lookupMs = Date.now() - started;
    if (snap.exists && isFreshCacheDoc(snap.data(), now)) {
      logger.info("search embedding cache hit", { lane: input.lane, lookupMs });
      return snap.data()?.vector as number[];
    }
    logger.info("search embedding cache miss", { lane: input.lane, lookupMs });
  } catch (e: any) {
    logger.warn("search embedding cache lookup failed", { lane: input.lane, message: e?.message });
  }

  const embeddingStarted = Date.now();
  const vector = await embedText(input.query, "RETRIEVAL_QUERY");
  logger.info("search embedding generated", { lane: input.lane, embeddingMs: Date.now() - embeddingStarted });
  if (!vector) return null;

  try {
    await ref.set(
      {
        key,
        lane: input.lane,
        normalizedQuery: normalizeSearchText(input.query),
        embeddingModel,
        embeddingVersion,
        vector,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(now + TTL_MS),
      },
      { merge: true }
    );
  } catch (e: any) {
    logger.warn("search embedding cache write failed", { lane: input.lane, message: e?.message });
  }
  return vector;
}
