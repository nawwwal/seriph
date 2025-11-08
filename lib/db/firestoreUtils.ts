import { db } from '@/lib/firebase/config';
import {
  collection,
  collectionGroup,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { FontFamily } from '@/models/font.models';

const SEARCH_FAMILIES_COLLECTION = 'families';
const SEARCH_STYLES_COLLECTION = 'styles';
const SEARCH_SIGNALS_COLLECTION = 'searchSignals';
import { IngestRecord } from '@/models/ingest.models';

const FAMILIES_COLLECTION = 'fontfamilies';

/**
 * Retrieves all font families.
 * @returns An object containing the list of all font families.
 */
export async function getAllFontFamilies(ownerId?: string): Promise<{
    families: FontFamily[];
    errorCode?: string;
    errorMessage?: string;
}> {
    try {
        let familyList: FontFamily[] = [];

        if (ownerId) {
          // Primary: user-scoped subcollection
          const familiesCol = collection(db, 'users', ownerId, FAMILIES_COLLECTION);
          const qUser = query(familiesCol, orderBy('name'));
          const snap = await getDocs(qUser);
          familyList = snap.docs.map((d) => {
            const data = d.data() as FontFamily;
            return { ...data, id: (data as any).id ?? d.id } as FontFamily;
          });

          // Fallback: if none under user, attempt legacy top-level
          if (familyList.length === 0) {
            const legacyCol = collection(db, FAMILIES_COLLECTION);
            const legacySnap = await getDocs(query(legacyCol, orderBy('name')));
            familyList = legacySnap.docs.map((d) => {
              const data = d.data() as FontFamily;
              return { ...data, id: (data as any).id ?? d.id } as FontFamily;
            });
          }
        } else {
          // No owner provided: query collection group across all users
          const cg = collectionGroup(db, FAMILIES_COLLECTION);
          const snap = await getDocs(query(cg, orderBy('name')));
          familyList = snap.docs.map((d) => {
            const data = d.data() as FontFamily;
            return { ...data, id: (data as any).id ?? d.id } as FontFamily;
          });
        }

        return { families: familyList };
    } catch (error: any) {
        const message = typeof error?.message === 'string' ? error.message : '';
        const isIndexMissing = (error?.code === 'failed-precondition' || error?.code === 'permission-denied') && message.includes('requires an index');
        if (!isIndexMissing) {
            if (error?.code !== 'permission-denied') {
                console.error("Error fetching all font families:", error);
            }
            return {
                families: [],
                errorCode: error?.code,
                errorMessage: message || 'Unknown Firestore error',
            };
        }

        try {
            // Fallback: drop orderBy from query, then sort in-memory by name
            const familiesCol = collection(db, FAMILIES_COLLECTION);
            const qNoOrder = ownerId
                ? query(
                    familiesCol,
                    where('ownerId', '==', ownerId)
                  )
                : query(familiesCol);

            const snap = await getDocs(qNoOrder);
            // If ownerId filter yields nothing, fetch all
            const effectiveSnap = ownerId && snap.empty ? await getDocs(collection(db, FAMILIES_COLLECTION)) : snap;
            const list = effectiveSnap.docs.map(d => {
                const data = d.data() as FontFamily;
                return { ...data, id: (data as any).id ?? d.id } as FontFamily;
            });

            list.sort((a, b) => a.name.localeCompare(b.name));
            return { families: list };
        } catch (fallbackError) {
            console.error("Fallback fetch of font families failed:", fallbackError);
            return {
                families: [],
                errorCode: (fallbackError as any)?.code,
                errorMessage: (fallbackError as any)?.message || 'Unknown Firestore error',
            };
        }
    }
}

/**
 * Retrieves a single font family by its ID (normalized name).
 * @param familyId The ID of the font family to retrieve.
 * @returns The FontFamily object or null if not found.
 */
export async function getFontFamilyById(familyId: string, ownerId?: string): Promise<FontFamily | null> {
    if (!familyId) {
        console.warn("getFontFamilyById called with no familyId");
        return null;
    }
    try {
        if (ownerId) {
          // User-scoped doc
          const familyDocRef = doc(db, 'users', ownerId, FAMILIES_COLLECTION, familyId);
          const familyDocSnap = await getDoc(familyDocRef);
          if (familyDocSnap.exists()) {
            const data = familyDocSnap.data() as FontFamily;
            return { ...data, id: (data as any).id ?? familyId } as FontFamily;
          }
        }

        // Fallback 1: legacy top-level doc
        const legacyRef = doc(db, FAMILIES_COLLECTION, familyId);
        const legacySnap = await getDoc(legacyRef);
        if (legacySnap.exists()) {
          const data = legacySnap.data() as FontFamily;
          return { ...data, id: (data as any).id ?? familyId } as FontFamily;
        }

        // Fallback 2: collection group search by id
        const cg = collectionGroup(db, FAMILIES_COLLECTION);
        const cgSnap = await getDocs(query(cg, where('id', '==', familyId)));
        if (!cgSnap.empty) {
          const d = cgSnap.docs[0];
          const data = d.data() as FontFamily;
          return { ...data, id: (data as any).id ?? familyId } as FontFamily;
        }

        console.log(`Font family with ID "${familyId}" not found in user or legacy collections.`);
        return null;
    } catch (error) {
        console.error(`Error fetching font family by ID "${familyId}":`, error);
        return null;
    }
}

// Other client-side utility functions can remain or be added here.

const serializeTimestampValue = (value: any): string | null => {
  if (!value) return null;
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value?.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return null;
};

export async function getUserIngests(userId?: string, max = 50): Promise<IngestRecord[]> {
  if (!userId) {
    return [];
  }

  try {
    const ingestsCol = collection(db, 'users', userId, 'ingests');
    const ingestsQuery = query(ingestsCol, orderBy('updatedAt', 'desc'), limit(max));
    const snapshot = await getDocs(ingestsQuery);

    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Record<string, any>;
      return {
        id: docSnap.id,
        ingestId: (data.ingestId as string) ?? docSnap.id,
        ownerId: (data.ownerId as string) ?? userId,
        originalName: (data.originalName as string) ?? 'Font file',
        status: (data.status as string) ?? 'uploaded',
        error: data.error ?? null,
        errorCode: data.errorCode ?? null,
        familyId: data.familyId ?? null,
        requestId: data.requestId ?? null,
        processingId: data.processingId ?? null,
        uploadSource: data.uploadSource ?? null,
        unprocessedPath: data.unprocessedPath ?? null,
        processedPath: data.processedPath ?? null,
        uploadedAt: serializeTimestampValue(data.uploadedAt),
        updatedAt: serializeTimestampValue(data.updatedAt),
      } as IngestRecord;
    });
  } catch (error) {
    console.error('Error fetching ingests:', error);
    return [];
  }
}

export interface SearchStyleDoc {
  styleId: string;
  familyId: string;
  styleName: string;
  license?: string;
  classification?: string;
  scripts?: string[];
  features?: string[];
  axisTags?: string[];
  isVariable?: boolean;
  weight?: number;
  width?: number;
  updatedAt?: string;
}

export async function getSearchStylesByIds(styleIds: string[]): Promise<SearchStyleDoc[]> {
  if (!Array.isArray(styleIds) || styleIds.length === 0) return [];
  const unique = Array.from(new Set(styleIds));
  const results: SearchStyleDoc[] = [];
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const snapshot = await getDocs(
      query(
        collection(db, SEARCH_STYLES_COLLECTION),
        where('styleId', 'in', chunk)
      )
    );
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Record<string, any>;
      results.push({
        styleId: data.styleId ?? docSnap.id,
        familyId: data.familyId,
        styleName: data.styleName ?? docSnap.id,
        license: data.license,
        classification: data.classification,
        scripts: data.scripts ?? [],
        features: data.features ?? [],
        axisTags: data.axisTags ?? data.axes?.map((axis: any) => axis?.tag).filter(Boolean) ?? [],
        isVariable: Boolean(data.isVariable),
        weight: typeof data.weight === 'number' ? data.weight : undefined,
        width: typeof data.width === 'number' ? data.width : undefined,
        updatedAt: serializeTimestampValue(data.updatedAt),
      });
    });
  }
  return results;
}

export interface SearchFamilyDoc {
  familyId: string;
  name: string;
  license?: string;
  classification?: string;
  scripts?: string[];
  tags?: string[];
  popularity?: number;
}

export async function getSearchFamiliesByIds(familyIds: string[]): Promise<SearchFamilyDoc[]> {
  if (!Array.isArray(familyIds) || familyIds.length === 0) return [];
  const unique = Array.from(new Set(familyIds));
  const results: SearchFamilyDoc[] = [];
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const snapshot = await getDocs(
      query(
        collection(db, SEARCH_FAMILIES_COLLECTION),
        where('familyId', 'in', chunk)
      )
    );
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Record<string, any>;
      results.push({
        familyId: data.familyId ?? docSnap.id,
        name: data.name ?? docSnap.id,
        license: data.license,
        classification: data.classification,
        scripts: data.scripts ?? [],
        tags: data.tags ?? [],
        popularity: typeof data.popularity === 'number' ? data.popularity : undefined,
      });
    });
  }
  return results;
}

export interface SearchSignalDoc {
  styleId: string;
  trendingScore?: number;
  clickThroughRate?: number;
  saves?: number;
  conversions?: number;
}

export async function getSearchSignals(styleIds: string[]): Promise<SearchSignalDoc[]> {
  if (!Array.isArray(styleIds) || styleIds.length === 0) return [];
  const unique = Array.from(new Set(styleIds));
  const results: SearchSignalDoc[] = [];
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const snapshot = await getDocs(
      query(
        collection(db, SEARCH_SIGNALS_COLLECTION),
        where('styleId', 'in', chunk)
      )
    );
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Record<string, any>;
      results.push({
        styleId: data.styleId ?? docSnap.id,
        trendingScore: typeof data.trendingScore === 'number' ? data.trendingScore : undefined,
        clickThroughRate: typeof data.clickThroughRate === 'number' ? data.clickThroughRate : undefined,
        saves: typeof data.saves === 'number' ? data.saves : undefined,
        conversions: typeof data.conversions === 'number' ? data.conversions : undefined,
      });
    });
  }
  return results;
}
