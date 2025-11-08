import { GoogleAuth } from 'google-auth-library';
import * as functions from 'firebase-functions';
import { getConfigValue } from '../../config/remoteConfig';
import { RC_KEYS, RC_DEFAULTS } from '../../config/rcKeys';

const auth = new GoogleAuth({
	scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

const API_VERSION = 'v1';

function getProjectId(): string {
	return (
		process.env.GOOGLE_CLOUD_PROJECT ||
		process.env.GCLOUD_PROJECT ||
		process.env.GCP_PROJECT ||
		'seriph'
	);
}

function getLocation(): string {
	return getConfigValue(RC_KEYS.vertexLocationId, RC_DEFAULTS[RC_KEYS.vertexLocationId]);
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface PromptData {
	model?: string;
	contents?: Array<{ role: string; parts: Array<{ text: string }> }>;
	responseMimeType?: string;
	responseSchema?: Record<string, unknown>;
}

export interface PromptResource {
	name?: string;
	promptId?: string;
	displayName?: string;
	description?: string;
	promptData?: PromptData;
}

export interface PromptUpsertDefinition {
	promptId?: string;
	displayName: string;
	description?: string;
	model: string;
	contents: Array<{ role: string; parts: Array<{ text: string }> }>;
	responseSchema?: Record<string, unknown>;
}

async function vertexRequest<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
	const project = getProjectId();
	const location = getLocation();
	const client = await auth.getClient();
	const baseUrl = `https://${location}-aiplatform.googleapis.com/${API_VERSION}`;
	const url = `${baseUrl}/projects/${project}/locations/${location}${path}`;

	try {
		const response = await client.request<T>({
			url,
			method,
			data: body,
		});
		return response.data;
	} catch (error: any) {
		const status = error?.code || error?.response?.status;
		const message = error?.message || error?.response?.data || 'Unknown error';
		functions.logger.error(`Vertex Prompt API ${method} ${path} failed`, {
			status,
			message,
		});
		throw error;
	}
}

export async function fetchPrompt(promptId: string): Promise<PromptResource | null> {
	if (!promptId) return null;
	try {
		const data = await vertexRequest<PromptResource>('GET', `/prompts/${promptId}`);
		return data;
	} catch (error: any) {
		const status = error?.code || error?.response?.status;
		if (status === 404) {
			functions.logger.warn(`Prompt ${promptId} not found in Prompt Registry.`);
			return null;
		}
		throw error;
	}
}

export async function upsertPrompt(def: PromptUpsertDefinition): Promise<PromptResource> {
	const promptPayload = {
		displayName: def.displayName,
		description: def.description ?? '',
		promptData: {
			model: def.model,
			contents: def.contents,
			responseMimeType: 'application/json',
			...(def.responseSchema ? { responseSchema: def.responseSchema } : {}),
		},
	};

	if (def.promptId) {
		const updateMask = ['displayName', 'description', 'promptData'].join(',');
		const data = await vertexRequest<PromptResource>(
			'PATCH',
			`/prompts/${def.promptId}?updateMask=${encodeURIComponent(updateMask)}`,
			{ prompt: promptPayload }
		);
		return data;
	}

	const created = await vertexRequest<PromptResource>('POST', '/prompts', {
		prompt: promptPayload,
	});
	return created;
}

export function extractPromptId(resource: PromptResource | null): string | null {
	if (!resource) return null;
	if (resource.promptId) return resource.promptId;
	if (resource.name) {
		const segments = resource.name.split('/');
		return segments[segments.length - 1] || null;
	}
	return null;
}

export async function getPromptContents(promptId: string): Promise<Array<{ role: string; parts: Array<{ text: string }> }> | null> {
	const prompt = await fetchPrompt(promptId);
	if (!prompt?.promptData?.contents || prompt.promptData.contents.length === 0) {
		return null;
	}
	return prompt.promptData.contents;
}


