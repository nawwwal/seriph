/**
 * Server-side specimen rendering.
 *
 * Renders a font to a PNG (pangram + alphabet + numerals) so a multimodal model
 * can actually *see* the type. Uses @napi-rs/canvas (skia, prebuilt binaries) so
 * it runs in gen2 Cloud Functions without a native build step. For variable
 * fonts this renders the default instance.
 */
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';

let aliasCounter = 0;

export interface SpecimenResult {
  png: Buffer;
  mimeType: 'image/png';
}

/**
 * @returns a PNG buffer, or null if the font couldn't be registered/rendered.
 */
export function renderSpecimen(fontBuffer: Buffer): SpecimenResult | null {
  const alias = `SeriphSpecimen_${process.pid}_${aliasCounter++}`;
  let registered = false;
  try {
    registered = Boolean(GlobalFonts.register(fontBuffer, alias));
  } catch {
    registered = false;
  }
  if (!registered) return null;

  const W = 1024;
  const H = 576;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#0b0b0b';
  ctx.textBaseline = 'alphabetic';

  const lines: Array<{ size: number; y: number; text: string }> = [
    { size: 96, y: 120, text: 'Aa Bb Cc Dd Ee' },
    { size: 44, y: 210, text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
    { size: 44, y: 270, text: 'abcdefghijklmnopqrstuvwxyz' },
    { size: 44, y: 330, text: '0123456789 & ? ! @ # $ % ( )' },
    { size: 40, y: 420, text: 'The quick brown fox jumps over' },
    { size: 40, y: 470, text: 'the lazy dog. Pack five boxes.' },
    { size: 26, y: 540, text: 'Sphinx of black quartz, judge my vow — 1234567890' },
  ];

  for (const line of lines) {
    ctx.font = `${line.size}px "${alias}"`;
    ctx.fillText(line.text, 40, line.y);
  }

  try {
    return { png: canvas.toBuffer('image/png'), mimeType: 'image/png' };
  } catch {
    return null;
  }
}
