import * as functions from 'firebase-functions';
import type { DataProvenance } from '../../models/font.models';
import { generateStrictJSON } from '../vertex/vertexClient';
import { RC_KEYS } from '../../config/rcKeys';
import type { ProvenanceInfo, LicenseFlag, ProvenanceSourceType, DistributionChannel, FoundryType } from '../../models/contracts';

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
		const { data, rawText } = await generateStrictJSON<any>({
			modelKey: RC_KEYS.webEnricherModelName,
			promptParts: [searchPrompt],
			opName: 'webEnricher',
			tools: [{ googleSearchRetrieval: {} as any }],
		});
		if (!data) {
			functions.logger.warn(`Web search returned no JSON for ${familyName}; raw=${rawText ? rawText.slice(0, 120) : 'null'}`);
			return null;
		}
		return data;
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

function deriveProvenance(reconciled: Partial<WebEnrichmentResult>): Partial<ProvenanceInfo> & { license_flags?: LicenseFlag[] } {
	const out: Partial<ProvenanceInfo> & { license_flags?: LicenseFlag[] } = {};
	// source_type heuristic
	const url = reconciled.foundry?.url || reconciled.designer?.url || reconciled.historical_context?.source_url || reconciled.license?.url || '';
	const u = url.toLowerCase();
	let sourceType: ProvenanceSourceType = "unknown";
	if (u.includes('fonts.google.com')) sourceType = "gf";
	else if (u.includes('github.com')) sourceType = "repo";
	else if (u.includes('/docs') || u.includes('wikipedia.org')) sourceType = "docs";
	else if (u) sourceType = "foundry_site";
	out.source_type = sourceType;
	// foundry_type heuristic
	let fType: FoundryType = "unknown";
	if (u.includes('github.com') || u.includes('gitlab.com')) fType = "open_source";
	else if (u.includes('adobe.com') || u.includes('google.com') || u.includes('microsoft.com')) fType = "corp";
	out.foundry_type = fType;
	// distribution_channel heuristic
	let channel: DistributionChannel = "other";
	if (u.includes('github.com')) channel = "github";
	else if (u.includes('fonts.google.com')) channel = "marketplace";
	else if (u.includes('npmjs.com') || u.includes('pypi.org')) channel = "package_manager";
	else if (sourceType === 'foundry_site') channel = "foundry";
	out.distribution_channel = channel;
	// license flags
	const flags: LicenseFlag[] = [];
	const licenseType = reconciled.license?.type || '';
	if (licenseType.toUpperCase().includes('OFL')) flags.push('open_source');
	if (reconciled.license?.url) flags.push('web_embedded');
	out.license_flags = flags;
	// source rank (simple)
	out.source_rank = u ? (u.includes('fonts.google.com') ? 0.9 : u.includes('github.com') ? 0.8 : 0.6) : 0.5;
	return out;
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
		const prov = deriveProvenance(reconciled);
		(reconciled as any)._provenance_info = prov;

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

