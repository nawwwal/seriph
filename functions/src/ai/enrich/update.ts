import { getStorage } from "firebase-admin/storage";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { renderSpecimen } from "../../render/specimen";
import { embedText, embeddingModelId, embeddingDims } from "../embeddings";
import { publicBucketName } from "../../config/catalogConfig";
import type { FontEnrichment, FontFamilyDoc } from "../../models/catalog.models";
import { buildEmbeddingText } from "./schema";

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
  const vec = await embedText(buildEmbeddingText(family, enrichment), "RETRIEVAL_DOCUMENT");
  const update: Record<string, unknown> = {
    enrichment: {
      ...enrichment,
      embeddingModel: vec ? embeddingModelId() : undefined,
      embeddingVersion: vec ? `${embeddingModelId()}:${embeddingDims()}` : undefined,
      enrichedAt: FieldValue.serverTimestamp(),
    },
    status: "enriched",
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (vec) update.text_vec = FieldValue.vector(vec);
  return update;
}
