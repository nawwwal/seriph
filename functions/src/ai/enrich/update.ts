import { getStorage } from "firebase-admin/storage";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { renderSpecimen } from "../../render/specimen";
import { embedText, embeddingModelId, embeddingDims } from "../embeddings";
import { publicBucketName } from "../../config/catalogConfig";
import type { FontEnrichment, FontFamilyDoc } from "../../models/catalog.models";
import { PROMPT_VERSION, buildEmbeddingText, buildMoodEmbeddingText, buildUseCaseEmbeddingText } from "./schema";
import { buildSearchDocument } from "../../search/searchDocument";

export function buildManualMergeDisplayNameUpdate(
  family: FontFamilyDoc,
  enrichment: FontEnrichment
): Record<string, unknown> {
  if (family.manualMerge?.displayNamePending !== true || !enrichment.suggestedDisplayName?.trim()) return {};
  return {
    name: enrichment.suggestedDisplayName.trim(),
    manualMerge: { displayNamePending: false },
  };
}

/** Download the cover face and render its specimen PNG (null on any failure). */
export async function renderFamilySpecimen(family: FontFamilyDoc): Promise<Buffer | null> {
  const cover = family.faces.find((f) => f.id === family.coverFaceId) || family.faces[0];
  if (!cover) return null;
  try {
    const [buf] = await getStorage().bucket(publicBucketName()).file(cover.original.storagePath).download();
    return renderSpecimen(buf)?.png ?? null;
  } catch (e: any) {
    logger.warn(`[enrich ${family.slug}] specimen render failed`, { message: e?.message });
    return null;
  }
}

/** Embed enrichment text + build the family doc update written after analysis. */
export async function buildEnrichmentUpdate(
  family: FontFamilyDoc,
  enrichment: FontEnrichment
): Promise<Record<string, unknown>> {
  const [textVec, moodVec, useCaseVec] = await Promise.all([
    embedText(buildEmbeddingText(family, enrichment), "RETRIEVAL_DOCUMENT"),
    embedText(buildMoodEmbeddingText(family, enrichment), "RETRIEVAL_DOCUMENT"),
    embedText(buildUseCaseEmbeddingText(family, enrichment), "RETRIEVAL_DOCUMENT"),
  ]);
  const embeddingModel = embeddingModelId();
  const embeddingVersion = `${embeddingModel}:${embeddingDims()}`;
  if (!textVec || !moodVec || !useCaseVec) {
    return {
      enrichment: { ...enrichment, embeddingModel, embeddingVersion, enrichedAt: FieldValue.serverTimestamp() },
      searchText: FieldValue.delete(),
      searchTokens: FieldValue.delete(),
      searchMeta: FieldValue.delete(),
      text_vec: FieldValue.delete(),
      mood_vec: FieldValue.delete(),
      use_case_vec: FieldValue.delete(),
      searchIndexState: "retry",
      searchIndexError: "missing_vector_lane",
      status: "ready",
      updatedAt: FieldValue.serverTimestamp(),
    };
  }
  const searchDoc = buildSearchDocument(
    { ...family, enrichment },
    { embeddingModel, embeddingVersion, promptVersion: enrichment.promptVersion ?? PROMPT_VERSION }
  );
  const update: Record<string, unknown> = {
    enrichment: {
      ...enrichment,
      embeddingModel,
      embeddingVersion,
      enrichedAt: FieldValue.serverTimestamp(),
    },
    ...searchDoc,
    ...(searchDoc.searchMeta
      ? {
          searchMeta: {
            ...searchDoc.searchMeta,
            generatedAt: FieldValue.serverTimestamp(),
          },
        }
      : {}),
    searchIndexState: "ready",
    searchIndexError: FieldValue.delete(),
    status: "enriched",
    updatedAt: FieldValue.serverTimestamp(),
    ...buildManualMergeDisplayNameUpdate(family, enrichment),
  };
  update.text_vec = FieldValue.vector(textVec);
  update.mood_vec = FieldValue.vector(moodVec);
  update.use_case_vec = FieldValue.vector(useCaseVec);
  return update;
}
