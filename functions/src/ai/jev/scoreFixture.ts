import { mapsFromResult, type JevLabelMaps } from "./label";
import type { SystemOneResult } from "./client";
import { taxonomyMoods, taxonomyUseCases } from "../taxonomies";
import type { Mood, UseCase } from "../../models/contracts";

export interface LabeledFamily {
  id: string;
  moods: Mood[];
  useCases: UseCase[];
}

export interface FixtureArmScores {
  moodPrecision: number;
  moodRecall: number;
  useCasePrecision: number;
  useCaseRecall: number;
}

function overlap(predicted: string[], expected: string[]): { precision: number; recall: number } {
  if (predicted.length === 0 && expected.length === 0) return { precision: 1, recall: 1 };
  const hits = predicted.filter((value) => expected.includes(value)).length;
  return {
    precision: predicted.length ? hits / predicted.length : 0,
    recall: expected.length ? hits / expected.length : 0,
  };
}

export function scoreGeminiArm(predicted: { moods?: unknown; useCases?: unknown }, expected: LabeledFamily): FixtureArmScores {
  const moods = overlap(taxonomyMoods(predicted.moods), expected.moods);
  const useCases = overlap(taxonomyUseCases(predicted.useCases), expected.useCases);
  return { moodPrecision: moods.precision, moodRecall: moods.recall, useCasePrecision: useCases.precision, useCaseRecall: useCases.recall };
}

export function scoreJevArm(result: SystemOneResult, threshold: number, expected: LabeledFamily): FixtureArmScores {
  const maps: JevLabelMaps = mapsFromResult(result, threshold);
  const moods = overlap(maps.moods, expected.moods);
  const useCases = overlap(maps.useCases, expected.useCases);
  return { moodPrecision: moods.precision, moodRecall: moods.recall, useCasePrecision: useCases.precision, useCaseRecall: useCases.recall };
}
