export function deepStripUndefined<T>(value: T): T {
	if (value === undefined) return undefined as unknown as T;
	if (value === null || typeof value !== 'object') return value;
	if (Array.isArray(value)) {
		return value
			.map(deepStripUndefined)
			.filter((v) => v !== undefined) as unknown as T;
	}
	const output: Record<string, unknown> = {};
	for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
		const cleaned = deepStripUndefined(val as unknown);
		if (cleaned !== undefined) {
			output[key] = cleaned;
		}
	}
	return output as T;
}


