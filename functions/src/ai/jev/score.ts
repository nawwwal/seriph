export function scoreQuestion(instructions: string, criteria: readonly string[]): {
  type: "score";
  instructions: string;
  criteria: string[];
} {
  return { type: "score", instructions, criteria: [...criteria] };
}

export const USE_CASE_LEVELS = ["unsuitable", "possible", "primary"] as const;
export const PAIR_LEVELS = ["clash", "usable pair", "strong pair"] as const;
export const MERGE_LEVELS = [
  "different families",
  "related cuts or sister families",
  "same family split across cards",
] as const;
