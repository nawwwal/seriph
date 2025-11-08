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

export function getGenerativeModelFromRC(modelKey: string, responseMimeType: string = "application/json") {
	const client = ensureClient();
	const modelName = getConfigValue(modelKey, RC_DEFAULTS[modelKey as keyof typeof RC_DEFAULTS] as string);
	const maxOutputTokens = getConfigNumber(RC_KEYS.maxOutputTokens, Number(RC_DEFAULTS[RC_KEYS.maxOutputTokens]));
	const temperature = getConfigNumber(RC_KEYS.temperature, Number(RC_DEFAULTS[RC_KEYS.temperature]));
	const topP = getConfigNumber(RC_KEYS.topP, Number(RC_DEFAULTS[RC_KEYS.topP]));
	const topK = getConfigNumber(RC_KEYS.topK, Number(RC_DEFAULTS[RC_KEYS.topK]));
	return client.getGenerativeModel({
		model: modelName,
		generationConfig: {
			maxOutputTokens,
			temperature,
			topP,
			topK,
			responseMimeType,
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
	promptParts: string[];
	opName: string;
	tools?: any[];
}): Promise<{ data: T | null; rawText: string | null; response: any | null }> {
	const { modelKey, promptParts, opName } = opts;
	const model = getGenerativeModelFromRC(modelKey, "application/json");
	const webSearchEnabled = getConfigBoolean(RC_KEYS.webEnrichmentEnabled, false);
	const defaultTools = webSearchEnabled ? [{ google_search: {} }] : undefined;

	async function callOnce(useTools: boolean) {
		const payload = {
			contents: [{ role: 'user', parts: promptParts.map((text) => ({ text })) }],
			...(useTools && Array.isArray(defaultTools) ? { tools: defaultTools } : {}),
		};
		return await model.generateContent(payload as any);
	}

	let response: any = null;
	try {
		// First try with tools (if enabled)
		const result = await withRetry(opName, async () => {
			return await callOnce(Boolean(defaultTools));
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


