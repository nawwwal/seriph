import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock fontkit to make parsing deterministic
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
      },
      glyphs: { length: 1000 },
    })),
  };
});

// Mock Vertex to classify based on familyName embedded in prompt
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
                parts: [{ text: JSON.stringify({ description: 'Golden-set mock description.' }) }],
              },
            },
          ],
        },
      })),
    })),
    generateStrictJSON: vi.fn(async ({ opName, promptParts }) => {
      const promptText: string = (promptParts?.[0] as string) || '';
      // Extract family name from the visual analysis prompt
      const famMatch = promptText.match(/Analyze the font family \"(.+?)\"/);
      const familyName = famMatch?.[1]?.toLowerCase() || 'unknown';

      let style: 'sans' | 'serif' | 'mono' = 'sans';
      if (familyName.includes('times') || familyName.includes('garamond') || familyName.includes('roman')) {
        style = 'serif';
      } else if (familyName.includes('fira') || familyName.includes('code') || familyName.includes('mono')) {
        style = 'mono';
      } else {
        style = 'sans';
      }

      if (opName === 'visualAnalysis' || opName === 'enrichedAnalysis') {
        return {
          data: {
            style_primary: { value: style, confidence: 0.85, evidence_keys: ['metrics.x_height_ratio'] },
            moods: [{ value: style === 'serif' ? 'classic' : style === 'mono' ? 'technical' : 'neutral', confidence: 0.7 }],
            use_cases: [{ value: style === 'mono' ? 'code' : 'ui', confidence: 0.8 }],
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

type GoldenItem = {
  familyName: string;
  expectedStylePrimary: string;
  expectedSubstyle?: string;
  expectedMoods?: string[];
  expectedUseCases?: string[];
};

describe('Golden set accuracy (mocked AI)', () => {
  let golden: GoldenItem[] = [];

  beforeAll(() => {
    const root = path.resolve(__dirname, '../../../..');
    const file = path.join(root, 'tests', 'golden-set', 'fonts.json');
    const raw = fs.readFileSync(file, 'utf8');
    golden = JSON.parse(raw);
    expect(Array.isArray(golden)).toBe(true);
    expect(golden.length).toBeGreaterThan(0);
  });

  it('matches expected primary style for sample golden entries', async () => {
    // Only validate a subset to keep test time low
    const sample = golden.slice(0, Math.min(5, golden.length));
    for (const item of sample) {
      const result = await runFontPipeline(Buffer.from('mock'), `${item.familyName}.ttf`);
      const analysis = result.enrichedAnalysis || result.visualAnalysis;
      expect(analysis).toBeTruthy();
      const predicted = analysis.style_primary?.value;
      expect(typeof predicted).toBe('string');
      expect(predicted?.toLowerCase()).toBe(item.expectedStylePrimary.toLowerCase());
    }
  });
});


