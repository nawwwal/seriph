import { describe, it, expect } from 'vitest';
import { validateAnalysisResult, applySanityRules, calculateConfidence } from '../../../src/ai/pipeline/validation';

describe('validateAnalysisResult', () => {
  it('accepts valid minimal analysis', () => {
    const analysis = {
      style_primary: { value: 'sans', confidence: 0.8, evidence_keys: ['metrics.x_height_ratio'] },
      substyle: { value: 'neo_grotesque', confidence: 0.6 },
      moods: [{ value: 'neutral', confidence: 0.7 }],
      use_cases: [{ value: 'ui', confidence: 0.9 }],
    };
    const v = validateAnalysisResult(analysis);
    expect(v.isValid).toBe(true);
    expect(v.errors.length).toBe(0);
  });

  it('flags missing required fields', () => {
    const v = validateAnalysisResult({}); // missing everything
    expect(v.isValid).toBe(false);
    expect(v.errors.some((e) => e.includes('style_primary'))).toBe(true);
  });
});

describe('applySanityRules', () => {
  it('warns when UI use_case with serif classification lacking evidence', () => {
    const parsedData = { visual_metrics: { x_height_ratio: 0.5 } };
    const analysis = {
      style_primary: { value: 'serif', confidence: 0.7, evidence_keys: [] },
      use_cases: [{ value: 'ui', confidence: 0.8 }],
    };
    const v = applySanityRules(parsedData, analysis);
    expect(v.isValid).toBe(true);
    expect(v.warnings.length).toBeGreaterThan(0);
  });
});

describe('calculateConfidence', () => {
  it('averages confidence across fields', () => {
    const analysis = {
      style_primary: { value: 'sans', confidence: 0.8 },
      moods: [{ value: 'neutral', confidence: 0.6 }],
      use_cases: [{ value: 'ui', confidence: 0.9 }],
    };
    const c = calculateConfidence(analysis);
    // (0.8 + 0.6 + 0.9) / 3
    expect(c).toBeGreaterThan(0.7);
    expect(c).toBeLessThan(0.9);
  });
});


