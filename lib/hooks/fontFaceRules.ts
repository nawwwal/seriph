import type { Font as FontVariant, FontFamily } from '@/models/font.models';

function cssFormatFor(fontFormat: string): string {
  const fmt = (fontFormat || '').toLowerCase();
  if (fmt === 'ttf') return 'truetype';
  if (fmt === 'otf') return 'opentype';
  if (fmt === 'woff2') return 'woff2';
  if (fmt === 'woff') return 'woff';
  return fmt || 'truetype';
}

function weightRangeFor(variant: FontVariant): string {
  const weight = variant.weight || 400;
  if (!variant.isVariable || !variant.variableAxes?.length) return String(weight);
  const wght = variant.variableAxes.find((axis) => axis.tag === 'wght');
  if (!wght) return String(weight);
  const min = Math.floor(wght.minValue);
  const max = Math.ceil(wght.maxValue);
  return min < max ? `${min} ${max}` : String(weight);
}

function buildFontFaceRule(familyName: string, variant: FontVariant, proxiedSrc: string): string {
  const isItalic = (variant.style || variant.subfamily || '').toLowerCase().includes('italic');
  const srcExt = (proxiedSrc.split('?')[0].split('.').pop() || '').toLowerCase();
  const format = cssFormatFor(srcExt || String(variant.format || ''));
  return `@font-face {
    font-family: '${familyName}';
    src: url('${proxiedSrc}') format('${format}');
    font-weight: ${weightRangeFor(variant)};
    font-style: ${isItalic ? 'italic' : 'normal'};
    font-display: swap;
  }`;
}

function pickRepresentativeFace(fonts: FontVariant[]): FontVariant[] {
  if (fonts.length <= 1) return fonts;
  const variable = fonts.find((font) => font.isVariable);
  if (variable) return [variable];
  return [fonts.reduce((a, b) => ((b.weight || 0) > (a.weight || 0) ? b : a))];
}

export function buildFamilyFontFaceRules(family: FontFamily, representativeOnly: boolean): string {
  const rules: string[] = [];
  const seen = new Set<string>();
  const faces = representativeOnly ? pickRepresentativeFace(family.fonts) : family.fonts;
  for (const face of faces) {
    const cdn = typeof face.metadata?.cdnUrl === 'string' ? face.metadata.cdnUrl : undefined;
    const storagePath = face.metadata?.storagePath || null;
    const src = cdn || (storagePath ? `/api/font/gcs?path=${encodeURIComponent(storagePath)}` : null);
    if (!src || seen.has(`${face.id}::${src}`)) continue;
    seen.add(`${face.id}::${src}`);
    rules.push(buildFontFaceRule(family.name, face, src));
  }
  return rules.join('\n\n');
}
