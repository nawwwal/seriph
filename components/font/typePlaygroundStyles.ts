import type { Font } from '@/models/font.models';
import { isItalicFace } from './typePlaygroundState';

export interface PlaygroundFaceOption {
  id: string;
  label: string;
  font: Font;
}

export interface PlaygroundFaceRegistration {
  cssFamily: string;
  rule: string;
  styleId: string;
}

function posture(font: Font): string | null {
  const identity = `${font.subfamily} ${font.style} ${font.filename}`;
  if (/oblique/i.test(identity)) return 'Oblique';
  return isItalicFace(font) ? 'Italic' : null;
}

function baseLabel(font: Font): string {
  const weight = font.isVariable ? '' : ` · ${font.weight || 400}`;
  const facePosture = posture(font);
  const style = facePosture && !new RegExp(facePosture, 'i').test(font.subfamily)
    ? `${font.subfamily} ${facePosture}`
    : font.subfamily;
  return `${style}${weight}`;
}

function sourceLabel(font: Font): string {
  const postScriptName = font.metadata.postScriptName;
  if (typeof postScriptName === 'string' && postScriptName.trim()) return postScriptName.trim();
  return font.filename.replace(/\.[^.]+$/, '') || font.id;
}

function counts(values: string[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
}

export function buildPlaygroundFaceOptions(fonts: Font[]): PlaygroundFaceOption[] {
  const baseLabels = fonts.map(baseLabel);
  const baseCounts = counts(baseLabels);
  const usefulLabels = fonts.map((font, index) => {
    const base = baseLabels[index] ?? font.subfamily;
    return (baseCounts.get(base) ?? 0) > 1 ? `${base} · ${sourceLabel(font)}` : base;
  });
  const usefulCounts = counts(usefulLabels);
  return fonts.map((font, index) => {
    const useful = usefulLabels[index] ?? font.subfamily;
    const label = (usefulCounts.get(useful) ?? 0) > 1 ? `${useful} · ${font.id}` : useful;
    return { id: font.id, label, font };
  });
}

function cssString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function cssFormat(font: Font, src: string): string {
  const extension = (src.split('?')[0].split('.').pop() || '').toLowerCase();
  if (extension === 'ttf' || font.format === 'TTF') return 'truetype';
  if (extension === 'otf' || font.format === 'OTF') return 'opentype';
  return extension || font.format.toLowerCase();
}

export function buildPlaygroundFaceRegistration(
  familyName: string,
  font: Font
): PlaygroundFaceRegistration | null {
  const cdn = typeof font.metadata.cdnUrl === 'string' ? font.metadata.cdnUrl : undefined;
  const storagePath = typeof font.metadata.storagePath === 'string' ? font.metadata.storagePath : undefined;
  const src = cdn || (storagePath ? `/api/font/gcs?path=${encodeURIComponent(storagePath)}` : undefined);
  if (!src) return null;
  const safeName = `${familyName}_${font.id}`.replace(/[^a-z0-9_-]+/gi, '_');
  const cssFamily = `SeriphPlayground_${safeName}`;
  const rule = `@font-face { font-family: '${cssString(cssFamily)}'; src: url('${cssString(src)}') format('${cssFormat(font, src)}'); font-weight: ${font.weight || 400}; font-style: ${isItalicFace(font) ? 'italic' : 'normal'}; font-display: swap; }`;
  return { cssFamily, rule, styleId: `seriph-playground-face-${safeName}` };
}
