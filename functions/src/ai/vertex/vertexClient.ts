import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';
import * as functions from 'firebase-functions';
import { getConfigBoolean, getConfigNumber, getConfigValue } from '../../config/remoteConfig';
import { RC_KEYS, RC_DEFAULTS } from '../../config/rcKeys';

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


