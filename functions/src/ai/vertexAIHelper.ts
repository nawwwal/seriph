import { PredictionServiceClient, helpers } from '@google-cloud/aiplatform';
import { CLASSIFICATION_VALUES, Classification, FamilyMetadata } from '../models/font.models'; // Adjust path as needed
import * as functions from 'firebase-functions';

const PROJECT_ID = 'seriph';
const LOCATION_ID = 'us-central1'; // Vertex AI region
const PUBLISHER_MODEL = 'google'; // For official Google models like Gemini
const MODEL_ID = 'gemini-2.5-pro-preview-05-06'; // Your chosen Gemini model

// Initialize the Vertex AI Prediction Service Client
// This client will use Application Default Credentials (ADC)
// when running in a GCP environment like Cloud Functions.
const predictionServiceClient = new PredictionServiceClient({
  apiEndpoint: `${LOCATION_ID}-aiplatform.googleapis.com`,
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
    functions.logger.info(`Starting Vertex AI analysis for font family: ${familyName}`);

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

    promptParts.push('\\nProvide a comprehensive analysis. Your response MUST be a valid JSON object adhering to the following structure (do NOT include any text before or after the JSON object):');
    promptParts.push(JSON.stringify(vertexAISchema, null, 2)); // Include the schema in the prompt
    promptParts.push('\\nBased on the provided font details and the schema, generate the JSON output.');

    const fullPrompt = promptParts.join('\\n');
    functions.logger.info(`Vertex AI Prompt for ${familyName} (first 500 chars): ${fullPrompt.substring(0, 500)}...`);

    const endpoint = `projects/${PROJECT_ID}/locations/${LOCATION_ID}/publishers/${PUBLISHER_MODEL}/models/${MODEL_ID}`;

    // Construct the request payload for the Vertex AI SDK
    // The instance format for Gemini (non-multimodal text) is typically a Content object.
    const instance = helpers.toValue({
        content: {
            role: 'user', // Or omit role for single turn
            parts: [{ text: fullPrompt }]
        }
    });
    const instances = [instance!]; // instance can be null if conversion fails, hence the non-null assertion

    const parameter = {
        temperature: 0.6,
        maxOutputTokens: 2048, // Adjust as needed, ensure it's enough for the JSON
        topP: 0.9,
        topK: 40,
        // Instruct the model to output JSON. For some models, this helps.
        // For Gemini, the primary way is to ask for JSON in the prompt itself.
        // "responseMimeType": "application/json" is not a direct parameter here,
        // but asking for JSON in the prompt is key.
    };
    const parameters = helpers.toValue(parameter);

    const request = {
        endpoint,
        instances,
        parameters,
    };

    try {
        const [response] = await predictionServiceClient.predict(request);
        if (!response.predictions || response.predictions.length === 0) {
            functions.logger.warn(`Vertex AI analysis for ${familyName} returned no predictions.`);
            return null;
        }

        const prediction = response.predictions[0];
        // The prediction structure for Gemini on Vertex AI (non-streaming text)
        // usually has the content under `content.parts[0].text`.
        // We need to convert the Struct to a JavaScript object.
        const predictionResultObj = helpers.fromValue(prediction as protobuf.common.IValue) as any;

        if (!predictionResultObj || !predictionResultObj.content || !predictionResultObj.content.parts || !predictionResultObj.content.parts[0].text) {
             functions.logger.warn(`Vertex AI prediction for ${familyName} has an unexpected structure or no text part.`, { predictionResultObj });
            return null;
        }

        const jsonString = predictionResultObj.content.parts[0].text.trim();
        functions.logger.info(`Raw JSON string from Vertex AI for ${familyName} (first 500 chars): ${jsonString.substring(0, 500)}...`);

        let jsonData: any;
        try {
            // Attempt to parse the JSON string. Gemini might sometimes include backticks or "json" prefix.
            const cleanedJsonString = jsonString.replace(/^```json\\n/, '').replace(/\\n```$/, '').trim();
            jsonData = JSON.parse(cleanedJsonString);
        } catch (e: any) {
            functions.logger.error(`Failed to parse JSON response from Vertex AI for ${familyName}. Error: ${e.message}`, { rawResponse: jsonString });
            return null;
        }

        if (!jsonData || !jsonData.description || !jsonData.tags || !jsonData.classification) {
            functions.logger.warn(`Vertex AI analysis for ${familyName} missing core fields in parsed JSON.`, { parsedJson: jsonData });
            return null;
        }

        if (!CLASSIFICATION_VALUES.includes(jsonData.classification as Classification)) {
            functions.logger.warn(`Vertex AI analysis for ${familyName} returned invalid classification: ${jsonData.classification}`);
            return null;
        }

        functions.logger.info(`Successfully parsed Vertex AI analysis for ${familyName}.`);
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
        functions.logger.error(`Error calling Vertex AI for ${familyName}:`, {
            message: error.message,
            stack: error.stack,
            details: error.details || error, // Some GCP errors have a details field
        });
        return null;
    }
}
