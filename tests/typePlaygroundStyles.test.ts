import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Font } from '@/models/font.models';
import {
  buildPlaygroundFaceOptions,
  buildPlaygroundFaceRegistration,
  selectDefaultFace,
} from '@/components/font/typePlaygroundModel';

function face(overrides: Partial<Font>): Font {
  return {
    id: 'regular-a', filename: 'AcidGrotesk-Regular.woff2', format: 'WOFF2',
    subfamily: 'Regular', weight: 400, style: 'Regular', isVariable: false,
    fileSize: 1_024, metadata: { cdnUrl: 'https://fonts.test/regular-a.woff2' },
    ...overrides,
  };
}

describe('type playground fixed-face styles', () => {
  it('keeps duplicate labels useful and unique while preserving face IDs', () => {
    const faces = [
      face({}),
      face({ id: 'regular-b', filename: 'AcidGrotesk-Text.woff2' }),
      face({ id: 'italic', filename: 'AcidGrotesk-Italic.woff2', metadata: { italic: true } }),
      face({ id: 'bold', subfamily: 'Bold', style: 'Bold', weight: 700 }),
    ];

    expect(buildPlaygroundFaceOptions(faces).map(({ id, label }) => ({ id, label }))).toEqual([
      { id: 'regular-a', label: 'Regular · 400 · AcidGrotesk-Regular' },
      { id: 'regular-b', label: 'Regular · 400 · AcidGrotesk-Text' },
      { id: 'italic', label: 'Regular Italic · 400' },
      { id: 'bold', label: 'Bold · 700' },
    ]);
    expect(selectDefaultFace(faces)?.id).toBe('regular-a');
  });

  it('builds collision-free registrations for fixed faces', () => {
    const regular = buildPlaygroundFaceRegistration('Acid Grotesk', face({ format: 'OTF' }));
    const italic = buildPlaygroundFaceRegistration('Acid Grotesk', face({
      id: 'italic', metadata: { cdnUrl: 'https://fonts.test/italic.woff2', italic: true },
    }));

    expect(regular?.cssFamily).not.toBe(italic?.cssFamily);
    expect(regular?.rule).toContain("url('https://fonts.test/regular-a.woff2')");
    expect(regular?.rule).toContain("format('woff2')");
    expect(regular?.rule).toContain('font-style: normal');
    expect(italic?.rule).toContain('font-style: italic');
  });

  it('uses % / px line-height units with no Auto mode', () => {
    const lineHeight = fs.readFileSync(
      path.join(process.cwd(), 'components/font/typePlaygroundLineHeight.tsx'),
      'utf8',
    );

    expect(lineHeight).not.toContain('auto');
    expect(lineHeight).toContain("['%', 'px']");
    expect(lineHeight).toContain('Line height');
  });
});
