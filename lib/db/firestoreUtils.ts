import { db } from '@/lib/firebase/config';
import { collection, doc, setDoc, getDoc, query, where, getDocs, serverTimestamp, runTransaction, orderBy, limit, startAfter, DocumentSnapshot, QueryDocumentSnapshot } from 'firebase/firestore';
import { FontFamily, Font, Classification, CLASSIFICATION_VALUES, FamilyMetadata } from '@/models/font.models';
import { normalizeName } from '@/utils/normalize'; // We'll create this util later
import { getFullFontAnalysis } from '@/lib/ai/gemini'; // Changed to import only getFullFontAnalysis

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
                // Initial placeholder data for a new family
                familyData = {
                    id: familyDocId,
                    name: familyName,
                    normalizedName: normalizedFamilyName,
                    description: '',
                    tags: [],
                    classification: parsedFontData.classification || 'Sans Serif', // Initial guess, AI will overwrite
                    fonts: [],
                    uploadDate: serverTimestamp() as any,
                    lastModified: serverTimestamp() as any,
                    metadata: {
                        foundry: parsedFontData.foundry || ''
                        // Other fields will be populated by AI or default to undefined
                    }
                };
            } else {
                familyData = familyDoc.data() as FontFamily;
                existingFonts = familyData.fonts || [];
                // Ensure metadata object exists for existing families
                if (!familyData.metadata) {
                    familyData.metadata = { foundry: parsedFontData.foundry || (familyData as any).foundry || '' };
                }
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

            // --- AI Enrichment using getFullFontAnalysis ---
            // Call for new families, or if essential AI data is missing for existing ones.
            const needsAiEnrichment = isNewFamily ||
                                    !familyData.description ||
                                    !familyData.tags || familyData.tags.length === 0 ||
                                    !familyData.classification || // If classification somehow got unset
                                    !((familyData.metadata as FamilyMetadata)?.subClassification); // Example check for deeper AI metadata

            if (needsAiEnrichment) {
                console.log(`Attempting full AI analysis for family: ${familyName}`);
                const analysisResult = await getFullFontAnalysis(
                    familyName,
                    parsedFontData.foundry || (familyData.metadata as FamilyMetadata)?.foundry,
                    parsedFontData.classification // Pass parser's classification as a hint
                );

                if (analysisResult) {
                    familyData.description = analysisResult.description;
                    familyData.tags = analysisResult.tags;
                    familyData.classification = analysisResult.classification;

                    // Merge AI-generated metadata into existing metadata
                    familyData.metadata = {
                        ...(familyData.metadata || {}),
                        ...analysisResult.metadata
                    } as FamilyMetadata;
                    // Explicitly set foundry if it came from parsedData and wasn't in metadata from AI
                    if (parsedFontData.foundry && !analysisResult.metadata?.foundry) {
                        (familyData.metadata as FamilyMetadata).foundry = parsedFontData.foundry;
                    }

                    console.log(`AI analysis successful for ${familyName}.`);
                } else {
                    console.warn(`Full AI analysis failed or returned null for ${familyName}. Using existing/default values.`);
                    // Ensure essential fields have defaults if AI fails completely for a new family
                    if (isNewFamily) {
                        familyData.description = familyData.description || 'Description not available.';
                        familyData.tags = familyData.tags || [];
                        familyData.classification = familyData.classification || 'Sans Serif';
                        familyData.metadata = familyData.metadata || { foundry: parsedFontData.foundry || '' };
                    }
                }
            }
            // --- End AI Enrichment ---

            familyData.lastModified = serverTimestamp() as any;
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
 * Retrieves font families with pagination.
 * @param pageSize The number of families to retrieve per page.
 * @param lastVisible The last visible document snapshot from the previous fetch, for pagination.
 * @returns An object containing the list of font families and the snapshot of the last visible document.
 */
export async function getAllFontFamilies(
    pageSize: number = 20, // Default page size
    lastVisible?: QueryDocumentSnapshot<FontFamily> // Use QueryDocumentSnapshot for typing
): Promise<{ families: FontFamily[], nextLastVisible: QueryDocumentSnapshot<FontFamily> | null }> {
    try {
        const familiesCol = collection(db, FAMILIES_COLLECTION) as any; // Cast to any to avoid type issues with query constraints

        let q = query(
            familiesCol,
            orderBy("name"), // Order by name for consistent pagination
            limit(pageSize)
        );

        if (lastVisible) {
            q = query(
                familiesCol,
                orderBy("name"),
                startAfter(lastVisible),
                limit(pageSize)
            );
        }

        const familySnapshot = await getDocs(q);
        const familyList = familySnapshot.docs.map(doc => doc.data() as FontFamily);
        const newLastVisible = familySnapshot.docs.length === pageSize ? familySnapshot.docs[familySnapshot.docs.length - 1] as QueryDocumentSnapshot<FontFamily> : null;

        return { families: familyList, nextLastVisible: newLastVisible };
    } catch (error) {
        console.error("Error fetching paginated font families:", error);
        return { families: [], nextLastVisible: null };
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
            // Remember to serialize timestamps if they are directly used by client components
            // For now, assuming consumption where raw data is okay or will be serialized by caller
            return familyDocSnap.data() as FontFamily;
        }
        console.log(`Font family with ID "${familyId}" not found.`);
        return null;
    } catch (error) {
        console.error(`Error fetching font family by ID "${familyId}":`, error);
        return null;
    }
}

// Add other utility functions as needed (e.g., updateFont, deleteFont, etc.)
