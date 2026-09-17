import { logger } from "firebase-functions";
import type { FontEnrichment, FontFamilyDoc } from "../../../models/catalog.models";
import { RC_KEYS } from "../../../config/rcKeys";
import { getConfigBoolean } from "../../../config/remoteConfig";
import { evaluateSystemOne, noulValue, questionId } from "../client";

const HINT_THRESHOLD = 0.7;

function pairingQuestions(hints: string[]): Record<string, unknown> {
  const questions: Record<string, unknown> = {
    summary_this_family: {
      type: "noul",
      instructions: "Does `summary` describe this family (name, class, styles) rather than a different typeface?",
      criteria: { true: "Summary matches this family.", false: "Summary is about another typeface or is unusable." },
    },
  };
  hints.forEach((hint, index) => {
    questions[questionId("pair", String(index))] = {
      type: "noul",
      instructions: `Is pairing hint ${index} a pair-kind (serif, grotesque, mono, display), not poetry?`,
      criteria: { true: "Names a kind of typeface to pair with.", false: "Mood copy or unrelated prose." },
    };
  });
  return questions;
}

export async function verifyGeminiFields(family: FontFamilyDoc, enrichment: FontEnrichment): Promise<FontEnrichment> {
  if (!getConfigBoolean(RC_KEYS.jevVerifyEnabled, false)) return enrichment;
  const hints = enrichment.pairingHints ?? [];
  try {
    const questions = pairingQuestions(hints);
    if (family.manualMerge?.displayNamePending && enrichment.suggestedDisplayName) {
      questions.display_name_cleaner = {
        type: "noul",
        instructions: "Is `suggestedDisplayName` actually a cleaner visible name than `family.name`?",
        criteria: { true: "Clearer family name.", false: "Not cleaner, or invents a foundry prefix." },
      };
    }
    const result = await evaluateSystemOne({
      family: { name: family.name, classification: family.classification ?? null, styles: family.faces.map((face) => face.styleName) },
      summary: enrichment.summary ?? "",
      pairingHints: hints,
      suggestedDisplayName: enrichment.suggestedDisplayName ?? "",
    }, questions);
    const next = { ...enrichment };
    if (noulValue(result, "summary_this_family") < HINT_THRESHOLD) delete next.summary;
    next.pairingHints = hints.filter((_, index) => noulValue(result, questionId("pair", String(index))) >= HINT_THRESHOLD);
    if (questions.display_name_cleaner && noulValue(result, "display_name_cleaner") < HINT_THRESHOLD) delete next.suggestedDisplayName;
    return next;
  } catch (error) {
    logger.warn(`[enrich ${family.slug}] jev verify failed; keeping Gemini fields`, {
      message: error instanceof Error ? error.message : String(error),
    });
    return enrichment;
  }
}
