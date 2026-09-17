import { evaluateSystemOne, nearestScoreLevel, noulValue } from "../client";
import { MERGE_LEVELS, scoreQuestion } from "../score";

export interface MergePairInput {
  id: string;
  name: string;
  foundry: string | null;
  styles: string[];
}

export interface MergeJudgment {
  candidateId: string;
  level: number;
  nameAlign: number;
  foundryAlign: number;
  styleAlign: number;
}

const QUESTIONS = {
  relation: scoreQuestion(
    "Are `source` and `candidate` the same family split across cards, related cuts, or different families?",
    MERGE_LEVELS,
  ),
  name: {
    type: "noul",
    instructions: "Do the names refer to the same family entity?",
    criteria: { true: "Same name entity.", false: "Different names." },
  },
  foundry: {
    type: "noul",
    instructions: "Do foundry/designer fields agree?",
    criteria: { true: "Same foundry.", false: "Different or unknown." },
  },
  style: {
    type: "noul",
    instructions: "Do the style lists look like one family split across cards?",
    criteria: { true: "Same family styles.", false: "Different families." },
  },
};

export async function judgeMergePair(source: MergePairInput, candidate: MergePairInput): Promise<MergeJudgment | null> {
  try {
    const judged = await evaluateSystemOne({ source, candidate }, QUESTIONS);
    const level = nearestScoreLevel(judged, "relation", MERGE_LEVELS.length);
    if (level < 1) return null;
    return {
      candidateId: candidate.id,
      level,
      nameAlign: noulValue(judged, "name"),
      foundryAlign: noulValue(judged, "foundry"),
      styleAlign: noulValue(judged, "style"),
    };
  } catch {
    return null;
  }
}
