import { db } from '@/lib/firebase/config';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { FontFamily } from '@/models/font.models';
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
        const familiesCol = collection(db, FAMILIES_COLLECTION);
        const q = ownerId
            ? query(
                familiesCol,
                where('ownerId', '==', ownerId),
                orderBy("name")
              )
            : query(
                familiesCol,
                orderBy("name")
              );

        const familySnapshot = await getDocs(q);
        const familyList = familySnapshot.docs.map(d => {
            const data = d.data() as FontFamily;
            return { ...data, id: data.id ?? d.id } as FontFamily;
        });

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
            const list = snap.docs.map(d => {
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
export async function getFontFamilyById(familyId: string): Promise<FontFamily | null> {
    if (!familyId) {
        console.warn("getFontFamilyById called with no familyId");
        return null;
    }
    try {
        const familyDocRef = doc(db, FAMILIES_COLLECTION, familyId);
        const familyDocSnap = await getDoc(familyDocRef);

        if (familyDocSnap.exists()) {
            const data = familyDocSnap.data() as FontFamily;
            return { ...data, id: data.id ?? familyId } as FontFamily;
        }
        console.log(`Font family with ID "${familyId}" not found.`);
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
