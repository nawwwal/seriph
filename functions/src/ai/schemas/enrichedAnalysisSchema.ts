import { STYLE_PRIMARY, SUBSTYLE, MOODS, USE_CASES } from '../../models/contracts';

export const enrichedAnalysisSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		style_primary: {
			type: 'object',
			required: ['value', 'confidence'],
			properties: {
				value: { type: 'string', enum: [...STYLE_PRIMARY] },
				confidence: { type: 'number', minimum: 0, maximum: 1 },
				evidence_keys: {
					type: 'array',
					items: { type: 'string' },
				},
				sources: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							source_type: { type: 'string' },
							source_ref: { type: 'string' },
							confidence: { type: 'number' },
						},
					},
				},
			},
		},
		substyle: {
			type: 'object',
			properties: {
				value: { type: 'string', enum: [...SUBSTYLE] },
				confidence: { type: 'number', minimum: 0, maximum: 1 },
				evidence_keys: { type: 'array', items: { type: 'string' } },
				sources: { type: 'array', items: { type: 'object' } },
			},
		},
		moods: {
			type: 'array',
			items: {
				type: 'object',
				required: ['value', 'confidence'],
				properties: {
					value: { type: 'string', enum: [...MOODS] },
					confidence: { type: 'number', minimum: 0, maximum: 1 },
					evidence_keys: { type: 'array', items: { type: 'string' } },
					sources: { type: 'array', items: { type: 'object' } },
				},
			},
		},
		use_cases: {
			type: 'array',
			items: {
				type: 'object',
				required: ['value', 'confidence'],
				properties: {
					value: { type: 'string', enum: [...USE_CASES] },
					confidence: { type: 'number', minimum: 0, maximum: 1 },
				},
			},
		},
		people: {
			type: 'array',
			items: {
				type: 'object',
				required: ['role', 'name', 'source', 'confidence'],
				properties: {
					role: { type: 'string' },
					name: { type: 'string' },
					source: { type: 'string' },
					confidence: { type: 'number', minimum: 0, maximum: 1 },
					source_url: { type: 'string' },
				},
			},
		},
		historical_context: {
			type: 'object',
			properties: {
				period: { type: 'string' },
				cultural_influence: {
					type: 'array',
					items: { type: 'string' },
				},
				notable_usage: {
					type: 'array',
					items: { type: 'string' },
				},
			},
		},
		negative_tags: {
			type: 'array',
			items: { type: 'string' },
		},
	},
	required: ['style_primary', 'moods', 'use_cases'],
};


