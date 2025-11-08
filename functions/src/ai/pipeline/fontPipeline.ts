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
import { getConfigValue, getConfigBoolean } from '../../config/remoteConfig';
import { getGenerativeModelFromRC, isVertexEnabled, logUsageMetadata } from '../vertex/vertexClient';
import { RC_KEYS, RC_DEFAULTS } from '../../config/rcKeys';

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
	upload_state?: import('../../models/contracts').UploadState;
	job_outcome?: import('../../models/contracts').JobOutcome;
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
		result.upload_state = "parsing";
        const parsedData = await serverParseFontFile(fileBuffer, filename);
        if (!parsedData) {
            result.errors.push('Failed to parse font file');
			result.upload_state = "failed";
			result.job_outcome = "failed";
            return result;
        }
        result.parsedData = parsedData;
		result.upload_state = "parsed";

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
		result.upload_state = "ai_classifying";
        const visualAnalysis = await performVisualAnalysis(parsedData, visualMetrics);
        if (visualAnalysis) {
            result.visualAnalysis = visualAnalysis;
        } else {
            result.warnings.push('Visual analysis failed, proceeding with basic classification');
			result.upload_state = "ai_retrying";
        }

        // Step 4: Web enrichment (if enabled)
        functions.logger.info(`[${filename}] Step 4: Performing web enrichment...`);
        const webEnrichmentEnabled = getConfigBoolean(RC_KEYS.webEnrichmentEnabled, false);
        let webEnrichment = null;
        if (webEnrichmentEnabled) {
			result.upload_state = "web_enriching";
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
			result.upload_state = "enriched";
        } else {
            result.warnings.push('Enriched analysis failed, using visual analysis only');
        }

        // Step 6: Generate summary description
        functions.logger.info(`[${filename}] Step 6: Generating description...`);
        const analysisForSummary = enrichedAnalysis || visualAnalysis || {};
		if (analysisForSummary.style_primary) {
            try {
                const summaryPrompt = buildSummaryPrompt(parsedData, analysisForSummary);
				const gm = getGenerativeModel();
				const summaryResult = await gm.generateContent({
					contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }],
				});
				logUsageMetadata('pipelineSummary', summaryResult?.response);
				const response = summaryResult.response;
				if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
					const summaryText = response.candidates[0].content.parts[0].text.trim();
					result.description = summaryText;
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
			result.job_outcome = result.isValid ? "success" : "partial";
        } else {
            result.errors.push('No analysis result available');
            result.isValid = false;
			result.job_outcome = "failed";
        }

        functions.logger.info(`[${filename}] Pipeline completed. Valid: ${result.isValid}, Confidence: ${result.confidence.toFixed(2)}`);
        return result;

    } catch (error: any) {
        functions.logger.error(`Pipeline error for ${filename}:`, {
            message: error.message,
            stack: error.stack,
        });
        result.errors.push(`Pipeline error: ${error.message}`);
		result.upload_state = "failed";
		result.job_outcome = "failed";
        return result;
    }
}

