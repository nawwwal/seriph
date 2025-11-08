import * as functions from 'firebase-functions';
import * as fontkit from 'fontkit';
import { serverParseFontFile } from '../../parser/fontParser';
import { computeVisualMetrics } from '../../parser/visualMetrics';
import { performVisualAnalysis } from './visualAnalysis';
import { performEnrichedAnalysis } from './enrichedAnalysis';
import { validateAnalysisResult, applySanityRules, calculateConfidence } from './validation';
import { buildSummaryPrompt } from '../prompts/promptTemplates';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, GenerationConfig, SafetySetting } from '@google/genai';
import type { DataProvenance } from '../../models/font.models';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'seriph';
const LOCATION_ID = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const TARGET_MODEL_NAME = 'gemini-2.5-flash-preview-05-20';

const genAI = new GoogleGenAI({
    vertexai: true,
    project: PROJECT_ID,
    location: LOCATION_ID,
});

const generationConfig: GenerationConfig = {
    maxOutputTokens: 512,
    temperature: 0.7,
    topP: 0.9,
    topK: 40,
};

const safetySettings: SafetySetting[] = [{
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
}];

export interface PipelineResult {
    parsedData: any;
    visualMetrics?: any;
    visualAnalysis?: any;
    enrichedAnalysis?: any;
    description?: string;
    isValid: boolean;
    confidence: number;
    errors: string[];
    warnings: string[];
}

/**
 * Main font processing pipeline
 */
export async function runFontPipeline(
    fileBuffer: Buffer,
    filename: string
): Promise<PipelineResult> {
    functions.logger.info(`Starting font pipeline for: ${filename}`);

    const result: PipelineResult = {
        parsedData: null,
        isValid: false,
        confidence: 0,
        errors: [],
        warnings: [],
    };

    try {
        // Step 1: Extract metadata from font file
        functions.logger.info(`[${filename}] Step 1: Extracting metadata...`);
        const parsedData = await serverParseFontFile(fileBuffer, filename);
        if (!parsedData) {
            result.errors.push('Failed to parse font file');
            return result;
        }
        result.parsedData = parsedData;

        // Step 2: Compute visual metrics
        functions.logger.info(`[${filename}] Step 2: Computing visual metrics...`);
        let font: fontkit.Font | null = null;
        try {
            font = fontkit.create(fileBuffer) as fontkit.Font;
            if ('fonts' in font && (font as any).fonts.length > 0) {
                font = (font as any).fonts[0];
            }
        } catch (e) {
            functions.logger.warn(`Could not create fontkit font for visual metrics: ${e}`);
        }

        let visualMetrics;
        if (font) {
            visualMetrics = await computeVisualMetrics(font, parsedData);
            result.visualMetrics = visualMetrics;
        }

        // Step 3: Visual analysis (no web search)
        functions.logger.info(`[${filename}] Step 3: Performing visual analysis...`);
        const visualAnalysis = await performVisualAnalysis(parsedData, visualMetrics);
        if (visualAnalysis) {
            result.visualAnalysis = visualAnalysis;
        } else {
            result.warnings.push('Visual analysis failed, proceeding with basic classification');
        }

        // Step 4: Enriched analysis (with web search if enabled)
        functions.logger.info(`[${filename}] Step 4: Performing enriched analysis...`);
        const enrichedAnalysis = await performEnrichedAnalysis(parsedData, visualMetrics, visualAnalysis);
        if (enrichedAnalysis) {
            result.enrichedAnalysis = enrichedAnalysis;
        } else {
            result.warnings.push('Enriched analysis failed, using visual analysis only');
        }

        // Step 5: Generate summary description
        functions.logger.info(`[${filename}] Step 5: Generating description...`);
        const analysisForSummary = enrichedAnalysis || visualAnalysis || {};
        if (analysisForSummary.style_primary) {
            try {
                const summaryPrompt = buildSummaryPrompt(parsedData, analysisForSummary);
                const summaryRequest = {
                    model: TARGET_MODEL_NAME,
                    contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }],
                    generationConfig: generationConfig,
                    safetySettings: safetySettings,
                };
                const summaryResult = await genAI.models.generateContent(summaryRequest);

                if (summaryResult?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    const summaryText = summaryResult.candidates[0].content.parts[0].text.trim();
                    try {
                        const summaryJson = JSON.parse(summaryText.replace(/^```json\n?/, '').replace(/\n?```$/, ''));
                        result.description = summaryJson.description || summaryText;
                    } catch {
                        result.description = summaryText;
                    }
                }
            } catch (e: any) {
                functions.logger.warn(`Failed to generate description: ${e.message}`);
                result.warnings.push('Description generation failed');
            }
        }

        // Step 6: Validation and sanity checks
        functions.logger.info(`[${filename}] Step 6: Validating results...`);
        const finalAnalysis = enrichedAnalysis || visualAnalysis;
        if (finalAnalysis) {
            const validation = validateAnalysisResult(finalAnalysis);
            result.isValid = validation.isValid;
            result.errors.push(...validation.errors);
            result.warnings.push(...validation.warnings);

            // Apply sanity rules
            const sanityCheck = applySanityRules(parsedData, finalAnalysis);
            result.warnings.push(...sanityCheck.warnings);

            // Calculate overall confidence
            result.confidence = calculateConfidence(finalAnalysis);
        } else {
            result.errors.push('No analysis result available');
            result.isValid = false;
        }

        functions.logger.info(`[${filename}] Pipeline completed. Valid: ${result.isValid}, Confidence: ${result.confidence.toFixed(2)}`);
        return result;

    } catch (error: any) {
        functions.logger.error(`Pipeline error for ${filename}:`, {
            message: error.message,
            stack: error.stack,
        });
        result.errors.push(`Pipeline error: ${error.message}`);
        return result;
    }
}

