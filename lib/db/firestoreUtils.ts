import { db } from '@/lib/firebase/config';
import { collection, doc, getDoc, query, getDocs, orderBy } from 'firebase/firestore';
import { FontFamily } from '@/models/font.models';

const FAMILIES_COLLECTION = 'fontfamilies';

/**
 * Retrieves all font families.
 * @returns An object containing the list of all font families.
 */
export async function getAllFontFamilies(): Promise<{ families: FontFamily[] }> {
    try {
        const familiesCol = collection(db, FAMILIES_COLLECTION);
        const q = query(
            familiesCol,
            orderBy("name") // Order by name for consistent listing
        );

        const familySnapshot = await getDocs(q);
        const familyList = familySnapshot.docs.map(doc => doc.data() as FontFamily);

        return { families: familyList };
    } catch (error) {
        console.error("Error fetching all font families:", error);
        return { families: [] };
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
            return familyDocSnap.data() as FontFamily;
        }
        console.log(`Font family with ID "${familyId}" not found.`);
        return null;
    } catch (error) {
        console.error(`Error fetching font family by ID "${familyId}":`, error);
        return null;
    }
}

// Other client-side utility functions can remain or be added here.
