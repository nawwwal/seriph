import * as functions from 'firebase-functions';
import { ENRICHED_ANALYSIS_SYSTEM_PROMPT } from '../prompts/systemPrompts';
import { buildEnrichedAnalysisPrompt } from '../prompts/promptTemplates';
import { validateAnalysisResult } from './validation';
import { getConfigValue, getConfigBoolean } from '../../config/remoteConfig';
import { RC_KEYS, RC_DEFAULTS } from '../../config/rcKeys';
import { getGenerativeModelFromRC, isVertexEnabled, logUsageMetadata } from '../vertex/vertexClient';

const WEB_SEARCH_ENABLED = getConfigBoolean(RC_KEYS.webEnrichmentEnabled, RC_DEFAULTS[RC_KEYS.webEnrichmentEnabled] === 'true');

const getGenerativeModel = (modelNameKey: string) => getGenerativeModelFromRC(modelNameKey);

// Schema for enriched analysis (includes web-sourced fields)
const enrichedAnalysisSchema = {
    type: 'object',
    properties: {
        style_primary: {
            type: 'object',
            properties: {
                value: {
                    type: 'string',
                    enum: ['Serif', 'Sans Serif', 'Script & Handwriting', 'Monospace', 'Display & Decorative', 'Symbol & Icon']
                },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
                evidence: {
                    type: 'array',
                    items: { type: 'string' }
                },
                sources: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            source_type: { type: 'string', enum: ['extracted', 'web', 'inferred'] },
                            source_ref: { type: 'string' },
                            confidence: { type: 'number' }
                        }
                    }
                }
            },
            required: ['value', 'confidence', 'evidence']
        },
        substyle: {
            type: 'object',
            properties: {
                value: { type: 'string' },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
                evidence: { type: 'array', items: { type: 'string' } },
                sources: { type: 'array', items: { type: 'object' } }
            }
        },
        moods: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    value: { type: 'string' },
                    confidence: { type: 'number', minimum: 0, maximum: 1 },
                    evidence: { type: 'array', items: { type: 'string' } },
                    sources: { type: 'array', items: { type: 'object' } }
                },
                required: ['value', 'confidence', 'evidence']
            }
        },
        use_cases: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    value: { type: 'string' },
                    confidence: { type: 'number', minimum: 0, maximum: 1 }
                },
                required: ['value', 'confidence']
            }
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
        // Enable web search via tools if available
        const generativeModel = getGenerativeModel(modelNameKey);

        const result = await generativeModel.generateContent({
            contents: [{ role: 'user', parts: promptParts.map(text => ({ text })) }],
            // Enable Google Search grounding when allowed (optional; default off)
            ...(WEB_SEARCH_ENABLED ? { tools: [{ googleSearchRetrieval: {} as any }] } : {}),
        });
        logUsageMetadata('enrichedAnalysis', result?.response);

        const response = result.response;
        if (!response || !response.candidates || response.candidates.length === 0) {
            functions.logger.warn(`Enriched analysis for ${familyName} returned no candidates.`);
            return null;
        }

        const candidate = response.candidates[0];
        if (candidate.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
            functions.logger.warn(`Enriched analysis for ${familyName} finished with reason: ${candidate.finishReason}`);
            if (candidate.finishReason === 'SAFETY') return null;
        }

        if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0 || !candidate.content.parts[0].text) {
            functions.logger.warn(`Enriched analysis for ${familyName} has no text part.`);
            return null;
        }

        const jsonString = candidate.content.parts[0].text.trim();
        let jsonData: any;
        try {
            // With responseMimeType: "application/json", the response should be valid JSON
            // Still clean markdown code blocks if present (for backward compatibility)
            const cleanedJsonString = jsonString.replace(/^```json\n?/, '').replace(/\n?```$/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim();
            jsonData = JSON.parse(cleanedJsonString);
        } catch (e: any) {
            functions.logger.error(`Failed to parse JSON from enriched analysis for ${familyName}. Error: ${e.message}`, { jsonString });
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

