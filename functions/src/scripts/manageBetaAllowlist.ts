import { getApps } from "firebase-admin/app";
import { FieldValue } from "firebase-admin/firestore";
import {
  BETA_ALLOWLIST_COLLECTION,
  BETA_ALLOWLIST_SEED,
  normalizeBetaEmail,
} from "../auth/betaAllowlist";

export type ManageBetaArgs = {
  list: boolean;
  seed: boolean;
  dryRun: boolean;
  add?: string;
  remove?: string;
};

function valueAfterEquals(arg: string, prefix: string): string | undefined {
  if (!arg.startsWith(prefix)) return undefined;
  const value = arg.slice(prefix.length).trim();
  return value || undefined;
}

export function parseManageBetaArgs(argv: string[]): ManageBetaArgs {
  const parsed: ManageBetaArgs = { list: false, seed: false, dryRun: false };
  for (const arg of argv) {
    if (arg === "--list") parsed.list = true;
    else if (arg === "--seed") parsed.seed = true;
    else if (arg === "--dryRun") parsed.dryRun = true;
    else if (arg.startsWith("--add=")) parsed.add = valueAfterEquals(arg, "--add=");
    else if (arg.startsWith("--remove=")) parsed.remove = valueAfterEquals(arg, "--remove=");
  }
  return parsed;
}

export function validateManageBetaArgs(args: ManageBetaArgs): ManageBetaArgs {
  const actions = [args.list, args.seed, Boolean(args.add), Boolean(args.remove)].filter(Boolean);
  if (actions.length !== 1) {
    throw new Error("Pass exactly one of --list, --seed, --add=<email>, or --remove=<email>.");
  }
  if (args.add && !normalizeBetaEmail(args.add)) throw new Error("--add requires an email.");
  if (args.remove && !normalizeBetaEmail(args.remove)) throw new Error("--remove requires an email.");
  return args;
}

function ensureAdminEnvDefaults(): void {
  if (!process.env.GOOGLE_CLOUD_PROJECT && !process.env.FIREBASE_ADMIN_PROJECT_ID) {
    process.env.GOOGLE_CLOUD_PROJECT = "seriph";
  }
}

export async function runManageBetaAllowlist(argv = process.argv.slice(2)): Promise<void> {
  ensureAdminEnvDefaults();
  if (!getApps().length) await import("../bootstrap/adminApp");
  const { db } = await import("../bootstrap/adminApp");
  const args = validateManageBetaArgs(parseManageBetaArgs(argv));
  const col = db.collection(BETA_ALLOWLIST_COLLECTION);

  if (args.list) {
    const snap = await col.get();
    const emails = snap.docs.map((d) => d.id).sort();
    console.log(emails.length ? emails.join("\n") : "(empty)");
    return;
  }

  if (args.seed) {
    for (const raw of BETA_ALLOWLIST_SEED) {
      const email = normalizeBetaEmail(raw);
      if (args.dryRun) {
        console.log(`would seed ${email}`);
        continue;
      }
      await col.doc(email).set(
        { email, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      console.log(`seeded ${email}`);
    }
    return;
  }

  if (args.add) {
    const email = normalizeBetaEmail(args.add);
    if (args.dryRun) {
      console.log(`would add ${email}`);
      return;
    }
    await col.doc(email).set(
      { email, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    console.log(`added ${email}`);
    return;
  }

  if (args.remove) {
    const email = normalizeBetaEmail(args.remove);
    if (args.dryRun) {
      console.log(`would remove ${email}`);
      return;
    }
    await col.doc(email).delete();
    console.log(`removed ${email}`);
  }
}

if (require.main === module) {
  runManageBetaAllowlist().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
