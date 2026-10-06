import {
  beforeEmailSent,
  beforeUserCreated,
  beforeUserSignedIn,
  type AuthBlockingEvent,
} from "firebase-functions/v2/identity";
import { db } from "../bootstrap/adminApp";
import { assertBetaAccess } from "../auth/assertBetaAccess";

const AUTH_FUNCTION_OPTIONS = {
  region: "us-central1",
  memory: "512MiB" as const,
  cpu: 1,
  minInstances: 0,
  maxInstances: 20,
  timeoutSeconds: 7,
};

function eventEmail(event: AuthBlockingEvent): string | null | undefined {
  return event.data?.email ?? event.additionalUserInfo?.email;
}

/**
 * Closed-beta gate: reject account creation unless email is allowlisted
 * in Firestore `betaAllowlist/{email}`. Manage via:
 *   npm run auth:beta-allowlist -- --list|--add=|--remove=
 */
export const beforecreated = beforeUserCreated(AUTH_FUNCTION_OPTIONS, async (event) => {
  await assertBetaAccess(db, eventEmail(event));
});

export const beforesignedin = beforeUserSignedIn(AUTH_FUNCTION_OPTIONS, async (event) => {
  await assertBetaAccess(db, eventEmail(event));
});

export const beforeemailsent = beforeEmailSent(AUTH_FUNCTION_OPTIONS, async (event) => {
  await assertBetaAccess(db, eventEmail(event));
});
