import { logger } from "firebase-functions";
import type { Firestore } from "firebase-admin/firestore";
import type { FontEnrichment, FontFamilyDoc } from "../../../models/catalog.models";
import { RC_KEYS } from "../../../config/rcKeys";
import { getConfigBoolean } from "../../../config/remoteConfig";
import { FAMILIES_COLLECTION } from "../../../storage/familyStore";
import { applyStructuredFilters } from "../../../search/searchFilters";
import { runVectorLane } from "../../../search/searchLanes";
import { asNumberVector } from "../../../search/vectorValue";
import { evaluateSystemOne, nearestScoreLevel, questionId } from "../client";
import { compactNeighbor, ownerFamilyNeighbors } from "../neighbors";
import { PAIR_LEVELS, scoreQuestion } from "../score";

const PAIR_LIMIT = 4;

async function pairingCandidates(db: Firestore, family: FontFamilyDoc): Promise<Array<{ id: string; slug: string; name: string; summary?: string }>> {
  const vector = asNumberVector(family.text_vec);
  const fromVector = vector
    ? (await runVectorLane(applyStructuredFilters(db.collection(FAMILIES_COLLECTION), { filters: { ownerId: family.ownerId } }), "text", vector, 10))
      .flatMap((doc) => {
        const item = compactNeighbor(doc.id, doc.data());
        return item && item.id !== family.id && item.slug !== family.slug ? [item] : [];
      })
    : [];
  if (fromVector.length) return fromVector.slice(0, 10);
  return (await ownerFamilyNeighbors(db, family, 10)).map((item) => ({
    id: item.id, slug: item.slug, name: item.name, summary: item.enrichment?.summary,
  }));
}

export async function pairFamilyWithJev(
  db: Firestore,
  family: FontFamilyDoc,
  enrichment: FontEnrichment,
): Promise<FontEnrichment> {
  if (!getConfigBoolean(RC_KEYS.jevPairingEnabled, false) || !family.ownerId) return enrichment;
  if (enrichment.pairingFamilyIds?.length) return enrichment;
  try {
    const candidates = await pairingCandidates(db, family);
    if (!candidates.length) return { ...enrichment, pairingFamilyIds: [], pairingFamilies: [] };
    const questions: Record<string, unknown> = {};
    for (const candidate of candidates) {
      questions[questionId("p", candidate.id)] = scoreQuestion(
        `How strong a pair is candidate ${candidate.id} (${candidate.name}) with \`source\`? Judge only that candidate.`,
        PAIR_LEVELS,
      );
    }
    const judged = await evaluateSystemOne({
      source: { name: family.name, classification: enrichment.searchClass ?? enrichment.classification, summary: enrichment.summary },
      candidates,
    }, questions);
    const pairingFamilies = candidates
      .map((candidate, index) => ({
        ...candidate,
        level: nearestScoreLevel(judged, questionId("p", candidate.id), PAIR_LEVELS.length),
        index,
      }))
      .filter((candidate) => candidate.level >= 1)
      .sort((a, b) => b.level - a.level || a.index - b.index)
      .slice(0, PAIR_LIMIT)
      .map(({ id, slug, name }) => ({ id, slug, name }));
    return { ...enrichment, pairingFamilyIds: pairingFamilies.map((item) => item.id), pairingFamilies };
  } catch (error) {
    logger.warn(`[enrich ${family.slug}] jev pairing failed; storing no pairs`, {
      message: error instanceof Error ? error.message : String(error),
    });
    return { ...enrichment, pairingFamilyIds: [], pairingFamilies: [] };
  }
}
