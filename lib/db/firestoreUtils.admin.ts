import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid'; // If needed for IDs when normalized names fail
import { FontFamily, Font, FamilyMetadata, Classification } from '../../models/font.models'; // Adjust path as needed
// Assuming normalizeName can be imported if it's a simple utility with no client-SDK dependencies
import { normalizeName } from '../../utils/normalize'; // Adjust path as needed

const FAMILIES_COLLECTION = 'fontfamilies';

/**
 * (Admin SDK Version)
 * Creates or updates a font family and adds a font to it using firebase-admin.
 * AI enrichment data is expected to be passed in.
 * @returns The created or updated FontFamily object, or null if failed.
 */
export async function serverAddFontToFamilyAdmin(
    parsedFontData: any, // Data from serverParseFontFile
    fontFileDetails: { // Details from storage and original file
        originalName: string;
        storagePath: string;     // Path in processed_fonts
        fileSize: number;
    },
    aiAnalysisResult?: any // Result from serverGetFullFontAnalysisAdmin (optional)
): Promise<FontFamily | null> {
    const familyName = parsedFontData.familyName || 'Unknown Family';
    const normalizedFamilyName = normalizeName(familyName);
    const familyDocId = normalizedFamilyName || uuidv4(); // Use normalized name or UUID as ID

    const familyRef = admin.firestore().collection(FAMILIES_COLLECTION).doc(familyDocId);
    const fontId = normalizeName(
        (parsedFontData.postScriptName || parsedFontData.subfamilyName || fontFileDetails.originalName) + '-' + (parsedFontData.format || 'TYPE')
    );

    try {
        await admin.firestore().runTransaction(async (transaction) => {
            const familyDoc = await transaction.get(familyRef);
            let familyDataToSet: Partial<FontFamily>; // Use Partial for easier construction
            let existingFonts: Font[] = [];
            let isNewFamily = false;

            if (!familyDoc.exists) {
                isNewFamily = true;
                familyDataToSet = {
                    id: familyDocId,
                    name: familyName,
                    normalizedName: normalizedFamilyName,
                    description: aiAnalysisResult?.description || 'A new font family.',
                    tags: aiAnalysisResult?.tags || [],
                    classification: aiAnalysisResult?.classification || parsedFontData.classification || 'Sans Serif',
                    fonts: [],
                    uploadDate: admin.firestore.FieldValue.serverTimestamp() as any,
                    lastModified: admin.firestore.FieldValue.serverTimestamp() as any,
                    metadata: {
                        foundry: parsedFontData.foundry || '',
                        ...(aiAnalysisResult?.metadata || {}),
                    } as FamilyMetadata,
                };
            } else {
                const existingData = familyDoc.data() as FontFamily;
                familyDataToSet = { ...existingData }; // Start with existing data
                existingFonts = existingData.fonts || [];
                familyDataToSet.lastModified = admin.firestore.FieldValue.serverTimestamp() as any;

                // Merge AI data if provided, prioritizing new AI data for certain fields
                if (aiAnalysisResult) {
                    familyDataToSet.description = aiAnalysisResult.description || existingData.description;
                    familyDataToSet.tags = aiAnalysisResult.tags && aiAnalysisResult.tags.length > 0 ? aiAnalysisResult.tags : existingData.tags;
                    familyDataToSet.classification = aiAnalysisResult.classification || existingData.classification;
                    familyDataToSet.metadata = {
                        ...(existingData.metadata || {}),
                        ...(aiAnalysisResult.metadata || {}),
                        foundry: parsedFontData.foundry || existingData.metadata?.foundry || '',
                    } as FamilyMetadata;
                }
                if (parsedFontData.foundry && !familyDataToSet.metadata!.foundry) {
                     familyDataToSet.metadata!.foundry = parsedFontData.foundry;
                }
            }

            const newFont: Font = {
                id: fontId,
                filename: fontFileDetails.originalName,
                format: parsedFontData.format || 'OTF', // Default from parser
                subfamily: parsedFontData.subfamilyName || 'Regular',
                weight: parsedFontData.weight || 400, // Placeholder from parser
                style: parsedFontData.style || 'Regular', // Placeholder from parser
                isVariable: parsedFontData.isVariable || false,
                variableAxes: parsedFontData.variableAxes || [],
                fileSize: fontFileDetails.fileSize,
                metadata: {
                    postScriptName: parsedFontData.postScriptName || null,
                    version: parsedFontData.version || null,
                    copyright: parsedFontData.copyright || null,
                    license: parsedFontData.license || null,
                    characterSetCoverage: parsedFontData.characterSetCoverage || [],
                    openTypeFeatures: parsedFontData.openTypeFeatures || [],
                    glyphCount: parsedFontData.glyphCount || null,
                    languageSupport: parsedFontData.languageSupport || [],
                    storagePath: fontFileDetails.storagePath || null,
                },
            };

            const fontExists = existingFonts.some(f => f.id === newFont.id);
            if (!fontExists) {
                existingFonts.push(newFont);
            }
            familyDataToSet.fonts = existingFonts;

            // If AI enrichment was explicitly skipped or failed, and it's a new family, ensure defaults.
            if (isNewFamily && !aiAnalysisResult) {
                familyDataToSet.description = familyDataToSet.description || 'Description pending.';
                familyDataToSet.tags = familyDataToSet.tags || [];
                familyDataToSet.classification = familyDataToSet.classification || 'Sans Serif';
            }

            transaction.set(familyRef, familyDataToSet, { merge: true });
        });

        console.log(`Admin: Font ${fontFileDetails.originalName} processed for family ${familyName}.`);
        const finalFamilyDoc = await familyRef.get();
        if (finalFamilyDoc.exists) {
            return finalFamilyDoc.data() as FontFamily;
        }
        return null;
    } catch (error: any) {
        console.error(`Admin: Transaction failed for addFontToFamilyAdmin (family: ${familyName}, font: ${fontFileDetails.originalName}). Error:`, error.message, error.stack);
        // throw new Error(`Failed to add font ${fontFileDetails.originalName} to family ${familyName}: ${error.message}`);
        return null;
    }
}

// Add other admin-specific Firestore utility functions here if needed.
