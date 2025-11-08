import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';
import * as functions from 'firebase-functions';
import { getConfigBoolean, getConfigNumber, getConfigValue } from '../../config/remoteConfig';
import { RC_KEYS, RC_DEFAULTS } from '../../config/rcKeys';
import { withRetry } from '../utils/retry';

let vertexClient: VertexAI | null = null;

function ensureClient(): VertexAI {
	if (vertexClient) return vertexClient;
	const project = process.env.GOOGLE_CLOUD_PROJECT || 'seriph';
	const location = getConfigValue(RC_KEYS.vertexLocationId, RC_DEFAULTS[RC_KEYS.vertexLocationId]);
	vertexClient = new VertexAI({ project, location });
	return vertexClient;
}

export interface ModelOptions {
	modelKey: keyof typeof RC_KEYS;
	defaultModel?: string;
	responseMimeType?: string;
	temperatureKey?: string;
	maxTokensKey?: string;
	topPKey?: string;
	topKKey?: string;
}

export interface GenerativeModelOptions {
	responseMimeType?: string;
	responseSchema?: Record<string, unknown>;
}

export function getGenerativeModelFromRC(modelKey: string, opts: GenerativeModelOptions = {}) {
	const client = ensureClient();
	const modelName = getConfigValue(modelKey, RC_DEFAULTS[modelKey as keyof typeof RC_DEFAULTS] as string);
	const maxOutputTokens = getConfigNumber(RC_KEYS.maxOutputTokens, Number(RC_DEFAULTS[RC_KEYS.maxOutputTokens]));
	const temperature = getConfigNumber(RC_KEYS.temperature, Number(RC_DEFAULTS[RC_KEYS.temperature]));
	const topP = getConfigNumber(RC_KEYS.topP, Number(RC_DEFAULTS[RC_KEYS.topP]));
	const topK = getConfigNumber(RC_KEYS.topK, Number(RC_DEFAULTS[RC_KEYS.topK]));
	const responseMimeType = opts.responseMimeType ?? "application/json";
	const responseSchema = opts.responseSchema;
	return client.getGenerativeModel({
		model: modelName,
		generationConfig: {
			maxOutputTokens,
			temperature,
			topP,
			topK,
			responseMimeType,
			...(responseSchema ? { responseSchema } : {}),
		},
		safetySettings: [
			{
				category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
				threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
			},
		],
	});
}

export function isVertexEnabled(): boolean {
	return getConfigBoolean(RC_KEYS.isVertexEnabled, false);
}

export function logUsageMetadata(prefix: string, response: any) {
	try {
		const usage = response?.usageMetadata || response?.usage || null;
		if (usage) {
			functions.logger.info(`${prefix} usage`, usage);
		}
	} catch {
		// noop
	}
}

/**
 * Generate strict JSON with retries and built-in parsing.
 * Returns { data, rawResponseText }.
 */
export async function generateStrictJSON<T = any>(opts: {
	modelKey: string;
	promptParts?: string[];
	contents?: Array<{ role: string; parts: Array<{ text: string }> }>;
	opName: string;
	tools?: any[];
	responseSchema?: Record<string, unknown>;
}): Promise<{ data: T | null; rawText: string | null; response: any | null }> {
	const { modelKey, promptParts = [], contents, opName, responseSchema, tools: explicitTools } = opts;
	const model = getGenerativeModelFromRC(modelKey, { responseMimeType: "application/json", responseSchema });
	const webSearchEnabled = getConfigBoolean(RC_KEYS.webEnrichmentEnabled, false);
	const defaultTools = webSearchEnabled ? [{ google_search: {} }] : undefined;
	const toolsToUse = Array.isArray(explicitTools) ? explicitTools : defaultTools;

	let payloadContents: Array<{ role: string; parts: Array<{ text: string }> }>;
	if (Array.isArray(contents) && contents.length > 0) {
		payloadContents = contents;
	} else {
		if (!Array.isArray(promptParts) || promptParts.length === 0) {
			throw new Error(`${opName} requires promptParts or contents`);
		}
		payloadContents = [
			{
				role: 'user',
				parts: promptParts.map((text) => ({ text })),
			},
		];
	}

	async function callOnce(useTools: boolean) {
		const payload = {
			contents: payloadContents,
			...(useTools && Array.isArray(toolsToUse) ? { tools: toolsToUse } : {}),
		};
		return await model.generateContent(payload as any);
	}

	let response: any = null;
	try {
		// First try with tools (if enabled)
		const result = await withRetry(opName, async () => {
			return await callOnce(Boolean(toolsToUse));
		});
		response = (result as any)?.response;
	} catch (err: any) {
		const msg = String(err?.message || '');
		const status = err?.status || err?.code;
		const toolArgError = (status === 400) && /INVALID_ARGUMENT|google_search/i.test(msg);
		if (toolArgError) {
			functions.logger.warn(`${opName} tools rejected (google_search). Retrying without tools.`);
			const resultNoTools = await withRetry(opName, async () => {
				return await callOnce(false);
			});
			response = (resultNoTools as any)?.response;
		} else {
			throw err;
		}
	}

	logUsageMetadata(opName, response);
	const text = response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim?.() || null;
	if (!text) return { data: null, rawText: null, response };
	try {
		const cleaned = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim();
		const json = JSON.parse(cleaned);
		return { data: json as T, rawText: text, response };
	} catch (e: any) {
		functions.logger.warn(`${opName} returned non-JSON or malformed JSON`);
		return { data: null, rawText: text, response };
	}
}


