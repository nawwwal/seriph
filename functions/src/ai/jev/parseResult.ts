import type { ChoiceAnswer, NoulAnswer, ScoreAnswer, SystemOneAnswer, SystemOneResult } from "./answers";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function numberRecord(value: unknown): Record<string, number> | undefined {
  if (!isRecord(value)) return undefined;
  const out: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    const n = finite(item);
    if (n !== undefined) out[key] = n;
  }
  return Object.keys(out).length ? out : undefined;
}

function stringRecord(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") out[key] = item;
  }
  return Object.keys(out).length ? out : undefined;
}

function parseAnswer(value: unknown): SystemOneAnswer | undefined {
  if (!isRecord(value) || typeof value.type !== "string") return undefined;
  if (value.type === "noul") {
    const noul = finite(value.noul);
    return noul === undefined ? undefined : { type: "noul", noul } satisfies NoulAnswer;
  }
  if (value.type === "choice" && typeof value.choice === "string") {
    return {
      type: "choice",
      choice: value.choice,
      confidence: finite(value.confidence),
      probabilities: numberRecord(value.probabilities),
    } satisfies ChoiceAnswer;
  }
  if (value.type === "score") {
    const score = finite(value.score);
    return score === undefined ? undefined : {
      type: "score",
      score,
      confidence: finite(value.confidence),
      legend: stringRecord(value.legend),
      probabilities: numberRecord(value.probabilities),
    } satisfies ScoreAnswer;
  }
  return undefined;
}

export function parseSystemOneResult(data: unknown): SystemOneResult {
  if (!isRecord(data) || !isRecord(data.answers)) throw new Error("typesafe_malformed_response");
  const answers: Record<string, SystemOneAnswer> = {};
  for (const [id, value] of Object.entries(data.answers)) {
    const parsed = parseAnswer(value);
    if (parsed) answers[id] = parsed;
  }
  return { model: typeof data.model === "string" ? data.model : "", answers };
}
