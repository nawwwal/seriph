import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { RC_KEYS, RC_DEFAULTS } from './rcKeys';

// Template cache with TTL
interface TemplateCache {
    template: admin.remoteConfig.RemoteConfigTemplate;
    fetchedAt: number;
    version: string;
}

const TEMPLATE_TTL_MS = 60 * 1000; // 60 seconds as per Firebase best practices
let templateCache: TemplateCache | null = null;
let refreshPromise: Promise<void> | null = null; // Prevent concurrent refreshes

/**
 * Fetches the Remote Config template from Firebase
 * Implements graceful error handling - never throws, always returns null on failure
 */
async function fetchTemplate(): Promise<admin.remoteConfig.RemoteConfigTemplate | null> {
    try {
        const remoteConfig = admin.remoteConfig();
        const template = await remoteConfig.getTemplate();
        functions.logger.info('Remote Config template fetched successfully.', {
            version: template.version?.versionNumber || 'unknown',
            parameterCount: Object.keys(template.parameters || {}).length,
        });
        return template;
    } catch (error: any) {
        functions.logger.error('Failed to fetch Remote Config template:', {
            message: error.message,
            code: error.code,
            stack: error.stack,
        });
        return null;
    }
}

/**
 * Refreshes the template cache if TTL has expired or template is missing
 * Uses a promise lock to prevent concurrent refresh requests
 */
async function ensureFreshTemplate(): Promise<void> {
    const now = Date.now();
    
    // Check if we have a valid cached template
    if (templateCache && (now - templateCache.fetchedAt) < TEMPLATE_TTL_MS) {
        return; // Cache is still valid
    }

    // If a refresh is already in progress, wait for it
    if (refreshPromise) {
        await refreshPromise;
        return;
    }

    // Start a new refresh
    refreshPromise = (async () => {
        try {
            const template = await fetchTemplate();
            if (template) {
                templateCache = {
                    template,
                    fetchedAt: now,
                    version: template.version?.versionNumber || 'unknown',
                };
                functions.logger.info('Remote Config template cache refreshed.', {
                    version: templateCache.version,
                });
            } else {
                // If fetch failed but we have a stale cache, keep using it
                if (!templateCache) {
                    functions.logger.warn('Remote Config template fetch failed and no cache available. Using defaults.');
                } else {
                    functions.logger.warn('Remote Config template fetch failed. Using stale cache.', {
                        staleVersion: templateCache.version,
                        ageSeconds: Math.floor((now - templateCache.fetchedAt) / 1000),
                    });
                }
            }
        } finally {
            refreshPromise = null;
        }
    })();

    await refreshPromise;
}

/**
 * Initializes Remote Config template (non-blocking, lazy initialization)
 * This function is safe to call multiple times and will not block execution
 */
export async function initializeRemoteConfig(): Promise<void> {
    await ensureFreshTemplate();
}

/**
 * Manually refreshes the Remote Config template
 * Useful for forcing an immediate refresh after publishing changes
 */
export async function refreshTemplate(): Promise<void> {
    // Clear cache to force refresh
    templateCache = null;
    await ensureFreshTemplate();
}

/**
 * Gets a configuration value from Remote Config
 * 
 * Resolution order:
 * 1. Check conditional values (if any match their conditions)
 * 2. Check default value from template
 * 3. Fall back to provided defaultValue parameter
 * 
 * @param key - The parameter key to retrieve
 * @param defaultValue - Fallback value if parameter is not found or Remote Config fails
 * @returns The resolved parameter value or defaultValue
 */
export function getConfigValue(key: string, defaultValue: string): string {
    // Ensure template is fresh (non-blocking if already cached)
    // Note: This is async but we can't await in a sync function
    // The first call will trigger refresh, subsequent calls will use cache
    if (!templateCache || (Date.now() - templateCache.fetchedAt) >= TEMPLATE_TTL_MS) {
        // Trigger refresh in background (fire and forget)
        ensureFreshTemplate().catch((error) => {
            functions.logger.warn('Background template refresh failed:', error);
        });
    }

    // If no template available, return default
    if (!templateCache) {
        functions.logger.debug(`Remote Config not available. Using default value for '${key}': ${defaultValue}`);
        return defaultValue;
    }

    // Check top-level parameters first, then parameter groups
    let parameter = templateCache.template.parameters[key];
    
    // If not found in top-level, check parameter groups
    if (!parameter && templateCache.template.parameterGroups) {
        for (const group of Object.values(templateCache.template.parameterGroups)) {
            if (group.parameters && group.parameters[key]) {
                parameter = group.parameters[key];
                break;
            }
        }
    }
    
    // Parameter doesn't exist
    if (!parameter) {
        functions.logger.debug(`Parameter '${key}' not found in Remote Config. Using default: ${defaultValue}`);
        return defaultValue;
    }

    // Server-side evaluation of conditions is non-trivial and user context free.
    // Treat conditionalValues as a map and ignore unless an explicit server condition key is provided.
    // We intentionally prefer defaultValue defined in the template for determinism.

    // Check default value
    if (parameter.defaultValue && 'value' in parameter.defaultValue) {
        const resolvedValue = parameter.defaultValue.value as string;
        functions.logger.debug(`Using default value for '${key}': ${resolvedValue}`);
        return resolvedValue;
    }

    // Fall back to provided default
    functions.logger.debug(`Parameter '${key}' has no valid value. Using fallback default: ${defaultValue}`);
    return defaultValue;
}

/**
 * Typed Boolean getter
 */
export function getConfigBoolean(key: string, defaultValue: boolean): boolean {
    const raw = getConfigValue(key, String(defaultValue));
    const normalized = raw.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
    return defaultValue;
}

/**
 * Typed Number getter
 */
export function getConfigNumber(key: string, defaultValue: number): number {
    const raw = getConfigValue(key, String(defaultValue));
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
    return defaultValue;
}

/**
 * Gets the current template version (for debugging/monitoring)
 */
export function getTemplateVersion(): string | null {
    return templateCache?.version || null;
}

/**
 * Checks if Remote Config is available and cache is fresh
 */
export function isRemoteConfigAvailable(): boolean {
    if (!templateCache) {
        return false;
    }
    const age = Date.now() - templateCache.fetchedAt;
    return age < TEMPLATE_TTL_MS;
}

// ---- Helpers for parsing CSV numeric threshold lists ----
function parseCsvNumbers(raw: string, fallback: number[]): number[] {
	const parts = (raw || "").split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
	if (parts.length !== fallback.length) return fallback;
	return parts as number[];
}

/**
 * Returns confidence band thresholds [low, high, veryHigh] for mapping 0..1 values.
 * Values <= low => 'low', <= high => 'medium', <= veryHigh => 'high', else 'very_high'.
 */
export function getConfidenceBandThresholds(): [number, number, number] {
	const raw = getConfigValue(RC_KEYS.confidenceBandThresholds, RC_DEFAULTS[RC_KEYS.confidenceBandThresholds]);
	const [low, high, veryHigh] = parseCsvNumbers(raw, [0.2, 0.6, 0.85]);
	return [low, high, veryHigh];
}

/**
 * Returns optical range point thresholds [textMin, subheadMin, displayMin].
 * caption: < textMin; text: < subheadMin; subhead: < displayMin; else display.
 */
export function getOpticalRangePtThresholds(): [number, number, number] {
	const raw = getConfigValue(RC_KEYS.opticalRangePtThresholds, RC_DEFAULTS[RC_KEYS.opticalRangePtThresholds]);
	const [textMin, subheadMin, displayMin] = parseCsvNumbers(raw, [9, 18, 36]);
	return [textMin, subheadMin, displayMin];
}
