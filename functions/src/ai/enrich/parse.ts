import { logger } from "firebase-functions";
import { embeddingModelId, embeddingDims } from "../embeddings";
import { RC_KEYS } from "../../config/rcKeys";
import { getConfigValue } from "../../config/remoteConfig";
import type { FontEnrichment, FontFamilyDoc } from "../../models/catalog.models";
import type { GfCategory } from "../../storage/canonicalize";
import { PROMPT_VERSION } from "./schema";

/** Parse the model's JSON text into a FontEnrichment. Shared by realtime + batch. */
export function parseAnalysis(family: FontFamilyDoc, text: string | undefined | null): FontEnrichment | null {
  const trimmed = text?.trim?.();
  if (!trimmed) return null;
  let data: any;
  try {
    data = JSON.parse(trimmed.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim());
  } catch {
    logger.warn(`[enrich ${family.slug}] analysis returned non-JSON`);
    return null;
  }
  return {
    category: (data.category as GfCategory) || family.category,
    classification: data.classification,
    summary: data.summary,
    moods: Array.isArray(data.moods) ? data.moods : [],
    voice: data.voice,
    useCases: Array.isArray(data.useCases) ? data.useCases : [],
    pairingHints: Array.isArray(data.pairingHints) ? data.pairingHints : [],
    confidence: typeof data.confidence === "number" ? data.confidence : undefined,
    modelId: getConfigValue(RC_KEYS.analysisModelName, ""),
    promptVersion: PROMPT_VERSION,
  };
}

/** Current model/prompt/embedding identity — used for the idempotency guard. */
export function currentEnrichmentVersions(): { analysisModel: string; promptVersion: string; embedVersion: string } {
  return {
    analysisModel: getConfigValue(RC_KEYS.analysisModelName, ""),
    promptVersion: PROMPT_VERSION,
    embedVersion: `${embeddingModelId()}:${embeddingDims()}`,
  };
}

/** True when the family is already enriched at the current model/prompt/embedding. */
export function isEnrichedAtCurrentVersion(family: FontFamilyDoc): boolean {
  const prior = family.enrichment;
  const v = currentEnrichmentVersions();
  return (
    family.status === "enriched" &&
    prior?.promptVersion === v.promptVersion &&
    prior?.modelId === v.analysisModel &&
    prior?.embeddingVersion === v.embedVersion
  );
}
