/** Read the OS/2 table: classification, weight/foundry fallbacks, metrics. */
export function readOS2(font: any, current: { weight?: number; foundry?: string }) {
  const out: any = { weight: current.weight, foundry: current.foundry, unicodeRanges: [] as string[], codepageRanges: [] as string[] };
  if (!("OS2" in font) || !font.OS2) return out;
  const os2 = font.OS2 as any;
  if (os2.sFamilyClass) {
    const mainClass = os2.sFamilyClass >> 8;
    if ([1, 2, 3, 4, 5, 7].includes(mainClass)) out.classification = "Serif";
    else if (mainClass === 8) out.classification = "Sans Serif";
    else if (mainClass === 9) out.classification = "Display & Decorative";
    else if (mainClass === 10) out.classification = "Script & Handwriting";
    else if (mainClass === 12) out.classification = "Symbol & Icon";
  }
  if (!out.weight && os2.usWeightClass) out.weight = os2.usWeightClass;
  if (!out.foundry && os2.achVendID) out.foundry = os2.achVendID;
  if (os2.achVendID) out.vendorId = os2.achVendID;
  if (os2.panose) out.panose = Array.from(os2.panose);
  if (os2.sxHeight) out.xHeight = os2.sxHeight;
  if (os2.sCapHeight) out.capHeight = os2.sCapHeight;
  if (os2.sTypoAscender) out.typoAscender = os2.sTypoAscender;
  if (os2.sTypoDescender) out.typoDescender = os2.sTypoDescender;
  if (os2.fsType !== undefined) out.fsType = os2.fsType;
  if (os2.ulUnicodeRange1 !== undefined || os2.ulUnicodeRange2 !== undefined) {
    out.unicodeRanges = [os2.ulUnicodeRange1 || 0, os2.ulUnicodeRange2 || 0, os2.ulUnicodeRange3 || 0, os2.ulUnicodeRange4 || 0]
      .map((r: number) => `U+${r.toString(16)}`);
  }
  return out;
}

/** Read extra name-table fields (designer, license, urls, sample text, etc.). */
export function readNameExtras(font: any) {
  const out: any = {};
  if (!("names" in font) || !font.names) return out;
  const n = font.names as any;
  if (n.designer?.en) out.designer = n.designer.en;
  if (n.description?.en) out.description = n.description.en;
  if (n.licenseURL?.en) out.licenseUrl = n.licenseURL.en;
  if (n.licenseDescription?.en) out.licenseDescription = n.licenseDescription.en;
  if (n.manufacturerURL?.en) out.url = n.manufacturerURL.en;
  if (n.sampleText?.en) out.sampleText = n.sampleText.en;
  if (n.preferredFamily?.en) out.preferredFamily = n.preferredFamily.en;
  if (n.fullName?.en) out.fullName = n.fullName.en;
  return out;
}

/** OpenType features (GSUB/GPOS) and kerning-pair count. */
export function readFeatures(font: any) {
  let openTypeFeatures: string[] = [];
  if ("GSUB" in font && (font.GSUB as any)?.features) openTypeFeatures = Object.keys((font.GSUB as any).features);
  if ("GPOS" in font && (font.GPOS as any)?.features) openTypeFeatures = [...openTypeFeatures, ...Object.keys((font.GPOS as any).features)];
  openTypeFeatures = [...new Set(openTypeFeatures)];

  let kerningPairCount: number | undefined;
  if ("kern" in font && (font.kern as any)?.kerningPairs) kerningPairCount = Object.keys((font.kern as any).kerningPairs).length;
  else if ("GPOS" in font && (font.GPOS as any)?.kerningPairs) kerningPairCount = Object.keys((font.GPOS as any).kerningPairs).length;
  return { openTypeFeatures, kerningPairCount };
}

/** Color-font tables and post-table flags. */
export function readColorAndPost(font: any) {
  const colorFormats: string[] = [];
  let colorLayerCount: number | undefined;
  let colorPaletteCount: number | undefined;
  if ("COLR" in font) colorFormats.push("COLR");
  if ("CPAL" in font) {
    colorFormats.push("CPAL");
    if ((font as any).CPAL?.palettes) colorPaletteCount = (font as any).CPAL.palettes.length;
  }
  if ("CBDT" in font || "CBLC" in font) colorFormats.push("CBDT");
  if ("sbix" in font) colorFormats.push("sbix");
  if ("SVG" in font) colorFormats.push("SVG");
  if (colorFormats.includes("COLR") && (font as any).COLR?.layers) colorLayerCount = (font as any).COLR.layers.length;

  let isFixedPitch: boolean | undefined;
  let italicAngle: number | undefined;
  if ("post" in font && font.post) {
    const post = font.post as any;
    if (post.isFixedPitch !== undefined) isFixedPitch = post.isFixedPitch;
    if (post.italicAngle !== undefined) italicAngle = post.italicAngle;
  }
  return {
    color: { present: colorFormats.length > 0, formats: colorFormats, layer_count: colorLayerCount, palette_count: colorPaletteCount },
    isFixedPitch, italicAngle,
  };
}
