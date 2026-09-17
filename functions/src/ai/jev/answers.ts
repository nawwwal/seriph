export interface NoulAnswer {
  type: "noul";
  noul: number;
}

export interface ChoiceAnswer {
  type: "choice";
  choice: string;
  probabilities?: Record<string, number>;
  confidence?: number;
}

export interface ScoreAnswer {
  type: "score";
  score: number;
  legend?: Record<string, string>;
  probabilities?: Record<string, number>;
  confidence?: number;
}

export type SystemOneAnswer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export interface SystemOneResult {
  model: string;
  answers: Record<string, SystemOneAnswer>;
}

export { parseSystemOneResult } from "./parseResult";

export function noulValue(result: SystemOneResult, id: string): number {
  const answer = result.answers[id];
  return answer?.type === "noul" ? answer.noul : 0;
}

export function choiceValue(result: SystemOneResult, id: string): string | undefined {
  const answer = result.answers[id];
  return answer?.type === "choice" ? answer.choice : undefined;
}

export function choiceConfidence(result: SystemOneResult, id: string): number {
  const answer = result.answers[id];
  return answer?.type === "choice" && answer.confidence !== undefined ? answer.confidence : 0;
}

export function choiceProbabilities(result: SystemOneResult, id: string): Record<string, number> {
  const answer = result.answers[id];
  return answer?.type === "choice" ? answer.probabilities ?? {} : {};
}

export function scoreValue(result: SystemOneResult, id: string): number {
  const answer = result.answers[id];
  return answer?.type === "score" ? answer.score : 0;
}

export function nearestScoreLevel(result: SystemOneResult, id: string, levelCount: number): number {
  if (levelCount < 2) return 0;
  return Math.min(levelCount - 1, Math.max(0, Math.round(scoreValue(result, id))));
}

export function scoreLevelProbability(result: SystemOneResult, id: string, level: number): number {
  const answer = result.answers[id];
  if (answer?.type !== "score") return 0;
  const mass = answer.probabilities?.[String(level)];
  if (typeof mass === "number" && Number.isFinite(mass)) return mass;
  return nearestScoreLevel(result, id, Math.max(level + 1, 2)) === level ? 1 : 0;
}

export function questionId(prefix: string, raw: string): string {
  return `${prefix}_${raw.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 48)}`;
}
