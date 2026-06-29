import { familySlug } from "../storage/canonicalize";
import { FAMILIES_COLLECTION } from "../storage/familyStore";
import type { LegacyFontSource } from "./migrateOldSchemaTypes";
import { isRecord, stringField } from "./migrateOldSchemaTypes";

function splitStoragePath(rawPath: string): { bucketName?: string; storagePath: string } | null {
  if (rawPath.startsWith("gs://")) {
    const withoutScheme = rawPath.slice("gs://".length);
    const slash = withoutScheme.indexOf("/");
    if (slash <= 0) return null;
    return { bucketName: withoutScheme.slice(0, slash), storagePath: withoutScheme.slice(slash + 1) };
  }
  if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) return null;
  return { storagePath: rawPath.replace(/^\/+/, "") };
}

export function collectLegacyFontSources(family: unknown): LegacyFontSource[] {
  if (!isRecord(family) || !Array.isArray(family.fonts)) return [];
  return family.fonts.flatMap((font, index): LegacyFontSource[] => {
    if (!isRecord(font)) return [];
    const metadata = isRecord(font.metadata) ? font.metadata : undefined;
    const rawPath = stringField(metadata, "storagePath") ?? stringField(font, "storagePath");
    if (!rawPath) return [];
    const split = splitStoragePath(rawPath);
    if (!split) return [];
    const fallbackId = `font-${index + 1}`;
    return [{
      fontId: stringField(font, "id") ?? fallbackId,
      filename: stringField(font, "filename") ?? `${stringField(font, "id") ?? fallbackId}.otf`,
      ...split,
    }];
  });
}

export function ownerFromLegacyPath(path: string): string | undefined {
  const parts = path.split("/");
  return parts[0] === "users" && parts[2] === FAMILIES_COLLECTION ? parts[1] : undefined;
}

export function legacyTargetSlug(data: unknown, fallbackId: string): string {
  if (!isRecord(data)) return fallbackId;
  return familySlug(stringField(data, "name") ?? stringField(data, "normalizedName") ?? fallbackId);
}
