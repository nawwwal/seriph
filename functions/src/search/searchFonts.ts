/**
 * Semantic font search over the rebuilt catalog using Firestore-native vector
 * search (findNearest / KNN). Structured filters pre-narrow the collection
 * (also keeping brute-force KNN fast); the query text is embedded and matched
 * against each family's `text_vec`. Falls back to a filtered listing when there
 * is no query or no embedding/vectors yet.
 */
import { getFirestore } from 'firebase-admin/firestore';
import type { Query, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { embedText } from '../ai/embeddings';
import { getConfigNumber } from '../config/remoteConfig';
import { RC_KEYS, RC_DEFAULTS } from '../config/rcKeys';
import { FAMILIES_COLLECTION } from '../storage/familyStore';
import type { FontFamilyDoc } from '../models/catalog.models';

export interface SearchRequest {
  q?: string;
  filters?: { category?: string; ownerId?: string; isVariable?: boolean };
  limit?: number;
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
}

function toItem(family: FontFamilyDoc, distance?: number): SearchResultItem {
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
    score: typeof distance === 'number' ? Math.max(0, 1 - distance) : undefined,
  };
}

export async function searchFonts(req: SearchRequest): Promise<{ results: SearchResultItem[] }> {
  const db = getFirestore();
  const topK = req.limit ?? getConfigNumber(RC_KEYS.searchTopK, Number(RC_DEFAULTS[RC_KEYS.searchTopK]));

  let base: Query = db.collection(FAMILIES_COLLECTION);
  if (req.filters?.ownerId) base = base.where('ownerId', '==', req.filters.ownerId);
  if (req.filters?.category) base = base.where('category', '==', req.filters.category);

  const q = (req.q || '').trim();
  let docs: QueryDocumentSnapshot[] = [];

  if (q) {
    const vec = await embedText(q, 'RETRIEVAL_QUERY');
    if (vec) {
      try {
        const vq = base.findNearest({
          vectorField: 'text_vec',
          queryVector: vec,
          limit: topK,
          distanceMeasure: 'COSINE',
          distanceResultField: '_distance',
        });
        docs = (await vq.get()).docs;
      } catch (e: any) {
        logger.warn('vector search failed; falling back to listing', { message: e?.message });
      }
    }
  }

  if (docs.length === 0) {
    docs = (await base.limit(topK).get()).docs;
  }

  let results = docs.map((d) => toItem(d.data() as FontFamilyDoc, d.get('_distance')));
  if (req.filters?.isVariable !== undefined) {
    results = results.filter((r) => {
      const fam = docs.find((d) => d.id === r.id)?.data() as FontFamilyDoc | undefined;
      return fam?.faces?.some((f) => f.isVariable) === req.filters!.isVariable;
    });
  }
  return { results };
}
