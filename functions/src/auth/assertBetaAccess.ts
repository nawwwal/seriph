import type { Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/identity";
import { logger } from "firebase-functions";
import { isBetaEmailAllowedInStore } from "./betaAllowlistStore";

/** User-facing message for blocked sign-up / sign-in / email flows. */
export const BETA_ACCESS_DENIED_MESSAGE =
  "Seriph is in closed beta. This email is not on the invite list.";

/**
 * Throws permission-denied when the email is missing or not allowlisted.
 * Reads the live list from Firestore (no function redeploy to change invites).
 * Fails closed if the store cannot be read.
 */
export async function assertBetaAccess(
  db: Firestore,
  email: string | null | undefined
): Promise<void> {
  try {
    if (await isBetaEmailAllowedInStore(db, email)) return;
  } catch (error) {
    logger.error("beta allowlist lookup failed; denying access", {
      message: error instanceof Error ? error.message : String(error),
    });
    throw new HttpsError("permission-denied", BETA_ACCESS_DENIED_MESSAGE);
  }
  throw new HttpsError("permission-denied", BETA_ACCESS_DENIED_MESSAGE);
}
