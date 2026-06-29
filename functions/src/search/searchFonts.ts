/**
 * Hybrid semantic font search over the rebuilt catalog.
 *
 * Three Firestore vector lanes capture broad intent, mood/voice, and use case.
 * An exact/token lane catches family names, categories, classifications, moods,
 * and jobs-to-be-done terms. Candidates are merged by family id and reranked
 * with deterministic score fusion.
 */
import { getFirestore } from 'firebase-admin/firestore';
import type { Query, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { getConfigNumber } from '../config/remoteConfig';
import { RC_KEYS, RC_DEFAULTS } from '../config/rcKeys';
import { FAMILIES_COLLECTION } from '../storage/familyStore';
import type { FontFamilyDoc } from '../models/catalog.models';
import { getOrCreateQueryEmbedding } from './queryEmbeddingCache';
import {
  SEARCH_VECTOR_LANES,
  buildQueryLaneInput,
  normalizeSearchText,
  tokenizeSearchText,
  type SearchVectorLane,
} from './searchDocument';
import {
  DEFAULT_SEARCH_WEIGHTS,
  exactMatchScore,
  fuseCandidateScore,
  mergeSearchCandidate,
  qualityScore,
  semanticScoreFromDistance,
  type SearchScoreBreakdown,
} from './scoring';

export interface SearchRequest {
  q?: string;
  filters?: { category?: string; ownerId?: string; isVariable?: boolean };
  limit?: number;
  debug?: boolean;
}

export interface SearchResultItem {
  id: string;
  slug: string;
  name: string;
  category: string;
  classification?: string;
  summary?: string;
  moods?: string[];
  coverUrl?: string;
  styleCount: number;
  score?: number;
  scoreBreakdown?: SearchScoreBreakdown;
}

const VECTOR_FIELD_BY_LANE: Record<SearchVectorLane, 'text_vec' | 'mood_vec' | 'use_case_vec'> = {
  text: 'text_vec',
  mood: 'mood_vec',
  useCase: 'use_case_vec',
};

function toItem(family: FontFamilyDoc, score?: number, scoreBreakdown?: SearchScoreBreakdown): SearchResultItem {
  const cover = family.faces?.find((f) => f.id === family.coverFaceId) || family.faces?.[0];
  return {
    id: family.id,
    slug: family.slug,
    name: family.name,
    category: family.category,
    classification: family.enrichment?.classification ?? family.classification,
    summary: family.enrichment?.summary,
    moods: family.enrichment?.moods,
    coverUrl: cover?.woff2?.url,
    styleCount: family.faces?.length ?? 0,
    score,
    ...(scoreBreakdown ? { scoreBreakdown } : {}),
  };
}

function isVariableFamily(family: FontFamilyDoc): boolean {
  return family.faces?.some((face) => face.isVariable) ?? false;
}

function isSearchableStatus(family: FontFamilyDoc): boolean {
  return family.status === 'ready' || family.status === 'enriched';
}

function applyStructuredFilters(query: Query, req: SearchRequest): Query {
  let base = query;
  if (req.filters?.ownerId) base = base.where('ownerId', '==', req.filters.ownerId);
  if (req.filters?.category) base = base.where('category', '==', req.filters.category);
  return base;
}

async function runVectorLane(
  base: Query,
  lane: SearchVectorLane,
  vector: number[],
  topK: number
): Promise<QueryDocumentSnapshot[]> {
  const started = Date.now();
  try {
    const snap = await base
      .findNearest({
        vectorField: VECTOR_FIELD_BY_LANE[lane],
        queryVector: vector,
        limit: topK,
        distanceMeasure: 'COSINE',
        distanceResultField: '_distance',
      })
      .get();
    logger.info('search vector lane complete', { lane, count: snap.docs.length, ms: Date.now() - started });
    return snap.docs;
  } catch (e: any) {
    logger.warn('search vector lane failed', { lane, message: e?.message, ms: Date.now() - started });
    return [];
  }
}

async function runExactLane(base: Query, q: string, topK: number): Promise<QueryDocumentSnapshot[]> {
  const started = Date.now();
  const tokens = tokenizeSearchText([q]).slice(0, 30);
  if (tokens.length === 0) return [];
  try {
    const snap = await base.where('searchTokens', 'array-contains-any', tokens).limit(topK).get();
    logger.info('search exact lane complete', { count: snap.docs.length, ms: Date.now() - started });
    return snap.docs;
  } catch (e: any) {
    logger.warn('search exact lane failed', { message: e?.message, ms: Date.now() - started });
    return [];
  }
}

export async function searchFonts(req: SearchRequest): Promise<{ results: SearchResultItem[] }> {
  const totalStarted = Date.now();
  const db = getFirestore();
  const topK = req.limit ?? getConfigNumber(RC_KEYS.searchTopK, Number(RC_DEFAULTS[RC_KEYS.searchTopK]));
  const q = (req.q || '').trim();
  const normalizedQuery = normalizeSearchText(q);

  const base = applyStructuredFilters(db.collection(FAMILIES_COLLECTION), req);

  if (!normalizedQuery) {
    let listing = (await base.limit(topK).get()).docs.map((doc) => doc.data() as FontFamilyDoc);
    listing = listing.filter(isSearchableStatus);
    if (req.filters?.isVariable !== undefined) {
      listing = listing.filter((family) => isVariableFamily(family) === req.filters?.isVariable);
    }
    logger.info('search fallback listing complete', { count: listing.length, totalMs: Date.now() - totalStarted });
    return { results: listing.map((family) => toItem(family)) };
  }

  const exactPromise = runExactLane(base, normalizedQuery, topK);
  const embeddingStarted = Date.now();
  const laneVectors = await Promise.all(
    SEARCH_VECTOR_LANES.map(async (lane) => ({
      lane,
      vector: await getOrCreateQueryEmbedding({
        db,
        lane,
        query: buildQueryLaneInput(normalizedQuery, lane),
      }),
    }))
  );
  logger.info('search query embeddings complete', { ms: Date.now() - embeddingStarted });

  const vectorDocsByLane = await Promise.all(
    laneVectors.map(({ lane, vector }) => (vector ? runVectorLane(base, lane, vector, topK) : Promise.resolve([])))
  );
  const exactDocs = await exactPromise;

  const mergeStarted = Date.now();
  const candidates = new Map<string, ReturnType<typeof mergeSearchCandidate>>();
  for (const [index, docs] of vectorDocsByLane.entries()) {
    const lane = SEARCH_VECTOR_LANES[index];
    for (const doc of docs) {
      mergeSearchCandidate(candidates, doc.data() as FontFamilyDoc, {
        lane,
        score: semanticScoreFromDistance(doc.get('_distance')),
      });
    }
  }

  for (const doc of exactDocs) {
    const family = doc.data() as FontFamilyDoc;
    mergeSearchCandidate(candidates, family, {
      exact: exactMatchScore(normalizedQuery, family),
    });
  }

  if (candidates.size === 0) {
    const docs = (await base.limit(topK).get()).docs;
    for (const doc of docs) {
      const family = doc.data() as FontFamilyDoc;
      mergeSearchCandidate(candidates, family, {
        exact: exactMatchScore(normalizedQuery, family),
      });
    }
  }

  const results = [...candidates.values()]
    .map((candidate) => {
      const scores = {
        ...candidate.scores,
        exact: Math.max(candidate.scores.exact, exactMatchScore(normalizedQuery, candidate.family)),
        quality: qualityScore(candidate.family),
      };
      const score = fuseCandidateScore(scores, DEFAULT_SEARCH_WEIGHTS);
      return { family: candidate.family, score, scores };
    })
    .filter(({ family }) => isSearchableStatus(family))
    .filter(({ family }) => req.filters?.isVariable === undefined || isVariableFamily(family) === req.filters?.isVariable)
    .sort((a, b) => b.score - a.score || a.family.name.localeCompare(b.family.name))
    .slice(0, topK)
    .map(({ family, score, scores }) => toItem(family, score, req.debug ? scores : undefined));

  logger.info('search merge/rerank complete', {
    candidates: candidates.size,
    results: results.length,
    ms: Date.now() - mergeStarted,
    totalMs: Date.now() - totalStarted,
  });
  return { results };
}
