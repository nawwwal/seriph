import { createHash } from "crypto";
import { getFirestore, type Firestore, type Query } from "firebase-admin/firestore";
import type { FontFamilyDoc } from "../models/catalog.models";
import { currentEnrichmentVersions, isEnrichedAtCurrentVersion } from "../ai/enrich/parse";
import { catalogFamilyDocId } from "../storage/catalogIdentity";
import { FAMILIES_COLLECTION } from "../storage/familyStore";
import { ensureQueuedEnrichmentJob } from "../enrichment/jobs/jobStore";

export interface BackfillEnrichmentArgs {
  ownerId: string;
  limit?: number;
  apply: boolean;
}

export interface BackfillEnrichmentReport {
  ownerId: string;
  scanned: number;
  eligible: number;
  wouldQueue: number;
  queued: number;
  requeued: number;
  skippedCurrent: number;
  skippedInactive: number;
  legacyIds: string[];
  failed: Array<{ id: string; error: string }>;
  apply: boolean;
}

export function parseBackfillEnrichmentArgs(argv: string[]): BackfillEnrichmentArgs {
  let ownerId: string | undefined;
  let limit: number | undefined;
  let apply = false;
  for (const arg of argv) {
    if (arg.startsWith("--ownerId=")) ownerId = arg.slice("--ownerId=".length).trim();
    else if (arg.startsWith("--limit=")) {
      const value = Number(arg.slice("--limit=".length));
      if (!Number.isSafeInteger(value) || value < 1) throw new Error("--limit must be a positive integer");
      limit = value;
    } else if (arg === "--apply") apply = true;
    else if (arg === "--dryRun") apply = false;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!ownerId) throw new Error("--ownerId is required");
  return { ownerId, ...(limit === undefined ? {} : { limit }), apply };
}

export function backfillBatchId(ownerId: string): string {
  const versions = currentEnrichmentVersions();
  const digest = createHash("sha256").update(JSON.stringify({ ownerId, versions })).digest("hex").slice(0, 24);
  return `enrichment-backfill-${digest}`;
}

function isInactive(family: FontFamilyDoc): boolean {
  return family.hidden === true || family.status === "merged" || Boolean(family.mergedInto || family.aliasOf)
    || !Array.isArray(family.faces) || family.faces.length === 0;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runBackfillEnrichment(
  args: BackfillEnrichmentArgs, db: Firestore = getFirestore(), now = new Date(),
): Promise<BackfillEnrichmentReport> {
  let query: Query = db.collection(FAMILIES_COLLECTION).where("ownerId", "==", args.ownerId);
  if (args.limit !== undefined) query = query.limit(args.limit);
  const snapshot = await query.get();
  const report: BackfillEnrichmentReport = {
    ownerId: args.ownerId, scanned: snapshot.size, eligible: 0, wouldQueue: 0, queued: 0, requeued: 0,
    skippedCurrent: 0, skippedInactive: 0, legacyIds: [], failed: [], apply: args.apply,
  };
  const batchId = backfillBatchId(args.ownerId);

  for (const doc of snapshot.docs) {
    const family = { ...doc.data(), id: doc.id } as FontFamilyDoc;
    if (doc.id !== catalogFamilyDocId(args.ownerId, family.slug)) {
      report.legacyIds.push(doc.id);
      continue;
    }
    if (isInactive(family)) {
      report.skippedInactive += 1;
      continue;
    }
    report.eligible += 1;
    if (isEnrichedAtCurrentVersion(family)) {
      report.skippedCurrent += 1;
      continue;
    }
    report.wouldQueue += 1;
    if (!args.apply) continue;
    try {
      const versions = currentEnrichmentVersions();
      const result = await ensureQueuedEnrichmentJob(db, {
        ownerId: args.ownerId,
        batchId,
        familyId: family.slug,
        familyVersion: Number(family.version ?? 0),
        planVersion: 0,
        analysisModel: versions.analysisModel,
        promptVersion: versions.promptVersion,
        embeddingVersion: versions.embedVersion,
        now,
      }, {
        kind: "backfill",
        source: "backfill-enrichment-jobs",
        reason: "missing_or_stale_current_enrichment",
        familyVersion: Number(family.version ?? 0),
        requestedAt: now.toISOString(),
      });
      if (result.created) report.queued += 1;
      if (result.requeued) report.requeued += 1;
    } catch (error) {
      report.failed.push({ id: doc.id, error: errorText(error) });
    }
  }
  return report;
}

if (require.main === module) {
  import("../bootstrap/adminApp").then(() => {
    const args = parseBackfillEnrichmentArgs(process.argv.slice(2));
    return runBackfillEnrichment(args);
  }).then((report) => {
    console.log(JSON.stringify(report, null, 2));
    if (report.failed.length > 0) process.exitCode = 1;
  }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
