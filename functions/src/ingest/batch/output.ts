import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";
import { CATALOG_KEY_PREFIX, parseAnalysis, buildEnrichmentUpdate } from "../../ai/enrichFont";
import { FAMILIES_COLLECTION } from "../../storage/familyStore";
import type { FontFamilyDoc, FontEnrichment } from "../../models/catalog.models";

/** Mark every ingest pointing at a family as fully complete (best-effort). */
export async function finalizeIngestsForFamily(familyId: string): Promise<void> {
  const db = getFirestore();
  try {
    const snap = await db.collectionGroup("ingests").where("familyId", "==", familyId).get();
    await Promise.all(
      snap.docs.map((d) =>
        d.ref.update({ analysisState: "complete", status: "completed", updatedAt: FieldValue.serverTimestamp() })
      )
    );
  } catch (e: any) {
    logger.warn(`[batch] failed to finalize ingests for ${familyId}`, { message: e?.message });
  }
}

/** Pull the slug back out of an echoed batch request via the Catalog-Key marker. */
function slugFromRequest(request: any): string | null {
  const parts = request?.contents?.[0]?.parts ?? [];
  for (const p of parts) {
    const t: string | undefined = p?.text;
    if (t && t.includes(CATALOG_KEY_PREFIX)) {
      const m = t.match(new RegExp(`${CATALOG_KEY_PREFIX}\\s*(\\S+)`));
      if (m) return m[1];
    }
  }
  return null;
}

/** Read every JSONL line written under a finished job's output prefix. */
export async function readOutputLines(bucket: string, outputPrefix: string): Promise<any[]> {
  const [files] = await getStorage().bucket(bucket).getFiles({ prefix: outputPrefix });
  const jsonl = files.filter((f) => f.name.endsWith(".jsonl"));
  const rows: any[] = [];
  for (const file of jsonl) {
    const [buf] = await file.download();
    for (const line of buf.toString("utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        rows.push(JSON.parse(trimmed));
      } catch {
        // skip malformed line
      }
    }
  }
  return rows;
}

/** Apply one batch output row to its family: parse analysis, embed inline, write. */
export async function applyOutputRow(row: any): Promise<boolean> {
  const slug = slugFromRequest(row?.request);
  if (!slug) {
    logger.warn("[batch] output row missing Catalog-Key; cannot map to family.");
    return false;
  }
  const db = getFirestore();
  const ref = db.collection(FAMILIES_COLLECTION).doc(slug);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const family = snap.data() as FontFamilyDoc;

  const text: string | undefined = row?.response?.candidates?.[0]?.content?.parts?.[0]?.text;
  const enrichment: FontEnrichment | null = parseAnalysis(family, text);
  if (!enrichment) {
    await ref.set({ status: "ready", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return false;
  }

  const update = await buildEnrichmentUpdate(family, enrichment);
  await ref.set(update, { merge: true });
  await finalizeIngestsForFamily(slug);
  return true;
}
