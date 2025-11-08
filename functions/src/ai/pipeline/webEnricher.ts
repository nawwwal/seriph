import * as functions from 'firebase-functions';
import { VertexAI } from '@google-cloud/vertexai';
import type { DataProvenance } from '../../models/font.models';
import { getConfigValue } from '../../config/remoteConfig';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'seriph';
const LOCATION_ID = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

const vertexAI = new VertexAI({
    project: PROJECT_ID,
    location: LOCATION_ID,
});

const getGenerativeModel = () => {
    const modelName = getConfigValue('web_enricher_model_name', 'gemini-2.5-flash');
    return vertexAI.getGenerativeModel({
        model: modelName,
    });
};

export interface WebEnrichmentResult {
    foundry?: {
        name: string;
        url?: string;
        confidence: number;
        source_url: string;
    };
    designer?: {
        name: string;
        bio?: string;
        url?: string;
        confidence: number;
        source_url: string;
    };
    people?: Array<{
        role: 'designer' | 'foundry' | 'contributor';
        name: string;
        source: 'extracted' | 'web';
        confidence: number;
        source_url?: string;
    }>;
    historical_context?: {
        period?: string;
        cultural_influence?: string[];
        notable_usage?: string[];
        source_url: string;
    };
    license?: {
        type: 'OFL' | 'Apache' | 'Proprietary' | 'Unknown';
        url?: string;
        confidence: number;
        source_url: string;
    };
    alternate_names?: string[];
    language_targets?: string[];
    provenance: DataProvenance[];
}

/**
 * Generate a font fingerprint for disambiguation
 */
function generateFingerprint(parsedData: any): string {
    const components = [
        parsedData.familyName || '',
        parsedData.version || '',
        parsedData.vendorId || '',
        parsedData.panose ? JSON.stringify(parsedData.panose) : '',
        parsedData.glyphCount || 0,
    ];
    return components.join('|');
}

/**
 * Search for font information using Gemini's web search capabilities
 */
async function searchFontInfo(familyName: string, fingerprint: string, parsedData: any): Promise<Partial<WebEnrichmentResult> | null> {
    const searchPrompt = `Search for information about the font family "${familyName}".

Font details:
- Version: ${parsedData.version || 'Unknown'}
- Vendor ID: ${parsedData.vendorId || 'Unknown'}
- Foundry (from font): ${parsedData.foundry || 'Unknown'}
- Designer (from font): ${parsedData.designer || 'Unknown'}

Please search for:
1. The foundry/type foundry that created this font
2. The designer(s) who created this font
3. Historical context (when it was released, design period, cultural influences)
4. License information (OFL, Apache, Proprietary, etc.)
5. Notable usage examples
6. Alternate names or variations

Provide a structured JSON response with the following schema:
{
    "foundry": { "name": "...", "url": "...", "confidence": 0.0, "source_url": "..." },
    "designer": { "name": "...", "bio": "...", "url": "...", "confidence": 0.0, "source_url": "..." },
    "historical_context": { "period": "...", "cultural_influence": ["..."], "notable_usage": ["..."], "source_url": "..." },
    "license": { "type": "...", "url": "...", "confidence": 0.0, "source_url": "..." }
}
`;

    try {
        const generativeModel = getGenerativeModel();
        const result = await generativeModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: searchPrompt }] }],
            generationConfig: {
                maxOutputTokens: 2048,
                temperature: 0.3, // Lower temperature for factual information
                responseMimeType: "application/json",
            },
        });

        const response = result.response;
        if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
            const jsonString = response.candidates[0].content.parts[0].text.trim();
            const cleanedJsonString = jsonString.replace(/^```json\n?/, '').replace(/\n?```$/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim();
            return JSON.parse(cleanedJsonString);
        }
        return null;
    } catch (error: any) {
        functions.logger.error(`Web search error for ${familyName}:`, {
            message: error.message,
            stack: error.stack,
            code: error.code,
            details: error.details,
        });
        return null;
    }
}

/**
 * Reconcile web-sourced data with extracted data, handling contradictions
 */
function reconcileData(extracted: any, web: Partial<WebEnrichmentResult>): Partial<WebEnrichmentResult> {
    const reconciled: Partial<WebEnrichmentResult> = {
        ...web,
        provenance: web.provenance || [],
    };

    // If foundry is already extracted, prefer it but note web source as confirmation
    if (extracted.foundry && web.foundry) {
        if (extracted.foundry.toLowerCase() === web.foundry.name.toLowerCase()) {
            // Match - increase confidence
            reconciled.foundry = {
                ...web.foundry,
                confidence: Math.min(0.95, web.foundry.confidence + 0.1),
            };
        } else {
            // Contradiction - prefer extracted with lower confidence on web
            reconciled.foundry = {
                name: extracted.foundry,
                confidence: 0.9,
                source_url: 'extracted',
            };
            reconciled.provenance!.push({
                source_type: 'extracted',
                source_ref: 'name#8',
                timestamp: new Date().toISOString(),
                method: 'fontkit_parser',
                confidence: 0.9,
            });
        }
    } else if (extracted.foundry && !web.foundry) {
        // Only extracted available
        reconciled.foundry = {
            name: extracted.foundry,
            confidence: 0.9,
            source_url: 'extracted',
        };
    }

    // Similar logic for designer
    if (extracted.designer && web.designer) {
        if (extracted.designer.toLowerCase() === web.designer.name.toLowerCase()) {
            reconciled.designer = {
                ...web.designer,
                confidence: Math.min(0.95, web.designer.confidence + 0.1),
            };
        } else {
            reconciled.designer = {
                name: extracted.designer,
                confidence: 0.9,
                source_url: 'extracted',
            };
        }
    } else if (extracted.designer && !web.designer) {
        reconciled.designer = {
            name: extracted.designer,
            confidence: 0.9,
            source_url: 'extracted',
        };
    }

    return reconciled;
}

/**
 * Main web enrichment function
 * Searches for missing metadata and enriches the font data
 */
export async function enrichFontFromWeb(
    parsedData: any,
    enableWebSearch: boolean = true
): Promise<Partial<WebEnrichmentResult> | null> {
    const familyName = parsedData.familyName || 'Unknown Family';
    
    // Skip web enrichment if disabled or if we already have comprehensive data
    if (!enableWebSearch) {
        functions.logger.info(`Web enrichment disabled for ${familyName}`);
        return null;
    }

    // Only search if we're missing key information
    const needsEnrichment = !parsedData.foundry || !parsedData.designer || !parsedData.historical_context;
    if (!needsEnrichment) {
        functions.logger.info(`Font ${familyName} already has comprehensive metadata, skipping web enrichment`);
        return null;
    }

    functions.logger.info(`Starting web enrichment for ${familyName}`);

    try {
        const fingerprint = generateFingerprint(parsedData);
        const webData = await searchFontInfo(familyName, fingerprint, parsedData);

        if (!webData) {
            functions.logger.warn(`No web search results for ${familyName}`);
            return null;
        }

        const reconciled = reconcileData(parsedData, webData);

        functions.logger.info(`Web enrichment completed for ${familyName}`);
        return reconciled;

    } catch (error: any) {
        functions.logger.error(`Web enrichment error for ${familyName}:`, {
            message: error.message,
            stack: error.stack,
        });
        return null;
    }
}

