import * as functions from 'firebase-functions';
import { ENRICHED_ANALYSIS_SYSTEM_PROMPT } from '../prompts/systemPrompts';
import { buildEnrichedAnalysisPrompt } from '../prompts/promptTemplates';
import { validateAnalysisResult } from './validation';
import { getConfigValue, getConfigBoolean } from '../../config/remoteConfig';
import { RC_KEYS, RC_DEFAULTS } from '../../config/rcKeys';
import { generateStrictJSON, isVertexEnabled } from '../vertex/vertexClient';
import { getConfidenceBandThresholds } from '../../config/remoteConfig';
import { STYLE_PRIMARY, SUBSTYLE, MOODS, USE_CASES } from '../../models/contracts';

const WEB_SEARCH_ENABLED = getConfigBoolean(RC_KEYS.webEnrichmentEnabled, false);

// Schema for enriched analysis (includes web-sourced fields)
const enrichedAnalysisSchema = {
    type: 'object',
    properties: {
		style_primary: {
			type: 'object',
			properties: {
				value: {
					type: 'string',
					enum: [...STYLE_PRIMARY],
				},
				confidence: { type: 'number', minimum: 0, maximum: 1 },
				evidence_keys: {
					type: 'array',
					items: { type: 'string' },
				},
				sources: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							source_type: { type: 'string', enum: ['extracted', 'web', 'inferred'] },
							source_ref: { type: 'string' },
							confidence: { type: 'number' },
						},
					},
				},
			},
			required: ['value', 'confidence'],
		},
		substyle: {
			type: 'object',
			properties: {
				value: { type: 'string', enum: [...SUBSTYLE] },
				confidence: { type: 'number', minimum: 0, maximum: 1 },
				evidence_keys: { type: 'array', items: { type: 'string' } },
				sources: { type: 'array', items: { type: 'object' } },
			},
		},
		moods: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					value: { type: 'string', enum: [...MOODS] },
					confidence: { type: 'number', minimum: 0, maximum: 1 },
					evidence_keys: { type: 'array', items: { type: 'string' } },
					sources: { type: 'array', items: { type: 'object' } },
				},
				required: ['value', 'confidence'],
			},
		},
		use_cases: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					value: { type: 'string', enum: [...USE_CASES] },
					confidence: { type: 'number', minimum: 0, maximum: 1 },
				},
				required: ['value', 'confidence'],
			},
		},
        people: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    role: { type: 'string', enum: ['designer', 'foundry', 'contributor'] },
                    name: { type: 'string' },
                    source: { type: 'string', enum: ['extracted', 'web'] },
                    confidence: { type: 'number', minimum: 0, maximum: 1 },
                    source_url: { type: 'string' }
                },
                required: ['role', 'name', 'source', 'confidence']
            }
        },
        historical_context: {
            type: 'object',
            properties: {
                period: { type: 'string' },
                cultural_influence: { type: 'array', items: { type: 'string' } },
                notable_usage: { type: 'array', items: { type: 'string' } }
            }
        },
        negative_tags: {
            type: 'array',
            items: { type: 'string' }
        }
    },
    required: ['style_primary', 'moods', 'use_cases']
};

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
    const familyName = parsedData.familyName || 'Unknown Family';
    const modelNameKey = useFallback ? RC_KEYS.enrichedAnalysisFallbackModelName : RC_KEYS.enrichedAnalysisModelName;
    functions.logger.info(`Starting enriched analysis for: ${familyName} (${useFallback ? 'fallback' : 'primary'})${WEB_SEARCH_ENABLED ? ' with web search' : ''}`);

    const userPrompt = buildEnrichedAnalysisPrompt(parsedData, visualMetrics, visualAnalysisResult);
    const systemPrompt = ENRICHED_ANALYSIS_SYSTEM_PROMPT;

    const promptParts = [
        systemPrompt,
        '\n\n',
        userPrompt,
        '\n\nYour response MUST be a valid JSON object adhering to the following schema:\n',
        JSON.stringify(enrichedAnalysisSchema, null, 2),
        '\n\nGenerate ONLY the JSON output, no markdown formatting.'
    ];

    try {
		const tools = WEB_SEARCH_ENABLED ? [{ googleSearchRetrieval: {} as any }] : undefined;
		const { data: jsonData, rawText } = await generateStrictJSON<any>({
			modelKey: modelNameKey,
			promptParts,
			opName: 'enrichedAnalysis',
			tools,
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

