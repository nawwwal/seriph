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
	return getConfigBoolean(RC_KEYS.isVertexEnabled, RC_DEFAULTS[RC_KEYS.isVertexEnabled] === "true");
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
	const { modelKey, promptParts, opName, tools } = opts;
	const model = getGenerativeModelFromRC(modelKey, "application/json");
	const payload = {
		contents: [{ role: 'user', parts: promptParts.map((text) => ({ text })) }],
		...(Array.isArray(tools) && tools.length > 0 ? { tools } : {}),
	};
	const result = await withRetry(opName, async () => {
		return await model.generateContent(payload as any);
	});
	const response = (result as any)?.response;
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


