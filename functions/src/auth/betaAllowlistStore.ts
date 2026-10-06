import type { Firestore } from "firebase-admin/firestore";
import {
  BETA_ALLOWLIST_COLLECTION,
  normalizeBetaEmail,
} from "./betaAllowlist";

/** Short in-process cache so a warm instance skips Firestore on every attempt. */
const CACHE_TTL_MS = 30_000;
// Leave time for token verification and the response within Auth's 7s limit.
const LOOKUP_TIMEOUT_MS = 2_500;
const cache = new Map<string, { allowed: boolean; expiresAt: number }>();

export function clearBetaAllowlistCache(): void {
  cache.clear();
}

export async function isBetaEmailAllowedInStore(
  db: Firestore,
  email: string | null | undefined
): Promise<boolean> {
  const normalized = normalizeBetaEmail(email);
  if (!normalized) return false;

  const hit = cache.get(normalized);
  if (hit && hit.expiresAt > Date.now()) return hit.allowed;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const read = db.collection(BETA_ALLOWLIST_COLLECTION).doc(normalized).get();
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Beta allowlist lookup timed out")), LOOKUP_TIMEOUT_MS);
  });
  const snap = await Promise.race([read, deadline]).finally(() => clearTimeout(timer));
  const allowed = snap.exists;
  cache.set(normalized, { allowed, expiresAt: Date.now() + CACHE_TTL_MS });
  return allowed;
}
