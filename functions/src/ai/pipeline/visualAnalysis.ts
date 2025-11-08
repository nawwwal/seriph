import * as functions from 'firebase-functions';
import { VISUAL_ANALYSIS_SYSTEM_PROMPT } from '../prompts/systemPrompts';
import { buildVisualAnalysisPrompt } from '../prompts/promptTemplates';
import { validateAnalysisResult } from './validation';
import { generateStrictJSON, isVertexEnabled } from '../vertex/vertexClient';
import { RC_KEYS } from '../../config/rcKeys';
import { getOpticalRangePtThresholds } from '../../config/remoteConfig';
import type { FoundationalFacts, AxisRole, OpticalRangeInfo, ColorFontFormat, RenderingEngineProfile } from '../../models/contracts';

// Schema for visual analysis
const visualAnalysisSchema = {
    type: 'object',
    properties: {
        style_primary: {
            type: 'object',
            properties: {
                value: {
                    type: 'string',
                    enum: ['Serif', 'Sans Serif', 'Script & Handwriting', 'Monospace', 'Display & Decorative', 'Symbol & Icon']
                },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
                evidence: {
                    type: 'array',
                    items: { type: 'string' }
                }
            },
            required: ['value', 'confidence', 'evidence']
        },
        substyle: {
            type: 'object',
            properties: {
                value: { type: 'string' },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
                evidence: {
                    type: 'array',
                    items: { type: 'string' }
                }
            },
            required: ['value', 'confidence', 'evidence']
        },
        moods: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    value: { type: 'string' },
                    confidence: { type: 'number', minimum: 0, maximum: 1 },
                    evidence: {
                        type: 'array',
                        items: { type: 'string' }
                    }
                },
                required: ['value', 'confidence', 'evidence']
            }
        },
        use_cases: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    value: { type: 'string' },
                    confidence: { type: 'number', minimum: 0, maximum: 1 }
                },
                required: ['value', 'confidence']
            }
        },
        negative_tags: {
            type: 'array',
            items: { type: 'string' }
        }
    },
    required: ['style_primary', 'moods', 'use_cases']
};

export async function performVisualAnalysis(
    parsedData: any,
    visualMetrics?: any
): Promise<any | null> {
    if (!isVertexEnabled()) {
        functions.logger.info(`Vertex AI disabled via RC. Skipping visual analysis.`);
        return null;
    }
    const familyName = parsedData.familyName || 'Unknown Family';
    functions.logger.info(`Starting visual analysis for: ${familyName}`);

    const userPrompt = buildVisualAnalysisPrompt(parsedData, visualMetrics);
    const systemPrompt = VISUAL_ANALYSIS_SYSTEM_PROMPT;

    const promptParts = [
        systemPrompt,
        '\n\n',
        userPrompt,
        '\n\nYour response MUST be a valid JSON object adhering to the following schema:\n',
        JSON.stringify(visualAnalysisSchema, null, 2),
        '\n\nGenerate ONLY the JSON output, no markdown formatting.'
    ];

    try {
		const { data: jsonData, rawText } = await generateStrictJSON<any>({
			modelKey: RC_KEYS.visualAnalysisModelName,
			promptParts,
			opName: 'visualAnalysis',
		});

		if (!jsonData) {
			functions.logger.warn(`Visual analysis for ${familyName} returned no JSON; raw=${rawText ? rawText.slice(0, 120) : 'null'}`);
            return null;
        }

        // Validate result
        const validation = validateAnalysisResult(jsonData);
        if (!validation.isValid) {
            functions.logger.warn(`Visual analysis validation failed for ${familyName}:`, validation.errors);
            if (validation.errors.length > 0) {
                return null; // Critical errors
            }
        }
        if (validation.warnings.length > 0) {
            functions.logger.info(`Visual analysis warnings for ${familyName}:`, validation.warnings);
        }

		// Stage‑1 foundational facts (objective; best-effort)
		const foundational: FoundationalFacts = deriveFoundationalFacts(parsedData);
		if (foundational) {
			jsonData._foundational_facts = foundational;
		}

        functions.logger.info(`Visual analysis completed for ${familyName}.`);
        return jsonData;

    } catch (error: any) {
        functions.logger.error(`Error in visual analysis for ${familyName}:`, {
            message: error.message,
            stack: error.stack,
            code: error.code,
            status: error.status,
            details: error.details,
        });
        return null;
    }
}

function deriveFoundationalFacts(parsedData: any): FoundationalFacts {
	const facts: FoundationalFacts = {};
	// Feature tags from parser (uppercase, dedup, sort)
	if (Array.isArray(parsedData?.openTypeFeatures)) {
		const features: unknown[] = parsedData.openTypeFeatures as unknown[];
		const tags: string[] = features
			.map((t) => String((t as any) ?? '').trim())
			.filter((s) => s.length > 0)
			.map((s) => s.toUpperCase());
		const unique: string[] = Array.from(new Set<string>(tags));
		unique.sort();
		facts.feature_tags = unique;
	}
	// Axis roles
	if (Array.isArray(parsedData?.variableAxes)) {
		const mapping: Record<string, AxisRole> = {};
		for (const axis of parsedData.variableAxes) {
			const tag = String(axis?.tag || '').toLowerCase();
			let role: AxisRole = "custom";
			if (tag === 'wght') role = "weight";
			else if (tag === 'wdth') role = "width";
			else if (tag === 'opsz') role = "optical_size";
			else if (tag === 'ital') role = "italic";
			else if (tag === 'slnt') role = "slant";
			else if (tag === 'grad') role = "grade";
			mapping[tag] = role;
		}
		if (Object.keys(mapping).length > 0) facts.axis_roles = mapping;
	}
	// Color font format
	const colorFormats = parsedData?.color?.formats as string[] | undefined;
	if (Array.isArray(colorFormats) && colorFormats.length > 0) {
		let fmt: ColorFontFormat = "unknown";
		if (colorFormats.includes('CBDT')) fmt = "CBDT";
		else if (colorFormats.includes('sbix')) fmt = "SBIX";
		else if (colorFormats.includes('SVG')) fmt = "SVG";
		else if (colorFormats.includes('COLR')) {
			// Parser does not differentiate v0/v1; leave unknown to avoid overclaiming
			fmt = "unknown";
		}
		facts.color_font_format = fmt;
	}
	// Rendering engine profile (best-effort)
	let profile: RenderingEngineProfile | undefined;
	const fmt = String(parsedData?.format || '').toUpperCase();
	const isVariable = !!parsedData?.isVariable;
	if (isVariable) {
		profile = "var_gx";
	} else if (fmt === 'TTF') {
		profile = "ttf_hinting";
	} else if (fmt === 'OTF') {
		profile = "cff1";
	}
	if (profile) facts.rendering_engine_profile = profile;
	// Optical range numeric + bucket
	const opszAxis = Array.isArray(parsedData?.variableAxes) ? parsedData.variableAxes.find((a: any) => String(a?.tag).toLowerCase() === 'opsz') : null;
	let optical: OpticalRangeInfo | undefined;
	if (opszAxis && Number.isFinite(opszAxis.minValue) && Number.isFinite(opszAxis.maxValue)) {
		optical = { numeric: { minPt: Number(opszAxis.minValue), maxPt: Number(opszAxis.maxValue) }, bucket: "unknown" };
	}
	const [textMin, subheadMin, displayMin] = getOpticalRangePtThresholds();
	if (!optical) {
		optical = { bucket: "unknown" };
	} else {
		// Derive bucket from maxPt for intended range
		const maxPt = optical.numeric?.maxPt ?? 0;
		if (maxPt < textMin) optical.bucket = "caption";
		else if (maxPt < subheadMin) optical.bucket = "text";
		else if (maxPt < displayMin) optical.bucket = "subhead";
		else optical.bucket = "display";
	}
	facts.optical_range = optical;
	return facts;
}

