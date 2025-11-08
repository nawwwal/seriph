import { GoogleGenAI, HarmCategory, HarmBlockThreshold, GenerationConfig, SafetySetting } from '@google/genai';
import * as functions from 'firebase-functions';
import { ENRICHED_ANALYSIS_SYSTEM_PROMPT } from '../prompts/systemPrompts';
import { buildEnrichedAnalysisPrompt } from '../prompts/promptTemplates';
import { validateAnalysisResult } from './validation';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'seriph';
const LOCATION_ID = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const TARGET_MODEL_NAME = 'gemini-2.5-flash-preview-05-20';
const FALLBACK_MODEL_NAME = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.0-flash-exp';
const WEB_SEARCH_ENABLED = process.env.GEMINI_WEB_SEARCH_ENABLED === 'true';

const genAI = new GoogleGenAI({
    vertexai: true,
    project: PROJECT_ID,
    location: LOCATION_ID,
});

const generationConfig: GenerationConfig = {
    maxOutputTokens: 2048,
    temperature: 0.6,
    topP: 0.9,
    topK: 40,
};

const safetySettings: SafetySetting[] = [{
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
}];

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
    const familyName = parsedData.familyName || 'Unknown Family';
    const modelName = useFallback ? FALLBACK_MODEL_NAME : TARGET_MODEL_NAME;
    functions.logger.info(`Starting enriched analysis for: ${familyName} using ${modelName}${WEB_SEARCH_ENABLED ? ' with web search' : ''}`);

    const userPrompt = buildEnrichedAnalysisPrompt(parsedData, visualMetrics, visualAnalysisResult);
    const systemPrompt = ENRICHED_ANALYSIS_SYSTEM_PROMPT;

    const promptParts = [
        { text: systemPrompt },
        { text: '\n\n' },
        { text: userPrompt },
        { text: '\n\nYour response MUST be a valid JSON object adhering to the following schema:\n' },
        { text: JSON.stringify(enrichedAnalysisSchema, null, 2) },
        { text: '\n\nGenerate ONLY the JSON output, no markdown formatting.' }
    ];

    try {
        // Enable web search via tools if available
        const request: any = {
            model: modelName,
            contents: [{ role: 'user', parts: promptParts }],
            generationConfig: generationConfig,
            safetySettings: safetySettings,
        };

        // Note: Gemini web search is enabled via the model's built-in capabilities
        // If the API supports tools parameter, we can add it here
        // For now, the prompt instructs Gemini to search when needed

        const result = await genAI.models.generateContent(request);

        if (!result || !result.candidates || result.candidates.length === 0) {
            functions.logger.warn(`Enriched analysis for ${familyName} returned no candidates.`);
            return null;
        }

        const candidate = result.candidates[0];
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
            const cleanedJsonString = jsonString.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
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
        });
        // Try fallback if not already using it
        if (!useFallback) {
            functions.logger.info(`Retrying enriched analysis with fallback model for ${familyName}`);
            return await performEnrichedAnalysis(parsedData, visualMetrics, visualAnalysisResult, true);
        }
        return null;
    }
}

