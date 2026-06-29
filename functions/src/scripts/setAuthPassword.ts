import { getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const MIN_PASSWORD_LENGTH = 8;

export interface SetAuthPasswordArgs {
  uid?: string;
  email?: string;
  password?: string;
  dryRun: boolean;
}

export type SetAuthPasswordRequest =
  | { uid: string; email?: undefined; password: string; dryRun: boolean }
  | { uid?: undefined; email: string; password: string; dryRun: boolean };

function valueAfterEquals(arg: string, prefix: string): string | undefined {
  if (!arg.startsWith(prefix)) return undefined;
  const value = arg.slice(prefix.length).trim();
  return value || undefined;
}

export function parseSetAuthPasswordArgs(argv: string[]): SetAuthPasswordArgs {
  const parsed: SetAuthPasswordArgs = { dryRun: false };
  for (const arg of argv) {
    if (arg === "--dryRun") parsed.dryRun = true;
    else if (arg.startsWith("--uid=")) parsed.uid = valueAfterEquals(arg, "--uid=");
    else if (arg.startsWith("--email=")) parsed.email = valueAfterEquals(arg, "--email=")?.toLowerCase();
    else if (arg.startsWith("--password=")) parsed.password = valueAfterEquals(arg, "--password=");
  }
  return parsed;
}

export function validateSetAuthPasswordArgs(args: SetAuthPasswordArgs): SetAuthPasswordRequest {
  const hasUid = Boolean(args.uid);
  const hasEmail = Boolean(args.email);
  if (hasUid === hasEmail) throw new Error("Pass exactly one of --uid=<uid> or --email=<email>.");
  if (!args.password || args.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error("Password must be at least 8 characters.");
  }
  if (hasUid && args.uid) return { uid: args.uid, password: args.password, dryRun: args.dryRun };
  if (hasEmail && args.email) return { email: args.email, password: args.password, dryRun: args.dryRun };
  throw new Error("Pass exactly one of --uid=<uid> or --email=<email>.");
}

function ensureAdminEnvDefaults(): void {
  if (!process.env.GOOGLE_CLOUD_PROJECT && !process.env.FIREBASE_ADMIN_PROJECT_ID) {
    process.env.GOOGLE_CLOUD_PROJECT = "seriph";
  }
}

export async function runSetAuthPassword(argv = process.argv.slice(2)): Promise<void> {
  ensureAdminEnvDefaults();
  if (!getApps().length) await import("../bootstrap/adminApp");

  const request = validateSetAuthPasswordArgs(parseSetAuthPasswordArgs(argv));
  const auth = getAuth();
  const user = request.email !== undefined
    ? await auth.getUserByEmail(request.email)
    : await auth.getUser(request.uid);

  if (request.dryRun) {
    console.log(`would set password for Firebase Auth user ${user.uid} (${user.email ?? "no email"})`);
    return;
  }

  await auth.updateUser(user.uid, { password: request.password });
  console.log(`set password for Firebase Auth user ${user.uid} (${user.email ?? "no email"})`);
}

if (require.main === module) {
  runSetAuthPassword().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
