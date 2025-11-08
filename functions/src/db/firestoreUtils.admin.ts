import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import type { FontFamily, Font, FamilyMetadata, Classification } from '../models/font.models';
import { normalizeName } from '../utils/normalize';
import * as functions from 'firebase-functions';
import { deepStripUndefined } from '../utils/sanitize';

const FAMILIES_COLLECTION = 'fontfamilies';

export async function serverAddFontToFamilyAdmin(
    parsedFontData: any,
    fontFileDetails: {
        originalName: string;
        storagePath: string;
        fileSize: number;
    },
    aiAnalysisResult?: any,
    ownerId?: string
): Promise<FontFamily | null> {
    const familyName = parsedFontData.familyName || 'Unknown Family';
    const normalizedFamilyName = normalizeName(familyName);
    const familyDocId = normalizedFamilyName || uuidv4();

    const familyRef = ownerId
        ? admin.firestore().collection('users').doc(ownerId).collection(FAMILIES_COLLECTION).doc(familyDocId)
        : admin.firestore().collection(FAMILIES_COLLECTION).doc(familyDocId);
    const fontId = normalizeName(
        (parsedFontData.postScriptName || parsedFontData.subfamilyName || fontFileDetails.originalName) + '-' + (parsedFontData.format || 'TYPE')
    );

    try {
        const familyData = await admin.firestore().runTransaction(async (transaction) => {
            const familyDoc = await transaction.get(familyRef);
            let familyDataToSet: Partial<FontFamily>;
            let existingFonts: Font[] = [];
            let isNewFamily = false;

            if (!familyDoc.exists) {
                isNewFamily = true;
                familyDataToSet = {
                    id: familyDocId,
                    name: familyName,
                    normalizedName: normalizedFamilyName,
                    ...(ownerId ? { ownerId } : {}),
                    description: aiAnalysisResult?.description || 'A new font family.',
                    tags: aiAnalysisResult?.tags || [],
                    classification: aiAnalysisResult?.classification || parsedFontData.classification || 'Sans Serif',
                    fonts: [],
                    uploadDate: admin.firestore.FieldValue.serverTimestamp() as any,
                    lastModified: admin.firestore.FieldValue.serverTimestamp() as any,
                    metadata: {
                        foundry: parsedFontData.foundry || aiAnalysisResult?.metadata?.foundry || '',
                        ...(aiAnalysisResult?.metadata || {}),
                        // Enhanced fields
                        people: aiAnalysisResult?.metadata?.people,
                        historical_context: aiAnalysisResult?.metadata?.historical_context,
                        semantics: aiAnalysisResult?.metadata?.semantics,
                        license: aiAnalysisResult?.metadata?.license,
                        provenance: aiAnalysisResult?.metadata?.provenance || parsedFontData.provenance,
                    } as FamilyMetadata,
                };
                functions.logger.info(`Creating new family: ${familyName} (ID: ${familyDocId})`);
            } else {
                const existingData = familyDoc.data() as FontFamily;
                familyDataToSet = { ...existingData };
                existingFonts = existingData.fonts || [];
                familyDataToSet.lastModified = admin.firestore.FieldValue.serverTimestamp() as any;

                // Backfill ownerId if missing
                if (ownerId && !familyDataToSet.ownerId) {
                    familyDataToSet.ownerId = ownerId;
                }

                if (aiAnalysisResult) {
                    functions.logger.info(`Updating existing family ${familyName} with AI data.`);
                    familyDataToSet.description = aiAnalysisResult.description || existingData.description;
                    familyDataToSet.tags = aiAnalysisResult.tags && aiAnalysisResult.tags.length > 0 ? aiAnalysisResult.tags : existingData.tags;
                    familyDataToSet.classification = aiAnalysisResult.classification || existingData.classification;
                    
                    // Merge enhanced metadata, preserving existing and adding new fields
                    const enhancedMetadata: any = {
                        ...(existingData.metadata || {}),
                        ...(aiAnalysisResult.metadata || {}),
                        foundry: parsedFontData.foundry || aiAnalysisResult?.metadata?.foundry || existingData.metadata?.foundry || '',
                    };
                    
                    // Preserve enhanced fields if they exist
                    if (aiAnalysisResult.metadata?.people) {
                        enhancedMetadata.people = aiAnalysisResult.metadata.people;
                    }
                    if (aiAnalysisResult.metadata?.historical_context) {
                        enhancedMetadata.historical_context = aiAnalysisResult.metadata.historical_context;
                    }
                    if (aiAnalysisResult.metadata?.semantics) {
                        enhancedMetadata.semantics = aiAnalysisResult.metadata.semantics;
                    }
                    if (aiAnalysisResult.metadata?.provenance) {
                        enhancedMetadata.provenance = {
                            ...(existingData.metadata?.provenance || {}),
                            ...(aiAnalysisResult.metadata.provenance || {}),
                        };
                    }
                    if (aiAnalysisResult.metadata?.license) {
                        enhancedMetadata.license = aiAnalysisResult.metadata.license;
                    }
                    
                    familyDataToSet.metadata = enhancedMetadata as FamilyMetadata;
                } else {
                    functions.logger.info(`Updating existing family ${familyName} without new AI data.`);
                }
                // Ensure foundry from parser is considered if not present
                if (parsedFontData.foundry && !familyDataToSet.metadata!.foundry) {
                     familyDataToSet.metadata!.foundry = parsedFontData.foundry;
                }
            }

            const newFont: Font = {
                id: fontId,
                filename: fontFileDetails.originalName,
                format: parsedFontData.format || 'OTF',
                subfamily: parsedFontData.subfamilyName || 'Regular',
                weight: parsedFontData.weight || 400,
                style: parsedFontData.style || 'Regular',
                isVariable: parsedFontData.isVariable || false,
                variableAxes: parsedFontData.variableAxes || [],
                fileSize: fontFileDetails.fileSize,
                metadata: {
                    postScriptName: parsedFontData.postScriptName || null,
                    version: parsedFontData.version || null,
                    copyright: parsedFontData.copyright || null,
                    license: parsedFontData.licenseDescription || parsedFontData.license || null,
                    licenseUrl: parsedFontData.licenseUrl || null,
                    characterSetCoverage: parsedFontData.characterSetCoverage || [],
                    openTypeFeatures: parsedFontData.openTypeFeatures || [],
                    glyphCount: parsedFontData.glyphCount || null,
                    languageSupport: parsedFontData.languageSupport || [],
                    storagePath: fontFileDetails.storagePath || null,
                    // Enhanced fields
                    fingerprint: parsedFontData.fingerprint || null,
                    visual_metrics: parsedFontData.visual_metrics || null,
                    scripts: parsedFontData.scripts || null,
                    color: parsedFontData.color || null,
                    kerningPairDensity: parsedFontData.kerningPairCount || null,
                    provenance: parsedFontData.provenance || null,
                },
            };

            const fontExists = existingFonts.some(f => f.id === newFont.id);
            if (!fontExists) {
                existingFonts.push(newFont);
                functions.logger.info(`Adding new font '${newFont.filename}' (ID: ${fontId}) to family ${familyName}.`);
            } else {
                // Optionally update existing font data if needed, for now, we just don't re-add
                functions.logger.info(`Font '${newFont.filename}' (ID: ${fontId}) already exists in family ${familyName}. Skipping add.`);
            }
            familyDataToSet.fonts = existingFonts;

            if (isNewFamily && !aiAnalysisResult) {
                familyDataToSet.description = familyDataToSet.description || 'Description pending AI analysis.';
                familyDataToSet.tags = familyDataToSet.tags || [];
                familyDataToSet.classification = familyDataToSet.classification || 'Sans Serif';
            }

            const sanitized = deepStripUndefined(familyDataToSet);
            transaction.set(familyRef, sanitized, { merge: true });
            return familyDataToSet; // Return the data that was set in the transaction
        });

        functions.logger.info(`Admin: Font ${fontFileDetails.originalName} processed successfully for family ${familyName}.`);
        const finalFamilyDoc = await familyRef.get();
        if (finalFamilyDoc.exists) {
            const rawData = finalFamilyDoc.data();
            if (!rawData) return null;

            return {
                ...rawData,
                uploadDate: rawData.uploadDate && typeof (rawData.uploadDate as any).toDate === 'function'
                    ? (rawData.uploadDate as admin.firestore.Timestamp).toDate().toISOString()
                    : String(rawData.uploadDate || ''),
                lastModified: rawData.lastModified && typeof (rawData.lastModified as any).toDate === 'function'
                    ? (rawData.lastModified as admin.firestore.Timestamp).toDate().toISOString()
                    : String(rawData.lastModified || ''),
            } as FontFamily;
        }
        return null;

    } catch (error: any) {
        functions.logger.error(`Admin: Transaction failed for addFontToFamilyAdmin (family: ${familyName}, font: ${fontFileDetails.originalName}). Error:`, {
            message: error.message,
            stack: error.stack,
            details: error.details
        });
        return null;
    }
}
