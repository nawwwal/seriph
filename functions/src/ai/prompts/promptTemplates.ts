import { MOODS, USE_CASES, CRAFT_DETAILS, getValidSubtypes } from '../taxonomies';
import type { Classification } from '../../models/font.models';

export const ANALYSIS_STAGES = {
  VISUAL_ANALYSIS: 'visual_analysis',
  ENRICHED_ANALYSIS: 'enriched_analysis',
  SUMMARY_GENERATION: 'summary_generation',
} as const;

/**
 * Build prompt for visual analysis (no web search)
 */
export function buildVisualAnalysisPrompt(parsedData: any, visualMetrics?: any): string {
  const metricsText = visualMetrics ? `
Visual Metrics:
- x-height ratio: ${visualMetrics.x_height_ratio || 'N/A'}
- contrast index: ${visualMetrics.contrast_index || 'N/A'}
- aperture index: ${visualMetrics.aperture_index || 'N/A'}
- serif detected: ${visualMetrics.serif_detected || 'N/A'}
- stress angle: ${visualMetrics.stress_angle_deg || 'N/A'} degrees
- roundness: ${visualMetrics.roundness || 'N/A'}
- spacing stddev: ${visualMetrics.spacing_stddev || 'N/A'}
- terminal style: ${visualMetrics.terminal_style || 'N/A'}
` : 'Visual metrics: Not available (using basic classification)';

  return `Analyze the font family "${parsedData.familyName || 'Unknown'}".

Font Details:
- Subfamily: ${parsedData.subfamilyName || 'N/A'}
- PostScript Name: ${parsedData.postScriptName || 'N/A'}
- Version: ${parsedData.version || 'N/A'}
- Format: ${parsedData.format || 'N/A'}
- Foundry: ${parsedData.foundry || 'N/A'}
- Weight: ${parsedData.weight || 'N/A'}
- Style: ${parsedData.style || 'N/A'}
- Classification (from OS/2): ${parsedData.classification || 'N/A'}
- Is Variable: ${parsedData.isVariable ? 'Yes' : 'No'}
- Glyph Count: ${parsedData.glyphCount || 'N/A'}
- OpenType Features: ${parsedData.openTypeFeatures?.join(', ') || 'N/A'}

${metricsText}

${parsedData.isVariable && parsedData.variableAxes ? `
Variable Axes:
${parsedData.variableAxes.map((axis: any) => `  - ${axis.tag} (${axis.name}): ${axis.minValue} to ${axis.maxValue}, default ${axis.defaultValue}`).join('\n')}
` : ''}

Controlled Vocabulary:
- Moods: ${MOODS.join(', ')}
- Use Cases: ${USE_CASES.join(', ')}
- Craft Details: ${CRAFT_DETAILS.join(', ')}

Provide classification with evidence references to the metrics above.`;
}

/**
 * Build prompt for enriched analysis (with web search enabled)
 */
export function buildEnrichedAnalysisPrompt(parsedData: any, visualMetrics?: any, visualAnalysisResult?: any): string {
  const basePrompt = buildVisualAnalysisPrompt(parsedData, visualMetrics);
  
  const enrichmentInstructions = `
ENRICHMENT INSTRUCTIONS:
- If foundry or designer information is present but incomplete, search Google for more details
- Search for historical context if this appears to be a well-known font family
- Search for foundry information if vendor ID or foundry name is present
- When you find web information, include the source URL in your response
- If web search doesn't find relevant information, proceed with inference based on visual characteristics

Search Google to get more information about the foundry, designer, or historical context if needed.`;

  return `${basePrompt}

${enrichmentInstructions}

${visualAnalysisResult ? `
Previous Visual Analysis:
- Style Primary: ${visualAnalysisResult.style_primary?.value || 'N/A'}
- Substyle: ${visualAnalysisResult.substyle?.value || 'N/A'}
- Moods: ${visualAnalysisResult.moods?.map((m: any) => m.value).join(', ') || 'N/A'}
- Use Cases: ${visualAnalysisResult.use_cases?.map((u: any) => u.value).join(', ') || 'N/A'}
` : ''}

Provide enriched analysis with web-sourced information where available.`;
}

/**
 * Build prompt for summary generation
 */
export function buildSummaryPrompt(parsedData: any, analysisResult: any): string {
  return `Generate a concise, appealing description (1-2 sentences, max 40-50 words) for the font family "${parsedData.familyName}".

Analysis Summary:
- Classification: ${analysisResult.style_primary?.value || 'N/A'}${analysisResult.substyle ? ` (${analysisResult.substyle.value})` : ''}
- Key Characteristics: ${analysisResult.moods?.slice(0, 3).map((m: any) => m.value).join(', ') || 'N/A'}
- Use Cases: ${analysisResult.use_cases?.slice(0, 2).map((u: any) => u.value).join(', ') || 'N/A'}
- Foundry: ${parsedData.foundry || 'Unknown'}

Write a marketing-friendly description that highlights the font's key characteristics and best use cases.`;
}

