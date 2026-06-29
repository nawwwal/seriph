/**
 * Enrichment helpers (barrel). One structured multimodal Gemini pass per family
 * produces moods/summary/use-cases; the result is embedded and written back with
 * a search vector. Submission/polling live in ../ingest/batch/*; the shared
 * building blocks live in ./enrich/{schema,parse,update}.
 *
 * Fail-safe: any failure leaves the family at `ready` with its deterministic
 * metadata intact — a font is never made worse by enrichment.
 */
export {
  PROMPT_VERSION,
  CATALOG_KEY_PREFIX,
  ANALYSIS_SCHEMA,
  buildPrompt,
  buildEmbeddingText,
  buildMoodEmbeddingText,
  buildUseCaseEmbeddingText,
} from "./enrich/schema";
export { parseAnalysis, currentEnrichmentVersions, isEnrichedAtCurrentVersion } from "./enrich/parse";
export { renderFamilySpecimen, buildEnrichmentUpdate } from "./enrich/update";
