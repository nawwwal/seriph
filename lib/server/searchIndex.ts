import { FieldPath, type Firestore, type Query, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { mapCatalogDocToShelfFamily } from '@/lib/api/familyShelf';
import { FAMILIES_COLLECTION } from '@/lib/server/catalogFamilyShared';
import { getShelfStats } from '@/lib/server/catalogFamilyStats';
import { isFirestoreIndexUnavailable, sortCatalogDocsByName } from '@/lib/server/firestoreQueryFallback';
import { normalizeSearchInput } from '@/lib/search/localSearch';
import type { SearchIndexItem, SearchIndexResponse } from '@/models/search.models';

const MAX_SEARCH_INDEX_ITEMS = 2000;

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function tokensFromText(text: string): string[] {
  return [...new Set(normalizeSearchInput(text).split(' ').filter((token) => token.length > 1))];
}

function mapDoc(doc: QueryDocumentSnapshot): SearchIndexItem {
  const data = doc.data();
  const shelf = mapCatalogDocToShelfFamily(data, doc.id);
  const enrichment = record(data.enrichment);
  const moods = strings(enrichment.moods);
  const useCases = strings(enrichment.useCases);
  const summary = typeof enrichment.summary === 'string' ? enrichment.summary : undefined;
  const category = typeof data.category === 'string' ? data.category : shelf.classification;
  const subClassification = typeof enrichment.classification === 'string' ? enrichment.classification : '';
  const primaryText = [shelf.name, shelf.normalizedName, shelf.classification, subClassification, ...moods].filter(Boolean).join(' ');
  const secondaryText = [category, summary, ...useCases].filter(Boolean).join(' ');
  const text = [primaryText, secondaryText].filter(Boolean).join(' ');

  return {
    ...shelf,
    slug: shelf.normalizedName,
    category,
    summary,
    moods,
    useCases,
    searchText: text,
    searchPrimaryText: primaryText,
    searchSecondaryText: secondaryText,
    searchTokens: tokensFromText(text),
  };
}

export async function listSearchIndex(db: Firestore, uid: string, knownRevision?: number): Promise<SearchIndexResponse> {
  const summary = await getShelfStats(db, uid);
  if (knownRevision === summary.libraryRevision) {
    return { items: [], generatedAt: summary.updatedAt, libraryRevision: summary.libraryRevision, unchanged: true };
  }
  let query: Query = db.collection(FAMILIES_COLLECTION)
    .where('ownerId', '==', uid)
    .where('hidden', '==', false)
    .orderBy('name', 'asc')
    .orderBy(FieldPath.documentId())
    .select('slug', 'name', 'ownerId', 'category', 'classification', 'updatedAt', 'styleCount', 'isVariable', 'axes', 'coverFace', 'status', 'hidden', 'enrichment', 'searchText', 'searchTokens')
    .limit(MAX_SEARCH_INDEX_ITEMS);
  const items: SearchIndexItem[] = [];

  try {
    while (items.length < MAX_SEARCH_INDEX_ITEMS) {
      const snap = await query.get();
      if (snap.empty) break;
      for (const doc of snap.docs) {
        items.push(mapDoc(doc));
        if (items.length >= MAX_SEARCH_INDEX_ITEMS) break;
      }
      const last = snap.docs[snap.docs.length - 1];
      if (!last || snap.docs.length < MAX_SEARCH_INDEX_ITEMS) break;
      query = query.startAfter(last.get('name') || last.id, last.id);
    }
  } catch (error) {
    if (!isFirestoreIndexUnavailable(error)) throw error;
    const snap = await db.collection(FAMILIES_COLLECTION)
      .where('ownerId', '==', uid)
      .where('hidden', '==', false)
      .select('slug', 'name', 'ownerId', 'category', 'classification', 'updatedAt', 'styleCount', 'isVariable', 'axes', 'coverFace', 'status', 'hidden', 'enrichment', 'searchText', 'searchTokens')
      .get();
    for (const doc of sortCatalogDocsByName(snap.docs).slice(0, MAX_SEARCH_INDEX_ITEMS)) {
      items.push(mapDoc(doc));
    }
  }

  return { items, generatedAt: new Date().toISOString(), libraryRevision: summary.libraryRevision };
}
