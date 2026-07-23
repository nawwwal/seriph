import * as functions from "firebase-functions";
import { getRemoteConfig, type RemoteConfigTemplate } from "firebase-admin/remote-config";

interface TemplateCache {
  template: RemoteConfigTemplate;
  fetchedAt: number;
  version: string;
}

const TEMPLATE_TTL_MS = 60 * 1000; // Firebase best-practice TTL
let templateCache: TemplateCache | null = null;
let refreshPromise: Promise<void> | null = null;

async function fetchTemplate(): Promise<RemoteConfigTemplate | null> {
  try {
    return await getRemoteConfig().getTemplate();
  } catch (error: any) {
    functions.logger.error("Failed to fetch Remote Config template:", { message: error?.message, code: error?.code });
    return null;
  }
}

/** Refresh the cache if the TTL expired; a promise lock prevents concurrent refreshes. */
async function ensureFreshTemplate(): Promise<void> {
  const now = Date.now();
  if (templateCache && now - templateCache.fetchedAt < TEMPLATE_TTL_MS) return;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const template = await fetchTemplate();
      if (template) {
        templateCache = { template, fetchedAt: now, version: template.version?.versionNumber || "unknown" };
      } else if (!templateCache) {
        functions.logger.warn("Remote Config fetch failed and no cache available. Using defaults.");
      } else {
        functions.logger.warn("Remote Config fetch failed. Using stale cache.", { staleVersion: templateCache.version });
      }
    } finally {
      refreshPromise = null;
    }
  })();
  await refreshPromise;
}

/** Initialize the Remote Config template (lazy, safe to call repeatedly). */
export async function initializeRemoteConfig(): Promise<void> {
  await ensureFreshTemplate();
}

export function isCacheFresh(): boolean {
  return !!templateCache && Date.now() - templateCache.fetchedAt < TEMPLATE_TTL_MS;
}

export function triggerBackgroundRefresh(): void {
  ensureFreshTemplate().catch((error) => functions.logger.warn("Background template refresh failed:", error));
}

export function getCachedTemplate(): RemoteConfigTemplate | null {
  return templateCache?.template ?? null;
}
