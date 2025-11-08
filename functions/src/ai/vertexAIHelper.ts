import { CLASSIFICATION_VALUES, Classification, FamilyMetadata } from '../models/font.models';
import * as functions from 'firebase-functions';
import { getGenerativeModelFromRC, isVertexEnabled, logUsageMetadata } from './vertex/vertexClient';
import { RC_KEYS } from '../config/rcKeys';

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
    if (!isVertexEnabled()) {
        functions.logger.info(`Vertex AI disabled via RC. Skipping legacy analysis.`);
        return null;
    }
    const familyName = parsedFontData.familyName || 'Unknown Family';
    functions.logger.info(`Starting AI analysis for font family: ${familyName} using @google-cloud/vertexai`);

    let promptPartsForModel = [
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
        promptPartsForModel.push('Variable Axes:');
        parsedFontData.variableAxes.forEach((axis: any) => {
            promptPartsForModel.push(`  - Tag: ${axis.tag}, Name: ${axis.name}, Min: ${axis.minValue}, Max: ${axis.maxValue}, Default: ${axis.defaultValue}`);
        });
    }

    promptPartsForModel.push('\nProvide a comprehensive analysis. Your response MUST be a valid JSON object adhering to the following structure (do NOT include any text before or after the JSON object, including markdown backticks for the JSON block):\n');
    promptPartsForModel.push(JSON.stringify(vertexAISchema, null, 2));
    promptPartsForModel.push('\nBased on the provided font details and the schema, generate ONLY the JSON output.');

    const fullPromptForLogging = promptPartsForModel.join('\n');
    functions.logger.info(`@google-cloud/vertexai Prompt for ${familyName} (first 500 chars): ${fullPromptForLogging.substring(0, 500)}...`);

    try {
        const generativeModel = getGenerativeModelFromRC(RC_KEYS.classifierModelName);
        const result = await generativeModel.generateContent({
            contents: [{ role: 'user', parts: promptPartsForModel.map(text => ({ text })) }],
        });
        logUsageMetadata('legacyClassifier', result?.response);

        const response = result.response;
        if (!response || !response.candidates || response.candidates.length === 0) {
            functions.logger.warn(`@google-cloud/vertexai analysis for ${familyName} returned no candidates.`, { response });
            return null;
        }

        const candidate = response.candidates[0];
        if (candidate.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
             functions.logger.warn(`@google-cloud/vertexai analysis for ${familyName} finished with reason: ${candidate.finishReason}`, { candidate });
             if (candidate.finishReason === 'SAFETY') return null;
        }

        if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0 || !candidate.content.parts[0].text) {
            functions.logger.warn(`@google-cloud/vertexai prediction for ${familyName} has no text part.`, { candidate });
            return null;
        }

        const jsonString = candidate.content.parts[0].text.trim();
        functions.logger.info(`Raw JSON from @google-cloud/vertexai for ${familyName} (first 500): ${jsonString.substring(0, 500)}...`);

        let jsonData: any;
        try {
            // With responseMimeType: "application/json", the response should be valid JSON
            // Still clean markdown code blocks if present (for backward compatibility)
            const cleanedJsonString = jsonString.replace(/^```json\n?/, '').replace(/\n?```$/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim();
            jsonData = JSON.parse(cleanedJsonString);
        } catch (e: any) {
            functions.logger.error(`Failed to parse JSON from @google-cloud/vertexai for ${familyName}. Error: ${e.message}`, { jsonString });
            return null;
        }

        if (!jsonData || !jsonData.description || !jsonData.tags || !jsonData.classification) {
            functions.logger.warn(`@google-cloud/vertexai analysis for ${familyName} missing core fields.`, { jsonData });
            return null;
        }

        if (!CLASSIFICATION_VALUES.includes(jsonData.classification as Classification)) {
            functions.logger.warn(`@google-cloud/vertexai analysis for ${familyName} invalid classification: ${jsonData.classification}`);
            return null;
        }

        functions.logger.info(`Successfully parsed @google-cloud/vertexai analysis for ${familyName}.`);
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
        functions.logger.error(`Error calling @google-cloud/vertexai for ${familyName}:`, {
            message: error.message,
            stack: error.stack,
            code: error.code,
            status: error.status,
            details: error.details || error,
        });
        return null;
    }
}
