import * as functions from 'firebase-functions';
import { getConfigNumber } from '../../config/remoteConfig';
import { RC_KEYS, RC_DEFAULTS } from '../../config/rcKeys';

export interface RetryOptions {
	maxAttempts?: number;
	baseMs?: number;
	maxMs?: number;
	shouldRetry?: (err: any) => boolean;
}

export async function withRetry<T>(opName: string, fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
	const maxAttempts = opts.maxAttempts ?? getConfigNumber(RC_KEYS.retryMaxAttempts, Number(RC_DEFAULTS[RC_KEYS.retryMaxAttempts]));
	const baseMs = opts.baseMs ?? getConfigNumber(RC_KEYS.retryBaseMs, Number(RC_DEFAULTS[RC_KEYS.retryBaseMs]));
	const maxMs = opts.maxMs ?? getConfigNumber(RC_KEYS.retryMaxMs, Number(RC_DEFAULTS[RC_KEYS.retryMaxMs]));
	const shouldRetry = opts.shouldRetry ?? defaultShouldRetry;

	let lastErr: any;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (err: any) {
			lastErr = err;
			if (!shouldRetry(err) || attempt === maxAttempts) {
				break;
			}
			const delay = Math.min(maxMs, baseMs * Math.pow(2, attempt - 1)) * (0.75 + Math.random() * 0.5);
			functions.logger.warn(`${opName} attempt ${attempt} failed, retrying in ${Math.round(delay)}ms`, {
				code: err?.code,
				status: err?.status,
				message: err?.message,
			});
			await new Promise((r) => setTimeout(r, delay));
		}
	}
	throw lastErr;
}

function defaultShouldRetry(err: any): boolean {
	const status = err?.status || err?.code || err?.response?.status;
	// Retry 429 / 5xx; do not retry 4xx (except 429) or Safety errors
	if (status === 429) return true;
	if (typeof status === 'number' && status >= 500) return true;
	const finishReason = err?.finishReason || err?.response?.finishReason;
	if (finishReason && String(finishReason).toUpperCase() === 'SAFETY') return false;
	return false;
}


