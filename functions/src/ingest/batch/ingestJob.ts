import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { FontFamilyDoc } from "../../models/catalog.models";

const ACTIVE_ANALYSIS = new Set(["queued", "analyzing", "processing"]);

export async function tagIngestsForBatch(families: FontFamilyDoc[], jobId: string): Promise<void> {
  const db = getFirestore();
  await Promise.all(families.map(async (family) => {
    const snap = await db.collectionGroup("ingests").where("familyId", "==", family.id).get();
    await Promise.all(snap.docs.map((doc) => {
      const state = doc.get("analysisState");
      if (typeof state === "string" && !ACTIVE_ANALYSIS.has(state)) return Promise.resolve();
      return doc.ref.set({
        enrichmentJobId: jobId,
        enrichmentJobVersion: family.version ?? 1,
        analysisState: "analyzing",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }));
  }));
}
