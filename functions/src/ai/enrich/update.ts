import { getStorage } from "firebase-admin/storage";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { renderSpecimen } from "../../render/specimen";
import { embedText, embeddingModelId, embeddingDims } from "../embeddings";
import { publicBucketName } from "../../config/catalogConfig";
import type { FontEnrichment, FontFamilyDoc } from "../../models/catalog.models";
import { PROMPT_VERSION, buildEmbeddingText, buildMoodEmbeddingText, buildUseCaseEmbeddingText } from "./schema";
import { buildSearchDocument } from "../../search/searchDocument";

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
  const hasAnyVector = Boolean(textVec || moodVec || useCaseVec);
  const embeddingModel = hasAnyVector ? embeddingModelId() : undefined;
  const embeddingVersion = hasAnyVector ? `${embeddingModelId()}:${embeddingDims()}` : undefined;
  const searchDoc = embeddingVersion
    ? buildSearchDocument({ ...family, enrichment }, { embeddingModel, embeddingVersion, promptVersion: enrichment.promptVersion ?? PROMPT_VERSION })
    : {};
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
    status: "enriched",
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (textVec) update.text_vec = FieldValue.vector(textVec);
  if (moodVec) update.mood_vec = FieldValue.vector(moodVec);
  if (useCaseVec) update.use_case_vec = FieldValue.vector(useCaseVec);
  return update;
}
