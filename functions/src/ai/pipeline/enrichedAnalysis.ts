import * as functions from 'firebase-functions';
import { ENRICHED_ANALYSIS_SYSTEM_PROMPT } from '../prompts/systemPrompts';
import { buildEnrichedAnalysisPrompt } from '../prompts/promptTemplates';
import { validateAnalysisResult } from './validation';
import { getConfigValue, getConfigBoolean } from '../../config/remoteConfig';
import { RC_KEYS, RC_DEFAULTS } from '../../config/rcKeys';
import { generateStrictJSON, isVertexEnabled } from '../vertex/vertexClient';
import { getConfidenceBandThresholds } from '../../config/remoteConfig';
import { getPromptContents } from '../prompts/promptRegistry';
import { enrichedAnalysisSchema } from '../schemas/enrichedAnalysisSchema';

export async function performEnrichedAnalysis(
    parsedData: any,
    visualMetrics?: any,
    visualAnalysisResult?: any,
    useFallback: boolean = false
): Promise<any | null> {
    if (!isVertexEnabled()) {
        functions.logger.info(`Vertex AI disabled via RC. Skipping enriched analysis.`);
        return null;
    }
    const WEB_SEARCH_ENABLED = getConfigBoolean(RC_KEYS.webEnrichmentEnabled, false);
    const familyName = parsedData.familyName || 'Unknown Family';
    const modelNameKey = useFallback ? RC_KEYS.enrichedAnalysisFallbackModelName : RC_KEYS.enrichedAnalysisModelName;
    functions.logger.info(`Starting enriched analysis for: ${familyName} (${useFallback ? 'fallback' : 'primary'})${WEB_SEARCH_ENABLED ? ' with web search' : ''}`);

    const userPrompt = buildEnrichedAnalysisPrompt(parsedData, visualMetrics, visualAnalysisResult);
    const systemPrompt = ENRICHED_ANALYSIS_SYSTEM_PROMPT;

	const SYSTEM_TOKEN = '{{SYSTEM_PROMPT}}';
	const INPUT_TOKEN = '{{ENRICHED_ANALYSIS_INPUT}}';

	let registryContents: Array<{ role: string; parts: Array<{ text: string }> }> | null = null;
	const promptId = getConfigValue(RC_KEYS.enrichedAnalysisPromptId, RC_DEFAULTS[RC_KEYS.enrichedAnalysisPromptId]).trim();
	if (promptId) {
		try {
			registryContents = await getPromptContents(promptId);
			if (registryContents) {
				functions.logger.info(`Using Prompt Registry prompt ${promptId} for enriched analysis.`);
			}
		} catch (err: any) {
			functions.logger.warn(`Failed to fetch prompt ${promptId} from Prompt Registry. Falling back to inline prompt.`, {
				message: err?.message,
			});
		}
	}

	const promptParts = [
		systemPrompt,
		'\n\n',
		userPrompt,
		'\n\nRespond with JSON only; the response schema is enforced by the request.',
	];

	let replacedSystemPrompt = false;
	let replacedUserPrompt = false;

	const substitutedContents =
		registryContents?.map((message) => ({
			...message,
			parts: message.parts.map((part) => {
				if (!part?.text) return part;
				let text = part.text;
				if (text.includes(SYSTEM_TOKEN)) {
					text = text.split(SYSTEM_TOKEN).join(systemPrompt);
					replacedSystemPrompt = true;
				}
				if (text.includes(INPUT_TOKEN)) {
					text = text.split(INPUT_TOKEN).join(userPrompt);
					replacedUserPrompt = true;
				}
				return { ...part, text };
			}),
		})) || null;

	const contentsAreUsable =
		substitutedContents &&
		substitutedContents.length > 0 &&
		replacedUserPrompt;

    try {
		const { data: jsonData, rawText } = await generateStrictJSON<any>({
			modelKey: modelNameKey,
			opName: 'enrichedAnalysis',
			responseSchema: enrichedAnalysisSchema as any,
			...(contentsAreUsable ? { contents: substitutedContents! } : { promptParts }),
		});
		if (!jsonData) {
			functions.logger.warn(`Enriched analysis for ${familyName} returned no JSON; raw=${rawText ? rawText.slice(0, 120) : 'null'}`);
			return null;
		}

        // Validate result
        const validation = validateAnalysisResult(jsonData);
        if (!validation.isValid) {
            functions.logger.warn(`Enriched analysis validation failed for ${familyName}:`, validation.errors);
            if (validation.errors.length > 0 && !useFallback) {
                // Try fallback model
                functions.logger.info(`Retrying enriched analysis with fallback model for ${familyName}`);
                return await performEnrichedAnalysis(parsedData, visualMetrics, visualAnalysisResult, true);
            }
            if (validation.errors.length > 0) {
                return null; // Critical errors even after fallback
            }
        }
        if (validation.warnings.length > 0) {
            functions.logger.info(`Enriched analysis warnings for ${familyName}:`, validation.warnings);
        }

		// Overall confidence + band derived from style_primary when present
		const c = Number(jsonData?.style_primary?.confidence);
		if (Number.isFinite(c)) {
			const [low, high, veryHigh] = getConfidenceBandThresholds();
			let band: 'low' | 'medium' | 'high' | 'very_high';
			if (c <= low) band = 'low';
			else if (c <= high) band = 'medium';
			else if (c <= veryHigh) band = 'high';
			else band = 'very_high';
			jsonData._confidence = { value: c, band };
		} else {
			jsonData._confidence = { band: 'unknown' };
		}

        functions.logger.info(`Enriched analysis completed for ${familyName}.`);
        return jsonData;

    } catch (error: any) {
        functions.logger.error(`Error in enriched analysis for ${familyName}:`, {
            message: error.message,
            stack: error.stack,
            code: error.code,
            status: error.status,
            details: error.details,
        });
        // Try fallback if not already using it
        if (!useFallback) {
            functions.logger.info(`Retrying enriched analysis with fallback model for ${familyName}`);
            return await performEnrichedAnalysis(parsedData, visualMetrics, visualAnalysisResult, true);
        }
        return null;
    }
}

