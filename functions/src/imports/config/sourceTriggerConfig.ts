import { resolveStorageBucket } from "../../bootstrap/storageBucket";

type StorageBucketEnv = Record<string, string | undefined>;

/**
 * Cloud Storage bucket bound to the finalized-import trigger.
 *
 * Firebase evaluates trigger options while loading the module, so use the
 * normal Admin bucket resolution and retain the deterministic test fallback.
 */
export function resolveImportTriggerBucket(env: StorageBucketEnv = process.env): string {
  return resolveStorageBucket(env) ?? "unit-test-bucket";
}
