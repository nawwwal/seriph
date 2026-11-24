import type { Font as FontVariant, FontFamily } from '@/models/font.models';
import { isItalicFace } from '@/components/font/typePlaygroundState';
import { escapeCssString, fontFormatFromUrl, quoteCssFontFamily } from '@/lib/utils/cssFont';

function weightRangeFor(variant: FontVariant): string {
  const weight = variant.weight || 400;
  if (!variant.isVariable || !variant.variableAxes?.length) return String(weight);
  const wght = variant.variableAxes.find((axis) => axis.tag === 'wght');
  if (!wght) return String(weight);
  const min = Math.floor(wght.minValue);
  const max = Math.ceil(wght.maxValue);
  return min < max ? `${min} ${max}` : String(weight);
}

function fontStylesFor(variant: FontVariant): Array<'normal' | 'italic'> {
  const axes = variant.isVariable ? variant.variableAxes ?? [] : [];
  if (axes.some((axis) => axis.tag === 'ital' || axis.tag === 'slnt')) {
    return ['normal', 'italic'];
  }
  return [isItalicFace(variant) ? 'italic' : 'normal'];
}

function buildFontFaceRule(familyName: string, variant: FontVariant, src: string, fontStyle: 'normal' | 'italic'): string {
  const format = fontFormatFromUrl(src, String(variant.format || ''));
  return `@font-face {
    font-family: ${quoteCssFontFamily(familyName)};
    src: url('${escapeCssString(src)}') format('${escapeCssString(format)}');
    font-weight: ${weightRangeFor(variant)};
    font-style: ${fontStyle};
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
    const src = typeof face.metadata?.cdnUrl === 'string' && face.metadata.cdnUrl ? face.metadata.cdnUrl : null;
    if (!src) continue;
    for (const fontStyle of fontStylesFor(face)) {
      const key = `${face.id}::${src}::${fontStyle}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rules.push(buildFontFaceRule(family.name, face, src, fontStyle));
    }
  }
  return rules.join('\n\n');
}
