import { GenerativeModel, GoogleAIBackend, getAI, getGenerativeModel, Schema } from "firebase/ai";
import { app } from "@/lib/firebase/config"; // Import the initialized app

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

// You can add more functions here for other AI tasks like classification refinement, etc.
// For example, a function to suggest a classification based on name/description if not available.
