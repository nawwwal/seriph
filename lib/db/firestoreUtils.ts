import { db } from '@/lib/firebase/config';
import { collection, doc, getDoc, query, getDocs, orderBy, where } from 'firebase/firestore';
import { FontFamily } from '@/models/font.models';

const FAMILIES_COLLECTION = 'fontfamilies';

/**
 * Retrieves all font families.
 * @returns An object containing the list of all font families.
 */
export async function getAllFontFamilies(ownerId?: string): Promise<{ families: FontFamily[] }> {
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
            console.error("Error fetching all font families:", error);
            return { families: [] };
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
            return { families: [] };
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
