import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { analyzeQueryIntent, inferredQueryClassification } = require("../../lib/search/queryIntent.js");
const { exactMatchScore, fuseCandidateScore, semanticScoreFromDistance } = require("../../lib/search/scoring.js");
const { isSearchableStatus } = require("../../lib/search/searchFilters.js");
const { meaningfulNameTokens, familyCoreStem, deterministicSameFamily } = require("../../lib/ai/jev/merge/stem.js");
const { parseAnalysis, currentEnrichmentVersions } = require("../../lib/ai/enrich/parse.js");
const { lanesForIntent, weightsForIntent } = require("../../lib/ai/jev/search/intent.js");

test("queryIntent recognizes mood, occasion, and strict serif vs sans-serif", () => {
  const happy = analyzeQueryIntent("happy");
  assert.equal(happy.intent, "vibe");
  assert.equal(happy.inferredClass, null);

  const wedding = analyzeQueryIntent("wedding invitation");
  assert.equal(wedding.intent, "job");

  const warmSerif = analyzeQueryIntent("warm editorial serif");
  assert.equal(warmSerif.intent, "vibe");
  assert.equal(warmSerif.inferredClass, "Serif");

  assert.equal(inferredQueryClassification("clean geometric sans serif"), "Sans Serif");
  assert.equal(inferredQueryClassification("coding monospace"), "Monospace");
});

test("exactMatchScore does not score Sans Serif as Serif", () => {
  const sansFamily = {
    id: "abc-ginto",
    slug: "abc-ginto",
    name: "ABC Ginto",
    fileBase: "ABCGinto",
    category: "SANS_SERIF",
    classification: "Sans Serif",
    searchTokens: ["abc", "ginto", "sans", "serif"],
    faces: [],
    status: "enriched",
    version: 1,
  };
  const serifFamily = {
    ...sansFamily,
    id: "gt-super",
    slug: "gt-super",
    name: "GT Super",
    category: "SERIF",
    classification: "Serif",
    searchTokens: ["gt", "super", "serif"],
  };
  assert.equal(exactMatchScore("serif", sansFamily), 0);
  assert.ok(exactMatchScore("serif", serifFamily) >= 0.7);
});

test("vector lanes and fusion weights include mood, useCase, text, and image", () => {
  assert.deepEqual(lanesForIntent("vibe"), ["mood", "text", "image", "useCase"]);
  assert.deepEqual(lanesForIntent("job"), ["useCase", "text", "mood", "image"]);
  const vibeWeights = weightsForIntent("vibe");
  assert.ok(vibeWeights.moodSemantic > vibeWeights.exact);
  const baseScores = {
    textSemantic: 0.7,
    moodSemantic: semanticScoreFromDistance(0.1),
    useCaseSemantic: 0.6,
    imageSemantic: 0,
    exact: 0,
    quality: 0.75,
  };
  const withoutImage = fuseCandidateScore(baseScores, vibeWeights);
  const withImage = fuseCandidateScore({ ...baseScores, imageSemantic: 0.8 }, vibeWeights);
  assert.ok(withImage > withoutImage);
  assert.ok(withImage > 0.74);
});

test("isSearchableStatus keeps enriching fonts searchable", () => {
  assert.equal(isSearchableStatus({ status: "enriching", hidden: false }), true);
  assert.equal(isSearchableStatus({ status: "ready", hidden: false }), true);
  assert.equal(isSearchableStatus({ status: "merged", hidden: true }), false);
});

test("duplicate stem filters generic typographic tokens and detects real split families", () => {
  assert.deepEqual(meaningfulNameTokens("ABC Ginto Sans Pro Display"), ["abc", "ginto"]);
  assert.equal(familyCoreStem("GT Super Display"), "gt super");
  assert.equal(familyCoreStem("GT Super Text"), "gt super");
  assert.equal(deterministicSameFamily(
    { name: "GT Super Display", faces: [] },
    { name: "GT Super Text", faces: [] },
  ), true);
  assert.equal(deterministicSameFamily(
    { name: "Inter Display", faces: [] },
    { name: "Roboto Display", faces: [] },
  ), false);
});

test("parseAnalysis and currentEnrichmentVersions never stamp empty analysisModel", () => {
  const parsed = parseAnalysis(
    { slug: "test-font", category: "SERIF", faces: [] },
    JSON.stringify({ category: "SERIF", summary: "Warm editorial serif.", moods: ["warm"], useCases: ["editorial"] }),
  );
  assert.ok(parsed?.modelId.length > 0);
  assert.ok(currentEnrichmentVersions().analysisModel.length > 0);
});
