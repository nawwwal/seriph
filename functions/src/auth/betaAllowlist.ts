/** Firestore collection: one doc per invited email (doc id = normalized email). */
export const BETA_ALLOWLIST_COLLECTION = "betaAllowlist";

/** Default seed for closed beta (used by manage script --seed). */
export const BETA_ALLOWLIST_SEED: readonly string[] = [
  "heropopat46@gmail.com",
  "tanujpatel106@gmail.com",
  "nawaladitya7@gmail.com",
];

export function normalizeBetaEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/** Pure check against an in-memory set of normalized emails. */
export function isEmailInAllowlist(
  email: string | null | undefined,
  allowed: ReadonlySet<string>
): boolean {
  const normalized = normalizeBetaEmail(email);
  return normalized.length > 0 && allowed.has(normalized);
}
