import { isRecord, recordAt } from "./tableAccess";

function featureKeys(font: Record<string, unknown>, key: string): string[] {
  const features = recordAt(recordAt(font, key) ?? {}, "features");
  return features ? Object.keys(features) : [];
}

function kerningPairCount(font: Record<string, unknown>): number | undefined {
  const kernPairs = recordAt(recordAt(font, "kern") ?? {}, "kerningPairs");
  if (kernPairs) return Object.keys(kernPairs).length;
  const gposPairs = recordAt(recordAt(font, "GPOS") ?? {}, "kerningPairs");
  return gposPairs ? Object.keys(gposPairs).length : undefined;
}

export function readFeatures(font: unknown): { openTypeFeatures: string[]; kerningPairCount?: number } {
  if (!isRecord(font)) return { openTypeFeatures: [] };
  const openTypeFeatures = [...new Set([...featureKeys(font, "GSUB"), ...featureKeys(font, "GPOS")])];
  return { openTypeFeatures, kerningPairCount: kerningPairCount(font) };
}
