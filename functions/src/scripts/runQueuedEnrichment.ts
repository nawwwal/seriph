import { getFirestore, type DocumentSnapshot } from "firebase-admin/firestore";
import { initializeRemoteConfig } from "../config/remoteConfig";
import { submitPendingEnrichmentBatch } from "../ingest/batch/submit";
import { currentEnrichmentVersions } from "../ai/enrich/parse";
import { ensureQueuedEnrichmentJob } from "../enrichment/jobs/jobStore";
import type { EnrichmentJob } from "../enrichment/jobs/jobTypes";
import { FAMILIES_COLLECTION } from "../storage/familyStore";
import { catalogFamilyDocCandidates } from "../storage/catalogIdentity";
import type { FontFamilyDoc } from "../models/catalog.models";

function parseArgs(argv: string[]): { ownerId?: string; slugs: string[] } {
  let ownerId: string | undefined;
  const slugs: string[] = [];
  for (const arg of argv) {
    if (arg.startsWith("--ownerId=")) ownerId = arg.slice("--ownerId=".length);
    if (arg.startsWith("--slugs=")) slugs.push(...arg.slice("--slugs=".length).split(",").map((s) => s.trim()).filter(Boolean));
  }
  return { ownerId, slugs };
}

async function queueSlugs(ownerId: string, slugs: string[]): Promise<EnrichmentJob[]> {
  const db = getFirestore();
  const versions = currentEnrichmentVersions();
  const now = new Date();
  const jobs: EnrichmentJob[] = [];
  for (const slug of slugs) {
    let snap: DocumentSnapshot | undefined;
    for (const id of catalogFamilyDocCandidates(ownerId, slug)) {
      const candidate = await db.collection(FAMILIES_COLLECTION).doc(id).get();
      if (candidate.exists) { snap = candidate; break; }
    }
    if (!snap?.exists) {
      console.error(`missing family ${slug}`);
      continue;
    }
    const family = { ...snap.data(), id: snap.id } as FontFamilyDoc;
    const result = await ensureQueuedEnrichmentJob(db, {
      ownerId,
      batchId: "jev-e2e",
      familyId: family.slug,
      familyVersion: Number(family.version ?? 0),
      planVersion: 0,
      analysisModel: versions.analysisModel,
      promptVersion: versions.promptVersion,
      embeddingVersion: versions.embedVersion,
      now,
    }, {
      kind: "backfill",
      source: "run-queued-enrichment",
      reason: "jev_e2e",
      familyVersion: Number(family.version ?? 0),
      requestedAt: now.toISOString(),
    });
    jobs.push(result.job);
  }
  return jobs;
}

async function run(): Promise<void> {
  await initializeRemoteConfig();
  const args = parseArgs(process.argv.slice(2));
  let jobs: EnrichmentJob[] = [];
  if (args.ownerId && args.slugs.length) {
    jobs = await queueSlugs(args.ownerId, args.slugs);
    console.log(JSON.stringify({ queued: jobs.length, slugs: args.slugs }));
  }
  const result = await submitPendingEnrichmentBatch(jobs.length ? jobs : undefined);
  console.log(JSON.stringify(result));
}

if (require.main === module) {
  import("../bootstrap/adminApp")
    .then(() => run())
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
