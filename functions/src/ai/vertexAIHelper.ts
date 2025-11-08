import { GoogleGenAI, HarmCategory, HarmBlockThreshold, GenerationConfig, SafetySetting } from '@google/genai';
import { CLASSIFICATION_VALUES, Classification, FamilyMetadata } from '../models/font.models';
import * as functions from 'firebase-functions';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'seriph';
const LOCATION_ID = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
// Ensure GOOGLE_GENAI_USE_VERTEXAI=True is set in the function's environment variables for this to target Vertex.

const TARGET_MODEL_NAME = 'gemini-2.5-flash-preview-05-20'; // Your chosen Gemini model

// Initialize the GoogleGenAI client
const genAI = new GoogleGenAI({
    vertexai: true,
    project: PROJECT_ID,
    location: LOCATION_ID,
});

// Define shared generation config and safety settings
const generationConfig: GenerationConfig = {
    maxOutputTokens: 2048,
    temperature: 0.6,
    topP: 0.9,
    topK: 40,
    // responseMimeType: "application/json", // If you find this is supported for @google/genai
};

const safetySettings: SafetySetting[] = [{
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
}];

// Schema for AI analysis (remains the same)
export const vertexAISchema = {
    type: 'object',
    properties: {
        description: { type: 'string', description: "A concise and appealing marketing description (1-2 sentences, max 40-50 words)." },
        tags: {
            type: 'array',
            items: { type: 'string', description: "A relevant tag." },
            description: "An array of 5-7 relevant and diverse tags covering style, use-case, and visual characteristics."
        },
        classification: {
            type: 'string',
            enum: CLASSIFICATION_VALUES,
            description: "The primary design classification."
        },
        subClassification: { type: 'string', description: "A more specific sub-classification (e.g., Old Style, Geometric, Grotesque). Optional, provide null if not applicable." },
        moods: {
            type: 'array',
            items: { type: 'string', description: "A mood descriptor." },
            description: "An array of 3-5 mood descriptors (e.g., elegant, modern, playful)."
        },
        useCases: {
            type: 'array',
            items: { type: 'string', description: "A recommended use case." },
            description: "An array of recommended use cases (e.g., headings, body text, branding)."
        },
        technicalCharacteristics: {
            type: 'array',
            items: { type: 'string', description: "A technical characteristic." },
            description: "An array of notable technical characteristics (e.g., highly legible, web-optimized). Optional."
        }
    },
    required: ['description', 'tags', 'classification', 'moods', 'useCases']
};

export interface VertexAIFullFontAnalysisResult {
    description: string;
    tags: string[];
    classification: Classification;
    metadata: Partial<FamilyMetadata>;
}

/**
 * Legacy function - maintained for backward compatibility
 * New code should use the pipeline from ai/pipeline/fontPipeline.ts
 */
export async function getFontAnalysisVertexAI(
    parsedFontData: any
): Promise<VertexAIFullFontAnalysisResult | null> {
    const familyName = parsedFontData.familyName || 'Unknown Family';
    functions.logger.info(`Starting AI analysis for font family: ${familyName} using @google/genai (Vertex AI mode)`);

    let promptPartsForModel = [
        { text: `Analyze the font family named "${familyName}".` },
        { text: `Parsed font details are as follows:` },
        { text: `Subfamily: ${parsedFontData.subfamilyName || 'N/A'}` },
        { text: `PostScript Name: ${parsedFontData.postScriptName || 'N/A'}` },
        { text: `Version: ${parsedFontData.version || 'N/A'}` },
        { text: `Copyright: ${parsedFontData.copyright || 'N/A'}` },
        { text: `Trademark: ${parsedFontData.trademark || 'N/A'}` },
        { text: `Format: ${parsedFontData.format || 'N/A'}` },
        { text: `Foundry (if known from parser): ${parsedFontData.foundry || 'N/A'}` },
        { text: `Weight (if known): ${parsedFontData.weight || 'N/A'}` },
        { text: `Style (if known): ${parsedFontData.style || 'N/A'}` },
        { text: `Is Variable: ${parsedFontData.isVariable ? 'Yes' : 'No'}` },
    ];

    if (parsedFontData.isVariable && parsedFontData.variableAxes && parsedFontData.variableAxes.length > 0) {
        promptPartsForModel.push({ text: 'Variable Axes:' });
        parsedFontData.variableAxes.forEach((axis: any) => {
            promptPartsForModel.push({ text: `  - Tag: ${axis.tag}, Name: ${axis.name}, Min: ${axis.minValue}, Max: ${axis.maxValue}, Default: ${axis.defaultValue}` });
        });
    }

    promptPartsForModel.push({ text: '\nProvide a comprehensive analysis. Your response MUST be a valid JSON object adhering to the following structure (do NOT include any text before or after the JSON object, including markdown backticks for the JSON block):\n' });
    promptPartsForModel.push({ text: JSON.stringify(vertexAISchema, null, 2) });
    promptPartsForModel.push({ text: '\nBased on the provided font details and the schema, generate ONLY the JSON output.' });

    const fullPromptForLogging = promptPartsForModel.map(p => p.text).join('\n');
    functions.logger.info(`@google/genai Prompt for ${familyName} (first 500 chars): ${fullPromptForLogging.substring(0, 500)}...`);

    try {
        const request = {
            model: TARGET_MODEL_NAME,
            contents: [{ role: 'user', parts: promptPartsForModel }],
            generationConfig: generationConfig,
            safetySettings: safetySettings,
        };

        const result = await genAI.models.generateContent(request);

        if (!result || !result.candidates || result.candidates.length === 0) {
            functions.logger.warn(`@google/genai analysis for ${familyName} returned no candidates.`, { result });
            return null;
        }

        const candidate = result.candidates[0];
        if (candidate.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
             functions.logger.warn(`@google/genai analysis for ${familyName} finished with reason: ${candidate.finishReason}`, { candidate });
             if (candidate.finishReason === 'SAFETY') return null;
        }

        if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0 || !candidate.content.parts[0].text) {
            functions.logger.warn(`@google/genai prediction for ${familyName} has no text part.`, { candidate });
            return null;
        }

        const jsonString = candidate.content.parts[0].text.trim();
        functions.logger.info(`Raw JSON from @google/genai for ${familyName} (first 500): ${jsonString.substring(0, 500)}...`);

        let jsonData: any;
        try {
            const cleanedJsonString = jsonString.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
            jsonData = JSON.parse(cleanedJsonString);
        } catch (e: any) {
            functions.logger.error(`Failed to parse JSON from @google/genai for ${familyName}. Error: ${e.message}`, { jsonString });
            return null;
        }

        if (!jsonData || !jsonData.description || !jsonData.tags || !jsonData.classification) {
            functions.logger.warn(`@google/genai analysis for ${familyName} missing core fields.`, { jsonData });
            return null;
        }

        if (!CLASSIFICATION_VALUES.includes(jsonData.classification as Classification)) {
            functions.logger.warn(`@google/genai analysis for ${familyName} invalid classification: ${jsonData.classification}`);
            return null;
        }

        functions.logger.info(`Successfully parsed @google/genai analysis for ${familyName}.`);
        return {
            description: jsonData.description,
            tags: jsonData.tags,
            classification: jsonData.classification as Classification,
            metadata: {
                subClassification: jsonData.subClassification === null ? undefined : jsonData.subClassification,
                moods: jsonData.moods,
                useCases: jsonData.useCases,
                technicalCharacteristics: jsonData.technicalCharacteristics,
            },
        };

    } catch (error: any) {
        functions.logger.error(`Error calling @google/genai for ${familyName}:`, {
            message: error.message,
            stack: error.stack,
            details: error.details || error,
        });
        return null;
    }
}
