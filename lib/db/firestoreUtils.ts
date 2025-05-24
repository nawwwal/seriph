import { db } from '@/lib/firebase/config';
import { collection, doc, setDoc, getDoc, query, where, getDocs, serverTimestamp, runTransaction } from 'firebase/firestore';
import { FontFamily, Font } from '@/models/font.models';
import { normalizeName } from '@/utils/normalize'; // We'll create this util later
import { generateFontDescription, generateFontTags } from '@/lib/ai/gemini'; // Import AI functions

const FAMILIES_COLLECTION = 'fontfamilies';

/**
 * Creates or updates a font family and adds a font to it.
 * Uses a transaction to ensure atomicity.
 * @returns The created or updated FontFamily object, or null if failed.
 */
export async function addFontToFamily(parsedFontData: any, fontFileDetails: { originalName: string, storagePath: string, downloadUrl: string, fileSize: number }): Promise<FontFamily | null> {
    const familyName = parsedFontData.familyName || 'Unknown Family';
    const normalizedFamilyName = normalizeName(familyName);
    const familyDocId = normalizedFamilyName; // Use normalized name as ID for simplicity

    const familyRef = doc(db, FAMILIES_COLLECTION, familyDocId);
    const fontId = normalizeName(
        (parsedFontData.postScriptName || parsedFontData.subfamilyName || fontFileDetails.originalName) + '-' + parsedFontData.format
    );

    try {
        await runTransaction(db, async (transaction) => {
            const familyDoc = await transaction.get(familyRef);
            let familyData: Partial<FontFamily>;
            let existingFonts: Font[] = [];
            let isNewFamily = false;

            if (!familyDoc.exists()) {
                isNewFamily = true;
                familyData = {
                    id: familyDocId,
                    name: familyName,
                    normalizedName: normalizedFamilyName,
                    description: '', // AI will fill this
                    tags: [], // AI will fill this
                    classification: parsedFontData.classification || 'Sans Serif', // Default, AI to refine
                    fonts: [],
                    uploadDate: serverTimestamp() as any, // Firestore FieldValue, cast to satisfy TypeScript
                    lastModified: serverTimestamp() as any, // Firestore FieldValue, cast to satisfy TypeScript
                    metadata: {
                        foundry: parsedFontData.foundry || ''
                        // Ensure other family metadata fields have defaults if added
                    }
                };
            } else {
                familyData = familyDoc.data() as FontFamily;
                existingFonts = familyData.fonts || [];
            }

            const newFont: Font = {
                id: fontId,
                filename: fontFileDetails.originalName,
                format: parsedFontData.format || 'OTF', // Default format if undefined
                subfamily: parsedFontData.subfamilyName || 'Regular',
                weight: parsedFontData.weight || 400, // Placeholder
                style: parsedFontData.style || 'Regular', // Placeholder
                isVariable: parsedFontData.isVariable || false, // Placeholder
                variableAxes: parsedFontData.variableAxes || [], // Placeholder
                fileSize: fontFileDetails.fileSize,
                downloadUrl: fontFileDetails.downloadUrl, // This will be the final URL after moving from raw_uploads
                metadata: {
                    postScriptName: parsedFontData.postScriptName || null,
                    version: parsedFontData.version || null,
                    copyright: parsedFontData.copyright || null,
                    license: parsedFontData.license || null, // Default to null if not parsed
                    characterSetCoverage: parsedFontData.characterSetCoverage || [],
                    openTypeFeatures: parsedFontData.openTypeFeatures || [],
                    glyphCount: parsedFontData.glyphCount || null,
                    languageSupport: parsedFontData.languageSupport || [],
                    // ensure all optional FontMetadata fields from your model have a default (null or empty array/string)
                }
            };

            // Avoid duplicate fonts within a family based on ID (PostScript name or subfamily)
            const fontExists = existingFonts.some(f => f.id === newFont.id);
            if (!fontExists) {
                existingFonts.push(newFont);
            }

            familyData.fonts = existingFonts;

            // --- AI Enrichment ---
            // Only generate for new families or if description/tags are missing/default
            // to avoid re-generating on every font variant upload to an existing family unless desired.
            const shouldGenerateDescription = isNewFamily || !familyData.description || familyData.description.trim() === '';
            const shouldGenerateTags = isNewFamily || !familyData.tags || familyData.tags.length === 0;

            if (shouldGenerateDescription) {
                const newDescription = await generateFontDescription(familyName, undefined, familyData.classification, []); // Pass empty array for characteristics for now
                if (newDescription) {
                    familyData.description = newDescription;
                }
            }

            if (shouldGenerateTags && familyData.description) { // Ensure description is available for tag generation
                const newTags = await generateFontTags(familyName, familyData.description, familyData.classification);
                if (newTags) {
                    familyData.tags = newTags;
                }
            }
            // --- End AI Enrichment ---

            familyData.lastModified = serverTimestamp() as any; // Firestore FieldValue, cast to satisfy TypeScript

            transaction.set(familyRef, familyData, { merge: true });
            // After transaction.set, familyData does not yet have server-generated timestamps resolved.
            // We will return the data as it is, and the caller can refetch if precise timestamps are needed for indexing.
        });
        console.log(`Font ${fontFileDetails.originalName} processed for family ${familyName}. AI enrichment attempted.`);

        // Construct the FontFamily object to return with potentially merged data.
        // For accurate timestamps for indexing, a re-fetch might be better after transaction.
        // However, for now, we return the data structure that was set.
        const finalFamilyData = await getDoc(familyRef); // Re-fetch to get resolved timestamps
        if (finalFamilyData.exists()) {
            return finalFamilyData.data() as FontFamily;
        }
        return null; // Should ideally not happen if transaction succeeded

    } catch (error) {
        console.error('Transaction failed or AI enrichment error: ', error);
        // throw new Error(`Failed to add font ${fontFileDetails.originalName} to family ${familyName}: ${error}`);
        return null; // Return null on failure
    }
}

/**
 * Retrieves all font families.
 */
export async function getAllFontFamilies(): Promise<FontFamily[]> {
    const familiesCol = collection(db, FAMILIES_COLLECTION);
    const familySnapshot = await getDocs(familiesCol);
    const familyList = familySnapshot.docs.map(doc => doc.data() as FontFamily);
    return familyList;
}

// Add other utility functions as needed (e.g., getFamilyById, updateFont, deleteFont, etc.)
