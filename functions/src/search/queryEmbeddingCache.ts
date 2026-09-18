import { createHash } from "crypto";
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { embedText, embeddingDims, embeddingModelId } from "../ai/embeddings";
import { normalizeSearchText } from "./searchDocument";

const CACHE_COLLECTION = "searchQueryCache";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MEMORY_CACHE_LIMIT = 100;
const memoryCache = new Map<string, { vector: number[]; expiresAt: number }>();
const inFlight = new Map<string, Promise<number[] | null>>();

export interface QueryEmbeddingCacheInput {
  db: Firestore;
  query: string;
}

export function queryEmbeddingVersion(): { embeddingModel: string; embeddingVersion: string } {
  const embeddingModel = embeddingModelId();
  return { embeddingModel, embeddingVersion: `${embeddingModel}:${embeddingDims()}` };
}

export function queryCacheKey(input: { query: string; embeddingVersion: string }): string {
  const normalizedQuery = normalizeSearchText(input.query);
  return createHash("sha256")
    .update(JSON.stringify({ q: normalizedQuery, embeddingVersion: input.embeddingVersion }))
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

async function loadQueryEmbedding(input: QueryEmbeddingCacheInput, key: string): Promise<number[] | null> {
  const started = Date.now();
  const { embeddingModel, embeddingVersion } = queryEmbeddingVersion();
  const ref = input.db.collection(CACHE_COLLECTION).doc(key);
  const now = Date.now();

  try {
    const snap = await ref.get();
    const lookupMs = Date.now() - started;
    const data = snap.data();
    if (snap.exists && isFreshCacheDoc(data, now)) {
      memoryCache.set(key, { vector: data.vector, expiresAt: now + TTL_MS });
      logger.info("search embedding cache hit", { lookupMs });
      return data.vector;
    }
    logger.info("search embedding cache miss", { lookupMs });
  } catch (e: any) {
    logger.warn("search embedding cache lookup failed", { message: e?.message });
  }

  const embeddingStarted = Date.now();
  const vector = await embedText(input.query, "RETRIEVAL_QUERY");
  logger.info("search embedding generated", { embeddingMs: Date.now() - embeddingStarted });
  if (!vector) return null;
  memoryCache.set(key, { vector, expiresAt: now + TTL_MS });
  if (memoryCache.size > MEMORY_CACHE_LIMIT) memoryCache.delete(memoryCache.keys().next().value!);

  void ref.set(
      {
        key,
        normalizedQuery: normalizeSearchText(input.query),
        embeddingModel,
        embeddingVersion,
        vector,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(now + TTL_MS),
      },
      { merge: true }
    ).catch((e: any) => logger.warn("search embedding cache write failed", { message: e?.message }));
  return vector;
}

export async function getOrCreateQueryEmbedding(input: QueryEmbeddingCacheInput): Promise<number[] | null> {
  const { embeddingVersion } = queryEmbeddingVersion();
  const key = queryCacheKey({ query: input.query, embeddingVersion });
  const cached = memoryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.vector;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const work = loadQueryEmbedding(input, key).finally(() => inFlight.delete(key));
  inFlight.set(key, work);
  return work;
}
