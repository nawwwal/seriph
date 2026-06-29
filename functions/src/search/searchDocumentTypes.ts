export type SearchVectorLane = "text" | "mood" | "useCase";

export const SEARCH_VECTOR_LANES: SearchVectorLane[] = ["text", "mood", "useCase"];

export interface SearchVersionInfo {
  embeddingModel?: string;
  embeddingVersion: string;
  promptVersion: string;
}
