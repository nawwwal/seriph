import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai'; // Updated import
import { CLASSIFICATION_VALUES, Classification, FamilyMetadata } from '../models/font.models'; // Adjust path as needed
import * as functions from 'firebase-functions';

const PROJECT_ID = 'seriph';
const LOCATION_ID = 'us-central1'; // Vertex AI region
const MODEL_ID = 'gemini-2.5-pro-preview-05-06'; // Your chosen Gemini model

// Initialize the Vertex AI client for generative models
const vertex_ai = new VertexAI({ project: PROJECT_ID, location: LOCATION_ID });

const generativeModel = vertex_ai.getGenerativeModel({
    model: MODEL_ID,
    // Optional: Add safety settings and generation config if needed
    safetySettings: [{
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
    }],
    generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.6,
        topP: 0.9,
        topK: 40,
    },
});

// Define the schema for the full analysis (similar to before)
// This is for our internal reference and to structure the prompt,
// as the direct Node.js client doesn't enforce responseSchema like firebase-admin/ai.
// We will ask the model to return JSON in this structure.
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
    metadata: Partial<FamilyMetadata>; // Using FamilyMetadata for the 'metadata' part of the result
}

/**
 * Performs a comprehensive AI analysis of a font family using Vertex AI Gemini model.
 * @param parsedFontData The full data extracted by the font parser.
 * @returns A promise that resolves to the analysis result or null.
 */
export async function getFontAnalysisVertexAI(
    parsedFontData: any // Data from serverParseFontFile
): Promise<VertexAIFullFontAnalysisResult | null> {
    const familyName = parsedFontData.familyName || 'Unknown Family';
    functions.logger.info(`Starting Vertex AI (Gemini) analysis for font family: ${familyName}`);

    // Construct a detailed prompt using all available parsed font data
    let promptParts = [
        `Analyze the font family named "${familyName}".`,
        `Parsed font details are as follows:`,
        `Subfamily: ${parsedFontData.subfamilyName || 'N/A'}`,
        `PostScript Name: ${parsedFontData.postScriptName || 'N/A'}`,
        `Version: ${parsedFontData.version || 'N/A'}`,
        `Copyright: ${parsedFontData.copyright || 'N/A'}`,
        `Trademark: ${parsedFontData.trademark || 'N/A'}`,
        `Format: ${parsedFontData.format || 'N/A'}`,
        `Foundry (if known from parser): ${parsedFontData.foundry || 'N/A'}`,
        `Weight (if known): ${parsedFontData.weight || 'N/A'}`,
        `Style (if known): ${parsedFontData.style || 'N/A'}`,
        `Is Variable: ${parsedFontData.isVariable ? 'Yes' : 'No'}`,
    ];

    if (parsedFontData.isVariable && parsedFontData.variableAxes && parsedFontData.variableAxes.length > 0) {
        promptParts.push('Variable Axes:');
        parsedFontData.variableAxes.forEach((axis: any) => {
            promptParts.push(`  - Tag: ${axis.tag}, Name: ${axis.name}, Min: ${axis.minValue}, Max: ${axis.maxValue}, Default: ${axis.defaultValue}`);
        });
    }
    // Add more parsed details as available and relevant, e.g., OpenType features, glyph count.
    // For brevity, I'm not listing every single possible field from your spec, but you should include them.
    // Example: promptParts.push(`OpenType Features: ${parsedFontData.openTypeFeatures?.join(', ') || 'N/A'}`);

    promptParts.push('\nProvide a comprehensive analysis. Your response MUST be a valid JSON object adhering to the following structure (do NOT include any text before or after the JSON object, including markdown backticks for the JSON block):\n');
    promptParts.push(JSON.stringify(vertexAISchema, null, 2)); // Include the schema in the prompt
    promptParts.push('\nBased on the provided font details and the schema, generate ONLY the JSON output.');

    const fullPrompt = promptParts.join('\n');
    functions.logger.info(`Vertex AI (Gemini) Prompt for ${familyName} (first 500 chars): ${fullPrompt.substring(0, 500)}...`);

    try {
        const result = await generativeModel.generateContent({contents: [{role: 'user', parts: [{text: fullPrompt}]}]});

        if (!result.response || !result.response.candidates || result.response.candidates.length === 0) {
            functions.logger.warn(`Vertex AI (Gemini) analysis for ${familyName} returned no candidates or an unexpected response structure.`, { response: result.response });
            return null;
        }

        const candidate = result.response.candidates[0];
        if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0 || !candidate.content.parts[0].text) {
            functions.logger.warn(`Vertex AI (Gemini) prediction for ${familyName} has no text part in the candidate.`, { candidate });
            return null;
        }

        const jsonString = candidate.content.parts[0].text.trim();
        functions.logger.info(`Raw JSON string from Vertex AI (Gemini) for ${familyName} (first 500 chars): ${jsonString.substring(0, 500)}...`);

        let jsonData: any;
        try {
            // Attempt to parse the JSON string. Gemini might sometimes include backticks or "json" prefix.
            const cleanedJsonString = jsonString.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
            jsonData = JSON.parse(cleanedJsonString);
        } catch (e: any) {
            functions.logger.error(`Failed to parse JSON response from Vertex AI (Gemini) for ${familyName}. Error: ${e.message}`, { rawResponse: jsonString });
            return null;
        }

        if (!jsonData || !jsonData.description || !jsonData.tags || !jsonData.classification) {
            functions.logger.warn(`Vertex AI (Gemini) analysis for ${familyName} missing core fields in parsed JSON.`, { parsedJson: jsonData });
            return null;
        }

        if (!CLASSIFICATION_VALUES.includes(jsonData.classification as Classification)) {
            functions.logger.warn(`Vertex AI (Gemini) analysis for ${familyName} returned invalid classification: ${jsonData.classification}`);
            return null;
        }

        functions.logger.info(`Successfully parsed Vertex AI (Gemini) analysis for ${familyName}.`);
        return {
            description: jsonData.description,
            tags: jsonData.tags,
            classification: jsonData.classification as Classification,
            metadata: { // Map the AI output to your FamilyMetadata structure
                subClassification: jsonData.subClassification === null ? undefined : jsonData.subClassification,
                moods: jsonData.moods,
                useCases: jsonData.useCases,
                technicalCharacteristics: jsonData.technicalCharacteristics,
                // Note: 'foundry' is not directly in this AI schema, it comes from the parser.
            },
        };

    } catch (error: any) {
        functions.logger.error(`Error calling Vertex AI (Gemini) for ${familyName}:`, {
            message: error.message,
            stack: error.stack,
            details: error.details || error, // Some GCP errors have a details field
        });
        return null;
    }
}
