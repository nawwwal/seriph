import { isRecord, numberAt, recordAt } from "./tableAccess";

interface ColorInfo {
  present: boolean;
  formats: string[];
  layer_count?: number;
  palette_count?: number;
}

export function readColorAndPost(font: unknown): { color: ColorInfo; isFixedPitch?: boolean; italicAngle?: number } {
  if (!isRecord(font)) return { color: { present: false, formats: [] } };
  const colorFormats: string[] = [];
  let colorLayerCount: number | undefined;
  let colorPaletteCount: number | undefined;
  if ("COLR" in font) colorFormats.push("COLR");
  if ("CPAL" in font) {
    colorFormats.push("CPAL");
    const palettes = recordAt(font, "CPAL")?.palettes;
    if (Array.isArray(palettes)) colorPaletteCount = palettes.length;
  }
  if ("CBDT" in font || "CBLC" in font) colorFormats.push("CBDT");
  if ("sbix" in font) colorFormats.push("sbix");
  if ("SVG" in font) colorFormats.push("SVG");
  const layers = recordAt(font, "COLR")?.layers;
  if (colorFormats.includes("COLR") && Array.isArray(layers)) colorLayerCount = layers.length;

  const post = recordAt(font, "post");
  const isFixedPitchValue = post?.isFixedPitch;
  return {
    color: { present: colorFormats.length > 0, formats: colorFormats, layer_count: colorLayerCount, palette_count: colorPaletteCount },
    isFixedPitch: typeof isFixedPitchValue === "boolean" ? isFixedPitchValue : undefined,
    italicAngle: post ? numberAt(post, "italicAngle") : undefined,
  };
}
