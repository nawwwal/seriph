import { logger } from "firebase-functions";
import { embeddingModelId, embeddingDims } from "../embeddings";
import { RC_KEYS } from "../../config/rcKeys";
import { getConfigValue } from "../../config/remoteConfig";
import type { FontEnrichment, FontFamilyDoc } from "../../models/catalog.models";
import type { GfCategory } from "../../storage/canonicalize";
import { PROMPT_VERSION } from "./schema";
import { isSearchIndexedAtVersion } from "../../search/searchDocument";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

/** Parse the model's JSON text into a FontEnrichment. Shared by realtime + batch. */
export function parseAnalysis(family: FontFamilyDoc, text: string | undefined | null): FontEnrichment | null {
  const trimmed = text?.trim?.();
  if (!trimmed) return null;
  let data: unknown;
  try {
    data = JSON.parse(trimmed.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim());
  } catch {
    logger.warn(`[enrich ${family.slug}] analysis returned non-JSON`);
    return null;
  }
  if (!isRecord(data)) return null;
  return {
    category: (stringField(data, "category") as GfCategory | undefined) || family.category,
    suggestedDisplayName: stringField(data, "suggestedDisplayName"),
    classification: stringField(data, "classification"),
    summary: stringField(data, "summary"),
    moods: stringArray(data, "moods"),
    voice: stringField(data, "voice"),
    useCases: stringArray(data, "useCases"),
    pairingHints: stringArray(data, "pairingHints"),
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
    prior?.embeddingVersion === v.embedVersion &&
    isSearchIndexedAtVersion(family, { embeddingVersion: v.embedVersion, promptVersion: v.promptVersion })
  );
}
