import { FieldValue } from "firebase-admin/firestore";
import { embedText } from "../ai/embeddings";
import type { FontFamilyDoc } from "../models/catalog.models";
import {
  buildLaneEmbeddingText,
  buildSearchDocument,
  type SearchVectorLane,
} from "../search/searchDocument";

interface BackfillVersion {
  embeddingModel: string;
  embeddingVersion: string;
  promptVersion: string;
}

const VECTOR_FIELDS: Record<SearchVectorLane, "text_vec" | "mood_vec" | "use_case_vec"> = {
  text: "text_vec",
  mood: "mood_vec",
  useCase: "use_case_vec",
};

function retryUpdate(): Record<string, unknown> {
  return {
    searchText: FieldValue.delete(),
    searchTokens: FieldValue.delete(),
    searchMeta: FieldValue.delete(),
    text_vec: FieldValue.delete(),
    mood_vec: FieldValue.delete(),
    use_case_vec: FieldValue.delete(),
    searchIndexState: "retry",
    searchIndexError: "missing_vector_lane",
    updatedAt: FieldValue.serverTimestamp(),
  };
}

export async function buildVersionedBackfillUpdate(
  family: FontFamilyDoc,
  version: BackfillVersion
): Promise<Record<string, unknown>> {
  const familyForSearch: FontFamilyDoc = {
    ...family,
    enrichment: family.enrichment
      ? {
          ...family.enrichment,
          embeddingModel: version.embeddingModel,
          embeddingVersion: version.embeddingVersion,
          promptVersion: family.enrichment.promptVersion ?? version.promptVersion,
        }
      : family.enrichment,
  };
  const searchDoc = buildSearchDocument(familyForSearch, version);
  const update: Record<string, unknown> = {
    ...searchDoc,
    searchMeta: { ...searchDoc.searchMeta, generatedAt: FieldValue.serverTimestamp() },
    updatedAt: FieldValue.serverTimestamp(),
  };
  const vectors = await Promise.all(
    (Object.keys(VECTOR_FIELDS) as SearchVectorLane[]).map(async (lane) => ({
      lane,
      vector: await embedText(buildLaneEmbeddingText(familyForSearch, lane), "RETRIEVAL_DOCUMENT"),
    }))
  );
  for (const { lane, vector } of vectors) {
    if (!vector) return retryUpdate();
    update[VECTOR_FIELDS[lane]] = FieldValue.vector(vector);
  }
  update.searchIndexState = "ready";
  update.searchIndexError = FieldValue.delete();
  return update;
}
