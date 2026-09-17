import { createHash } from "crypto";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import type { FontFamilyDoc } from "../../../models/catalog.models";
import { RC_KEYS } from "../../../config/rcKeys";
import { getConfigBoolean } from "../../../config/remoteConfig";
import { ownerFamilyNeighbors } from "../neighbors";
import { judgeMergePair, type MergePairInput } from "./judge";

export const MERGE_SUGGESTIONS_COLLECTION = "familyMergeSuggestions";

function suggestionId(ownerId: string, a: string, b: string): string {
  const [left, right] = [a, b].sort();
  return createHash("sha256").update(`${ownerId}\n${left}\n${right}`).digest("hex");
}

function pairInput(family: FontFamilyDoc): MergePairInput {
  return {
    id: family.id,
    name: family.name,
    foundry: family.foundry ?? family.designer ?? null,
    styles: (family.faces ?? []).map((face) => face.styleName),
  };
}

export async function suggestFamilyMerges(db: Firestore, family: FontFamilyDoc): Promise<void> {
  if (!getConfigBoolean(RC_KEYS.jevMergeSuggestEnabled, false) || !family.ownerId) return;
  try {
    const candidates = await ownerFamilyNeighbors(db, family, 8);
    if (!candidates.length) return;
    const source = pairInput(family);
    const writes = [];
    for (const candidate of candidates) {
      const judged = await judgeMergePair(source, pairInput(candidate));
      if (!judged) continue;
      writes.push({
        ref: db.collection(MERGE_SUGGESTIONS_COLLECTION).doc(suggestionId(family.ownerId!, family.id, candidate.id)),
        data: {
          ownerId: family.ownerId,
          familyIds: [family.id, candidate.id].sort(),
          slugs: [family.slug, candidate.slug],
          names: [family.name, candidate.name],
          verdict: judged.level >= 2 ? "same" : "related",
          score: judged.level,
          nameAlign: judged.nameAlign,
          foundryAlign: judged.foundryAlign,
          styleAlign: judged.styleAlign,
          createdAt: FieldValue.serverTimestamp(),
        },
      });
    }
    await Promise.all(writes.map((write) => write.ref.set(write.data, { merge: true })));
  } catch (error) {
    logger.warn(`[enrich ${family.slug}] jev merge suggest failed`, {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
