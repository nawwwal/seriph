import * as functions from 'firebase-functions';
import * as fontkit from 'fontkit';
import { serverParseFontFile } from '../../parser/fontParser';
import { computeVisualMetrics } from '../../parser/visualMetrics';
import { performVisualAnalysis } from './visualAnalysis';
import { performEnrichedAnalysis } from './enrichedAnalysis';
import { enrichFontFromWeb } from './webEnricher';
import { validateAnalysisResult, applySanityRules, calculateConfidence } from './validation';
import { buildSummaryPrompt } from '../prompts/promptTemplates';
import type { DataProvenance } from '../../models/font.models';
import { getConfigValue } from '../../config/remoteConfig';
import { getGenerativeModelFromRC, isVertexEnabled, logUsageMetadata } from '../vertex/vertexClient';
import { RC_KEYS } from '../../config/rcKeys';

const getGenerativeModel = () => getGenerativeModelFromRC(RC_KEYS.summaryModelName);

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

        // Step 4: Web enrichment (if enabled)
        functions.logger.info(`[${filename}] Step 4: Performing web enrichment...`);
        const webEnrichmentEnabled = getConfigValue('web_enrichment_enabled', 'false') === 'true';
        let webEnrichment = null;
        if (webEnrichmentEnabled) {
            webEnrichment = await enrichFontFromWeb(parsedData, true);
            if (webEnrichment) {
                // Merge web enrichment data into parsedData for use in enriched analysis
                if (webEnrichment.foundry && !parsedData.foundry) {
                    parsedData.foundry = webEnrichment.foundry.name;
                }
                if (webEnrichment.designer && !parsedData.designer) {
                    parsedData.designer = webEnrichment.designer.name;
                }
                if (webEnrichment.historical_context) {
                    parsedData.historical_context = webEnrichment.historical_context;
                }
                if (webEnrichment.license) {
                    parsedData.licenseType = webEnrichment.license.type;
                    parsedData.licenseUrl = webEnrichment.license.url;
                }
            }
        }

        // Step 5: Enriched analysis (with web search if enabled)
        functions.logger.info(`[${filename}] Step 5: Performing enriched analysis...`);
        const enrichedAnalysis = await performEnrichedAnalysis(parsedData, visualMetrics, visualAnalysis);
        if (enrichedAnalysis) {
            // Merge web enrichment into enriched analysis if available
            if (webEnrichment) {
                if (webEnrichment.people) {
                    enrichedAnalysis.people = webEnrichment.people;
                }
                if (webEnrichment.historical_context) {
                    enrichedAnalysis.historical_context = webEnrichment.historical_context;
                }
            }
            result.enrichedAnalysis = enrichedAnalysis;
        } else {
            result.warnings.push('Enriched analysis failed, using visual analysis only');
        }

        // Step 6: Generate summary description
        functions.logger.info(`[${filename}] Step 6: Generating description...`);
        const analysisForSummary = enrichedAnalysis || visualAnalysis || {};
        if (analysisForSummary.style_primary) {
            try {
                const summaryPrompt = buildSummaryPrompt(parsedData, analysisForSummary);
                const generativeModel = getGenerativeModel();
                const summaryResult = await generativeModel.generateContent({
                    contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }],
                });
            logUsageMetadata('pipelineSummary', summaryResult?.response);

                const response = summaryResult.response;
                if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    const summaryText = response.candidates[0].content.parts[0].text.trim();
                    try {
                        // With responseMimeType: "application/json", try parsing as JSON first
                        const cleanedText = summaryText.replace(/^```json\n?/, '').replace(/\n?```$/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim();
                        const summaryJson = JSON.parse(cleanedText);
                        result.description = summaryJson.description || summaryText;
                    } catch {
                        // If not JSON, use the text directly
                        result.description = summaryText;
                    }
                }
            } catch (e: any) {
                functions.logger.warn(`Failed to generate description: ${e.message}`);
                result.warnings.push('Description generation failed');
            }
        }

        // Step 7: Validation and sanity checks
        functions.logger.info(`[${filename}] Step 7: Validating results...`);
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

