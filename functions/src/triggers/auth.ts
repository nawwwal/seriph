import {
  beforeEmailSent,
  beforeUserCreated,
  beforeUserSignedIn,
  type AuthBlockingEvent,
} from "firebase-functions/v2/identity";
import { db } from "../bootstrap/adminApp";
import { assertBetaAccess } from "../auth/assertBetaAccess";

function eventEmail(event: AuthBlockingEvent): string | null | undefined {
  return event.data?.email ?? event.additionalUserInfo?.email;
}

/**
 * Closed-beta gate: reject account creation unless email is allowlisted
 * in Firestore `betaAllowlist/{email}`. Manage via:
 *   npm run auth:beta-allowlist -- --list|--add=|--remove=
 */
export const beforecreated = beforeUserCreated(async (event) => {
  await assertBetaAccess(db, eventEmail(event));
});

export const beforesignedin = beforeUserSignedIn(async (event) => {
  await assertBetaAccess(db, eventEmail(event));
});

export const beforeemailsent = beforeEmailSent(async (event) => {
  await assertBetaAccess(db, eventEmail(event));
});
