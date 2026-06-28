/**
 * Resolves where canonical font assets live (public bucket) and how their stable
 * CDN urls are formed (Firebase Hosting domain or a custom CDN base). All values
 * come from Remote Config so nothing is hardcoded at deploy time.
 */
import { getConfigValue } from './remoteConfig';
import { RC_KEYS, RC_DEFAULTS } from './rcKeys';

/** Name of the public, CDN-fronted bucket holding canonical served assets. */
export function publicBucketName(): string {
  return getConfigValue(RC_KEYS.catalogPublicBucket, RC_DEFAULTS[RC_KEYS.catalogPublicBucket]);
}

/** CDN base url (no trailing slash). Falls back to the Firebase Hosting default domain. */
export function cdnBaseUrl(): string {
  const configured = getConfigValue(RC_KEYS.catalogCdnBaseUrl, RC_DEFAULTS[RC_KEYS.catalogCdnBaseUrl]);
  if (configured && configured.trim()) return configured.trim().replace(/\/+$/, '');
  const project =
    process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_ADMIN_PROJECT_ID || 'seriph';
  return `https://${project}.web.app`;
}

/** Storage path for a served (web) artifact: s/<slug>/<version>/<filename>.
 *  `version` is a cache-bust segment — a short content hash or numeric version. */
export function servedPath(slug: string, version: string | number, filename: string): string {
  return `s/${slug}/${version}/${filename}`;
}

/** Storage path for an original (download) artifact: d/<slug>/<version>/<filename>. */
export function originalPath(slug: string, version: string | number, filename: string): string {
  return `d/${slug}/${version}/${filename}`;
}

/** Build the full, stable CDN url for a storage path. */
export function cdnUrl(storagePath: string): string {
  return `${cdnBaseUrl()}/${storagePath}`;
}
