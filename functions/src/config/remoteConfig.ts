/**
 * Typed accessors over the cached Remote Config template. All AI/config flags
 * and model names live in Remote Config (never hardcoded). Getters are sync and
 * read from the in-memory cache; a stale cache triggers a background refresh.
 */
import * as functions from "firebase-functions";
import { isCacheFresh, triggerBackgroundRefresh, getCachedTemplate } from "./templateCache";

export { initializeRemoteConfig } from "./templateCache";

/** Resolve a parameter value: template default (top-level or group), else fallback. */
export function getConfigValue(key: string, defaultValue: string): string {
  if (!isCacheFresh()) triggerBackgroundRefresh();

  const template = getCachedTemplate();
  if (!template) return defaultValue;

  let parameter = template.parameters[key];
  if (!parameter && template.parameterGroups) {
    for (const group of Object.values(template.parameterGroups)) {
      if (group.parameters && group.parameters[key]) {
        parameter = group.parameters[key];
        break;
      }
    }
  }
  if (!parameter) return defaultValue;

  if (parameter.defaultValue && "value" in parameter.defaultValue) {
    return parameter.defaultValue.value as string;
  }
  functions.logger.debug(`Parameter '${key}' has no value; using fallback.`);
  return defaultValue;
}

export function getConfigBoolean(key: string, defaultValue: boolean): boolean {
  const normalized = getConfigValue(key, String(defaultValue)).trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  return defaultValue;
}

export function getConfigNumber(key: string, defaultValue: number): number {
  const parsed = Number(getConfigValue(key, String(defaultValue)));
  return Number.isFinite(parsed) ? parsed : defaultValue;
}
