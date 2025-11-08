import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';

// Mock fontkit to avoid parsing real binaries
vi.mock('fontkit', () => {
  return {
    default: {
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
        glyphs: { length: 1234 },
        GPOS: {},
        GSUB: {},
      })),
    },
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
      glyphs: { length: 1234 },
      GPOS: {},
      GSUB: {},
    })),
  };
});

// Mock opentype.js as a no-op for this test
vi.mock('opentype.js', () => {
  return {};
});

import { serverParseFontFile } from '../../src/parser/fontParser';

describe('serverParseFontFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses basic properties from a mock font buffer', async () => {
    const buffer = Buffer.from('mock-font-bytes');
    const result = await serverParseFontFile(buffer, 'Mock-Regular.ttf');
    expect(result).toBeTruthy();
    expect(result.familyName).toBe('Mock Family');
    expect(result.subfamilyName).toBe('Regular');
    expect(result.postScriptName || result.postscriptName).toBeTruthy();
    expect(result.version).toContain('1.000');
    expect(result.glyphCount === 1234 || result.glyphCount > 0).toBe(true);
  });

  it('sets sensible defaults when fields are missing', async () => {
    // Remock fontkit.create to return minimal shape
    const fontkit = await import('fontkit');
    (fontkit as any).create.mockImplementationOnce(() => ({
      names: {},
      glyphs: { length: 10 },
    }));
    const buffer = Buffer.from('another-mock');
    const result = await serverParseFontFile(buffer, 'Unknown.otf');
    expect(result.familyName).toBeTruthy();
    expect(result.subfamilyName).toBeTruthy();
    expect(result.glyphCount).toBe(10);
  });
});


