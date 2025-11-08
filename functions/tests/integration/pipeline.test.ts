import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fontkit to avoid parsing real binaries
vi.mock('fontkit', () => {
  return {
    create: vi.fn(() => ({
      familyName: 'Mock Family',
      subfamilyName: 'Regular',
      postscriptName: 'MockPSName',
      version: 'Version 1.000',
      names: {
        fontFamily: { en: 'Mock Family' },
        fontSubfamily: { en: 'Regular' },
        postScriptName: { en: 'MockPSName' },
        version: { en: 'Version 1.000' },
        manufacturer: { en: 'Mock Foundry' },
      },
      glyphs: { length: 1200 },
    })),
  };
});

// Mock Vertex client to return valid JSON outputs for both stages
vi.mock('../../../src/ai/vertex/vertexClient', () => {
  return {
    isVertexEnabled: () => true,
    logUsageMetadata: () => {},
    getGenerativeModelFromRC: vi.fn(() => ({
      generateContent: vi.fn(async () => ({
        response: {
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ description: 'A mock description.' }) }],
              },
            },
          ],
        },
      })),
    })),
    generateStrictJSON: vi.fn(async ({ opName }) => {
      if (opName === 'visualAnalysis') {
        return {
          data: {
            style_primary: { value: 'sans', confidence: 0.8, evidence_keys: ['metrics.x_height_ratio'] },
            substyle: { value: 'neo_grotesque', confidence: 0.6, evidence_keys: [] },
            moods: [{ value: 'neutral', confidence: 0.7 }],
            use_cases: [{ value: 'ui', confidence: 0.9 }],
          },
          rawText: null,
          response: {},
        };
      }
      if (opName === 'enrichedAnalysis') {
        return {
          data: {
            style_primary: { value: 'sans', confidence: 0.8, evidence_keys: ['metrics.x_height_ratio'] },
            substyle: { value: 'neo_grotesque', confidence: 0.6, evidence_keys: [] },
            moods: [{ value: 'neutral', confidence: 0.7 }],
            use_cases: [{ value: 'ui', confidence: 0.9 }],
            people: [{ role: 'designer', name: 'Mock Designer', source: 'web', confidence: 0.7 }],
          },
          rawText: null,
          response: {},
        };
      }
      return { data: null, rawText: null, response: {} };
    }),
  };
});

import { runFontPipeline } from '../../../src/ai/pipeline/fontPipeline';

describe('runFontPipeline - integration (mocked AI)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs end-to-end and returns a valid result', async () => {
    const buffer = Buffer.from('mock-font-bytes');
    const result = await runFontPipeline(buffer, 'Mock-Regular.ttf');
    expect(result).toBeTruthy();
    expect(result.isValid).toBe(true);
    expect(result.parsedData).toBeTruthy();
    expect(result.visualAnalysis || result.enrichedAnalysis).toBeTruthy();
    expect(typeof result.confidence).toBe('number');
    expect(result.description).toBeTruthy();
  });
});


