import type { Query, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { tokenizeSearchText, type SearchVectorLane } from "./searchDocument";

const VECTOR_FIELD_BY_LANE: Record<SearchVectorLane, "text_vec" | "mood_vec" | "use_case_vec"> = {
  text: "text_vec",
  mood: "mood_vec",
  useCase: "use_case_vec",
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function laneFetchLimit(topK: number): number {
  return Math.min(300, Math.max(topK * 4, 24));
}

export async function runVectorLane(
  base: Query,
  lane: SearchVectorLane,
  vector: number[],
  topK: number
): Promise<QueryDocumentSnapshot[]> {
  const started = Date.now();
  try {
    const snap = await base
      .findNearest({
        vectorField: VECTOR_FIELD_BY_LANE[lane],
        queryVector: vector,
        limit: laneFetchLimit(topK),
        distanceMeasure: "COSINE",
        distanceResultField: "_distance",
      })
      .get();
    logger.info("search vector lane complete", { lane, count: snap.docs.length, ms: Date.now() - started });
    return snap.docs;
  } catch (error) {
    logger.warn("search vector lane failed", { lane, message: errorMessage(error), ms: Date.now() - started });
    return [];
  }
}

export async function runExactLane(base: Query, q: string, topK: number): Promise<QueryDocumentSnapshot[]> {
  const started = Date.now();
  const tokens = tokenizeSearchText([q]).slice(0, 30);
  if (tokens.length === 0) return [];
  try {
    const snap = await base.where("searchTokens", "array-contains-any", tokens).limit(laneFetchLimit(topK)).get();
    logger.info("search exact lane complete", { count: snap.docs.length, ms: Date.now() - started });
    return snap.docs;
  } catch (error) {
    logger.warn("search exact lane failed", { message: errorMessage(error), ms: Date.now() - started });
    return [];
  }
}
