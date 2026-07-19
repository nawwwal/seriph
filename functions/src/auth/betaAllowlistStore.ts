import type { Firestore } from "firebase-admin/firestore";
import {
  BETA_ALLOWLIST_COLLECTION,
  normalizeBetaEmail,
} from "./betaAllowlist";

/** Short in-process cache so a warm instance skips Firestore on every attempt. */
const CACHE_TTL_MS = 30_000;
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

  const snap = await db.collection(BETA_ALLOWLIST_COLLECTION).doc(normalized).get();
  const allowed = snap.exists;
  cache.set(normalized, { allowed, expiresAt: Date.now() + CACHE_TTL_MS });
  return allowed;
}
