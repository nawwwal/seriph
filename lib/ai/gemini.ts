import { GenerativeModel, GoogleAIBackend, getAI, getGenerativeModel, Schema } from "firebase/ai";
import { app } from "@/lib/firebase/config"; // Import the initialized app
import { CLASSIFICATION_VALUES, Classification, FamilyMetadata } from "@/models/font.models"; // Import Classification type/values & FamilyMetadata

const MODEL_NAME = "gemini-2.5-flash-preview-04-17";

// Initialize the Gemini Developer API backend service
const ai = getAI(app, { backend: new GoogleAIBackend() });

// --- Model for Font Description (JSON output) ---
const descriptionSchema = Schema.object({
    properties: {
        description: Schema.string({ description: "The font family description." })
    }
});
const descriptionModel: GenerativeModel = getGenerativeModel(ai, {
    model: MODEL_NAME,
    generationConfig: {
        responseMimeType: "application/json",
        responseSchema: descriptionSchema,
    },
});

// --- Model for Font Tags (JSON output) ---
const tagsSchema = Schema.object({
    properties: {
        tags: Schema.array({
            items: Schema.string({ description: "A relevant tag for the font family." }),
            description: "An array of 5-7 relevant tags."
        })
    }
});
const tagsModel: GenerativeModel = getGenerativeModel(ai, {
    model: MODEL_NAME,
    generationConfig: {
        responseMimeType: "application/json",
        responseSchema: tagsSchema,
    },
});

// --- Model for Font Classification (Enum output) ---
const classificationEnumSchema = Schema.enumString({
    enum: CLASSIFICATION_VALUES
});
const classificationModel: GenerativeModel = getGenerativeModel(ai, {
    model: MODEL_NAME,
    generationConfig: {
        responseMimeType: "text/x.enum", // Using text/x.enum for direct enum string output
        responseSchema: classificationEnumSchema,
    },
});

// --- Model for Comprehensive Font Analysis (JSON output) ---
const fullAnalysisSchema = Schema.object({
    properties: {
        description: Schema.string({ description: "A concise and appealing marketing description (1-2 sentences, max 40-50 words)." }),
        tags: Schema.array({
            items: Schema.string({ description: "A relevant tag." }),
            description: "An array of 5-7 relevant and diverse tags covering style, use-case, and visual characteristics."
        }),
        classification: Schema.enumString({
            enum: CLASSIFICATION_VALUES,
            description: "The primary design classification."
        }),
        subClassification: Schema.string({ description: "A more specific sub-classification (e.g., Old Style, Geometric, Grotesque). Optional." }),
        moods: Schema.array({
            items: Schema.string({ description: "A mood descriptor." }),
            description: "An array of 3-5 mood descriptors (e.g., elegant, modern, playful)."
        }),
        useCases: Schema.array({
            items: Schema.string({ description: "A recommended use case." }),
            description: "An array of recommended use cases (e.g., headings, body text, branding)."
        }),
        // similarFamilies: Schema.array({ // Let's keep this simpler for now, as suggesting specific family names can be noisy
        //     items: Schema.string({ description: "Name of a similar font family." }),
        //     description: "An array of 1-3 similar font family names. Optional."
        // }),
        technicalCharacteristics: Schema.array({
            items: Schema.string({ description: "A technical characteristic." }),
            description: "An array of notable technical characteristics (e.g., highly legible, web-optimized). Optional."
        })
    }
});

const fullAnalysisModel: GenerativeModel = getGenerativeModel(ai, {
    model: MODEL_NAME,
    generationConfig: {
        responseMimeType: "application/json",
        responseSchema: fullAnalysisSchema,
    },
});

export interface FullFontAnalysisResult {
    description: string;
    tags: string[];
    classification: Classification;
    metadata: Partial<FamilyMetadata>; // Use Partial as not all fields are guaranteed from AI
}

/**
 * Generates a descriptive text for a font family using the Gemini API.
 * @param familyName The name of the font family.
 * @param existingDescription An optional existing description to provide context or guide refinement.
 * @param style The primary style of the font (e.g., Serif, Sans Serif, Script).
 * @param characteristics Optional array of notable characteristics (e.g., "geometric", "humanist", "elegant", "modern").
 * @returns A promise that resolves to the generated description string or null if an error occurs.
 */
export async function generateFontDescription(
    familyName: string,
    existingDescription?: string,
    style?: string,
    characteristics?: string[]
): Promise<string | null> {
    try {
        let userPrompt = `Generate a concise and appealing marketing description (1-2 sentences, max 40-50 words) for a font family named "${familyName}".`;
        if (style) userPrompt += ` It is a ${style} font.`;
        if (characteristics && characteristics.length > 0) userPrompt += ` Key characteristics include: ${characteristics.join(", ")}.`;
        if (existingDescription) userPrompt += ` Consider this existing information: "${existingDescription}". Refine it or generate a new one if this is too basic.`;
        userPrompt += ` Focus on its potential uses and visual appeal. Avoid overly technical jargon.`;

        const result = await descriptionModel.generateContent(userPrompt);
        const response = result.response;
        const jsonData = JSON.parse(response.text());

        console.log(`Generated description JSON for ${familyName}:`, jsonData);
        return jsonData.description || null;
    } catch (error) {
        console.error(`Error generating font description for ${familyName}:`, error);
        return null;
    }
}

/**
 * Generates relevant tags for a font family using the Gemini API.
 * @param familyName The name of the font family.
 * @param description The description of the font family.
 * @param classification The classification (e.g., Serif, Sans Serif).
 * @returns A promise that resolves to an array of tags or null if an error occurs.
 */
export async function generateFontTags(
    familyName: string,
    description: string,
    classification?: string
): Promise<string[] | null> {
    try {
        const userPrompt = `Given the font family "${familyName}", described as "${description}"${classification ? ` and classified as "${classification}"` : ''}, generate 5-7 relevant and diverse tags. Tags should cover aspects like style (e.g., elegant, modern, vintage), use-case (e.g., heading, body text, branding, logo), and visual characteristics (e.g., geometric, humanist, high-contrast).`;

        const result = await tagsModel.generateContent(userPrompt);
        const response = result.response;
        const jsonData = JSON.parse(response.text());

        console.log(`Generated tags JSON for ${familyName}:`, jsonData);
        return jsonData.tags || null;
    } catch (error) {
        console.error(`Error generating font tags for ${familyName}:`, error);
        return null;
    }
}

/**
 * Generates a primary classification for a font family using the Gemini API.
 * @param familyName The name of the font family.
 * @param description Optional description of the font family for more context.
 * @returns A promise that resolves to a Classification string or null if an error occurs or classification is invalid.
 */
export async function generateFontClassification(
    familyName: string,
    description?: string
): Promise<Classification | null> {
    try {
        let userPrompt = `Analyze the font family named "${familyName}"`;
        if (description) {
            userPrompt += ` described as: "${description}"`;
        }
        userPrompt += `. What is its primary design classification? Choose one from the following: ${CLASSIFICATION_VALUES.join(", ")}.`;

        const result = await classificationModel.generateContent(userPrompt);
        const response = result.response;
        const classificationText = response.text() as Classification; // Cast based on enum schema

        // Validate if the returned text is a valid Classification
        if (classificationText && CLASSIFICATION_VALUES.includes(classificationText)) {
            console.log(`Generated classification for ${familyName}: ${classificationText}`);
            return classificationText;
        }
        console.warn(`AI returned an invalid or empty classification for ${familyName}: '${classificationText}'`);
        return null;
    } catch (error) {
        console.error(`Error generating font classification for ${familyName}:`, error);
        return null;
    }
}

/**
 * Performs a comprehensive AI analysis of a font family.
 * @param familyName The name of the font family.
 * @param existingData Optional existing FontFamily data to provide context.
 * @returns A promise that resolves to an object containing description, tags, classification, and other metadata, or null.
 */
export async function getFullFontAnalysis(
    familyName: string,
    foundry?: string, // Allow passing foundry separately if known
    initialParsedClassification?: string // From font parser, if available
): Promise<FullFontAnalysisResult | null> {
    try {
        let userPrompt = `Analyze the font family named "${familyName}"`;
        if (foundry) userPrompt += ` by ${foundry}`;
        userPrompt += `. Provide a comprehensive analysis including its primary classification, sub-classification (if applicable, like 'Old Style' for Serif or 'Geometric' for Sans Serif), 3-5 mood descriptors, 2-3 primary use case recommendations, and a few notable technical characteristics. Also generate a concise marketing description (1-2 sentences, max 40-50 words) and 5-7 diverse tags.`;
        if (initialParsedClassification) userPrompt += ` The font parser initially suggested its classification might be around ${initialParsedClassification}.`;
        userPrompt += ` Adhere to the requested JSON output schema.`;

        const result = await fullAnalysisModel.generateContent(userPrompt);
        const response = result.response;
        const jsonData = JSON.parse(response.text());

        console.log(`Generated full font analysis JSON for ${familyName}:`, jsonData);

        if (!jsonData || !jsonData.description || !jsonData.tags || !jsonData.classification) {
            console.warn(`Full analysis for ${familyName} missing core fields.`);
            return null;
        }

        // Ensure classification is valid before returning
        if (!CLASSIFICATION_VALUES.includes(jsonData.classification as Classification)) {
            console.warn(`Full analysis for ${familyName} returned invalid classification: ${jsonData.classification}`);
            return null; // Or handle by trying to re-classify or using a default
        }

        return {
            description: jsonData.description,
            tags: jsonData.tags,
            classification: jsonData.classification as Classification,
            metadata: {
                subClassification: jsonData.subClassification,
                moods: jsonData.moods,
                useCases: jsonData.useCases,
                // similarFamilies: jsonData.similarFamilies, // if re-enabled
                technicalCharacteristics: jsonData.technicalCharacteristics,
            }
        };

    } catch (error) {
        console.error(`Error in getFullFontAnalysis for ${familyName}:`, error);
        return null;
    }
}

// You can add more functions here for other AI tasks like classification refinement, etc.
// For example, a function to suggest a classification based on name/description if not available.
