import * as functions from 'firebase-functions';
import { VISUAL_ANALYSIS_SYSTEM_PROMPT } from '../prompts/systemPrompts';
import { buildVisualAnalysisPrompt } from '../prompts/promptTemplates';
import { validateAnalysisResult } from './validation';
import { getGenerativeModelFromRC, isVertexEnabled, logUsageMetadata } from '../vertex/vertexClient';
import { RC_KEYS } from '../../config/rcKeys';

// Schema for visual analysis
const visualAnalysisSchema = {
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
                }
            },
            required: ['value', 'confidence', 'evidence']
        },
        substyle: {
            type: 'object',
            properties: {
                value: { type: 'string' },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
                evidence: {
                    type: 'array',
                    items: { type: 'string' }
                }
            },
            required: ['value', 'confidence', 'evidence']
        },
        moods: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    value: { type: 'string' },
                    confidence: { type: 'number', minimum: 0, maximum: 1 },
                    evidence: {
                        type: 'array',
                        items: { type: 'string' }
                    }
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
        negative_tags: {
            type: 'array',
            items: { type: 'string' }
        }
    },
    required: ['style_primary', 'moods', 'use_cases']
};

export async function performVisualAnalysis(
    parsedData: any,
    visualMetrics?: any
): Promise<any | null> {
    if (!isVertexEnabled()) {
        functions.logger.info(`Vertex AI disabled via RC. Skipping visual analysis.`);
        return null;
    }
    const familyName = parsedData.familyName || 'Unknown Family';
    functions.logger.info(`Starting visual analysis for: ${familyName}`);

    const userPrompt = buildVisualAnalysisPrompt(parsedData, visualMetrics);
    const systemPrompt = VISUAL_ANALYSIS_SYSTEM_PROMPT;

    const promptParts = [
        systemPrompt,
        '\n\n',
        userPrompt,
        '\n\nYour response MUST be a valid JSON object adhering to the following schema:\n',
        JSON.stringify(visualAnalysisSchema, null, 2),
        '\n\nGenerate ONLY the JSON output, no markdown formatting.'
    ];

    try {
        const generativeModel = getGenerativeModelFromRC(RC_KEYS.visualAnalysisModelName);
        const result = await generativeModel.generateContent({
            contents: [{ role: 'user', parts: promptParts.map(text => ({ text })) }],
        });
        logUsageMetadata('visualAnalysis', result?.response);

        const response = result.response;
        if (!response || !response.candidates || response.candidates.length === 0) {
            functions.logger.warn(`Visual analysis for ${familyName} returned no candidates.`);
            return null;
        }

        const candidate = response.candidates[0];
        if (candidate.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
            functions.logger.warn(`Visual analysis for ${familyName} finished with reason: ${candidate.finishReason}`);
            if (candidate.finishReason === 'SAFETY') return null;
        }

        if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0 || !candidate.content.parts[0].text) {
            functions.logger.warn(`Visual analysis for ${familyName} has no text part.`);
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
            functions.logger.error(`Failed to parse JSON from visual analysis for ${familyName}. Error: ${e.message}`, { jsonString });
            return null;
        }

        // Validate result
        const validation = validateAnalysisResult(jsonData);
        if (!validation.isValid) {
            functions.logger.warn(`Visual analysis validation failed for ${familyName}:`, validation.errors);
            if (validation.errors.length > 0) {
                return null; // Critical errors
            }
        }
        if (validation.warnings.length > 0) {
            functions.logger.info(`Visual analysis warnings for ${familyName}:`, validation.warnings);
        }

        functions.logger.info(`Visual analysis completed for ${familyName}.`);
        return jsonData;

    } catch (error: any) {
        functions.logger.error(`Error in visual analysis for ${familyName}:`, {
            message: error.message,
            stack: error.stack,
            code: error.code,
            status: error.status,
            details: error.details,
        });
        return null;
    }
}

