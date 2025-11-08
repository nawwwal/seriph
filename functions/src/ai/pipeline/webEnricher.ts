import * as functions from 'firebase-functions';
import { GoogleGenAI } from '@google/genai';
import type { DataProvenance } from '../../models/font.models';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'seriph';
const LOCATION_ID = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const TARGET_MODEL_NAME = 'gemini-2.5-flash';

const genAI = new GoogleGenAI({
    vertexai: true,
    project: PROJECT_ID,
    location: LOCATION_ID,
});

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
async function searchFontInfo(familyName: string, fingerprint: string, parsedData: any): Promise<string | null> {
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

Provide a structured summary with URLs to sources.`;

    try {
        const request: any = {
            model: TARGET_MODEL_NAME,
            contents: [{ role: 'user', parts: [{ text: searchPrompt }] }],
            generationConfig: {
                maxOutputTokens: 2048,
                temperature: 0.3, // Lower temperature for factual information
                // Note: Not using responseMimeType here as web search results are unstructured text
            },
        };
        const result = await genAI.models.generateContent(request);

        if (result?.candidates?.[0]?.content?.parts?.[0]?.text) {
            return result.candidates[0].content.parts[0].text.trim();
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
 * Parse web search results into structured data
 */
function parseWebSearchResults(searchText: string, parsedData: any): Partial<WebEnrichmentResult> {
    const result: Partial<WebEnrichmentResult> = {
        provenance: [],
    };

    // Extract foundry information
    const foundryMatch = searchText.match(/foundry[:\s]+([^\n]+)/i) || 
                        searchText.match(/type foundry[:\s]+([^\n]+)/i);
    if (foundryMatch) {
        const foundryName = foundryMatch[1].trim().split(/[,\n]/)[0];
        if (foundryName && foundryName.length > 2) {
            result.foundry = {
                name: foundryName,
                confidence: 0.8,
                source_url: 'web_search',
            };
            result.provenance!.push({
                source_type: 'web',
                source_ref: 'web_search',
                timestamp: new Date().toISOString(),
                method: 'gemini_web_search',
                confidence: 0.8,
            });
        }
    }

    // Extract designer information
    const designerMatch = searchText.match(/designer[:\s]+([^\n]+)/i) ||
                         searchText.match(/designed by[:\s]+([^\n]+)/i);
    if (designerMatch) {
        const designerName = designerMatch[1].trim().split(/[,\n]/)[0];
        if (designerName && designerName.length > 2) {
            result.designer = {
                name: designerName,
                confidence: 0.8,
                source_url: 'web_search',
            };
            // Also add to people array
            if (!result.people) {
                result.people = [];
            }
            result.people.push({
                role: 'designer',
                name: designerName,
                source: 'web',
                confidence: 0.8,
                source_url: 'web_search',
            });
            result.provenance!.push({
                source_type: 'web',
                source_ref: 'web_search',
                timestamp: new Date().toISOString(),
                method: 'gemini_web_search',
                confidence: 0.8,
            });
        }
    }
    
    // Extract foundry and add to people array
    if (result.foundry) {
        if (!result.people) {
            result.people = [];
        }
        result.people.push({
            role: 'foundry',
            name: result.foundry.name,
            source: 'web',
            confidence: result.foundry.confidence,
            source_url: result.foundry.source_url,
        });
    }

    // Extract license information
    const licenseMatch = searchText.match(/(OFL|Apache|Open Font License|SIL Open Font License|Proprietary)/i);
    if (licenseMatch) {
        let licenseType: 'OFL' | 'Apache' | 'Proprietary' | 'Unknown' = 'Unknown';
        const matchText = licenseMatch[1].toLowerCase();
        if (matchText.includes('ofl') || matchText.includes('open font')) {
            licenseType = 'OFL';
        } else if (matchText.includes('apache')) {
            licenseType = 'Apache';
        } else if (matchText.includes('proprietary')) {
            licenseType = 'Proprietary';
        }
        result.license = {
            type: licenseType,
            confidence: 0.85,
            source_url: 'web_search',
        };
        result.provenance!.push({
            source_type: 'web',
            source_ref: 'web_search',
            timestamp: new Date().toISOString(),
            method: 'gemini_web_search',
            confidence: 0.85,
        });
    }

    // Extract historical context
    const periodMatch = searchText.match(/(\d{4}s?|19\d{2}|20\d{2}|modernist|renaissance|baroque)/i);
    if (periodMatch) {
        result.historical_context = {
            period: periodMatch[1],
            source_url: 'web_search',
        };
        result.provenance!.push({
            source_type: 'web',
            source_ref: 'web_search',
            timestamp: new Date().toISOString(),
            method: 'gemini_web_search',
            confidence: 0.7,
        });
    }

    return result;
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
        const searchResults = await searchFontInfo(familyName, fingerprint, parsedData);

        if (!searchResults) {
            functions.logger.warn(`No web search results for ${familyName}`);
            return null;
        }

        const webData = parseWebSearchResults(searchResults, parsedData);
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

