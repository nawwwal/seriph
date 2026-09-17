import { logger } from "firebase-functions";
import type { FontEnrichment, FontFamilyDoc } from "../../models/catalog.models";
import { RC_KEYS } from "../../config/rcKeys";
import { getConfigBoolean } from "../../config/remoteConfig";
import { parseAnalysis } from "./parse";
import { verifyGeminiFields } from "../jev/verify/fields";
import { labelFamilyWithJev } from "../jev/label";

export type FamilyLabeler = (family: FontFamilyDoc, enrichment: FontEnrichment) => Promise<FontEnrichment>;

export async function composeEnrichment(
  family: FontFamilyDoc,
  text: string | undefined | null,
  labeler: FamilyLabeler = labelFamilyWithJev,
): Promise<FontEnrichment | null> {
  const parsed = parseAnalysis(family, text);
  if (!parsed) return null;
  const verified = await verifyGeminiFields(family, parsed);
  if (!getConfigBoolean(RC_KEYS.jevEnrichmentEnabled, false)) return verified;
  try {
    return await labeler(family, verified);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`[enrich ${family.slug}] jev labeling failed; keeping Gemini labels`, { message });
    return verified;
  }
}
