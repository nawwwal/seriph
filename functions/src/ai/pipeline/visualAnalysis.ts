import { GoogleGenAI, HarmCategory, HarmBlockThreshold, GenerationConfig, SafetySetting } from '@google/genai';
import * as functions from 'firebase-functions';
import { VISUAL_ANALYSIS_SYSTEM_PROMPT } from '../prompts/systemPrompts';
import { buildVisualAnalysisPrompt } from '../prompts/promptTemplates';
import { validateAnalysisResult } from './validation';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'seriph';
const LOCATION_ID = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const TARGET_MODEL_NAME = 'gemini-2.5-flash-preview-05-20';

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
    const familyName = parsedData.familyName || 'Unknown Family';
    functions.logger.info(`Starting visual analysis for: ${familyName}`);

    const userPrompt = buildVisualAnalysisPrompt(parsedData, visualMetrics);
    const systemPrompt = VISUAL_ANALYSIS_SYSTEM_PROMPT;

    const promptParts = [
        { text: systemPrompt },
        { text: '\n\n' },
        { text: userPrompt },
        { text: '\n\nYour response MUST be a valid JSON object adhering to the following schema:\n' },
        { text: JSON.stringify(visualAnalysisSchema, null, 2) },
        { text: '\n\nGenerate ONLY the JSON output, no markdown formatting.' }
    ];

    try {
        const request = {
            model: TARGET_MODEL_NAME,
            contents: [{ role: 'user', parts: promptParts }],
            generationConfig: generationConfig,
            safetySettings: safetySettings,
        };

        const result = await genAI.models.generateContent(request);

        if (!result || !result.candidates || result.candidates.length === 0) {
            functions.logger.warn(`Visual analysis for ${familyName} returned no candidates.`);
            return null;
        }

        const candidate = result.candidates[0];
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
            const cleanedJsonString = jsonString.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
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
        });
        return null;
    }
}

