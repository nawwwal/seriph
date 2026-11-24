export type SearchVectorLane = "text" | "mood" | "useCase" | "image";

export const SEARCH_VECTOR_LANES: SearchVectorLane[] = ["text", "mood", "useCase", "image"];

export interface SearchVersionInfo {
  embeddingModel?: string;
  embeddingVersion: string;
  promptVersion: string;
}
