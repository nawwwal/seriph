import type { FontEnrichment, FontFace, FontFamilyDoc } from "../models/catalog.models";
import { OLD_SCHEMA_MIGRATION_VERSION, isRecord, stringArray, stringField, unique } from "./migrateOldSchemaTypes";

export function isCatalogFamilyDoc(data: unknown): data is FontFamilyDoc {
  return isRecord(data) && Array.isArray(data.faces);
}

export function hasCompletedOldSchemaMigration(data: unknown): boolean {
  if (!isRecord(data) || !isRecord(data.oldSchemaMigration)) return false;
  return (
    stringField(data.oldSchemaMigration, "version") === OLD_SCHEMA_MIGRATION_VERSION &&
    Boolean(stringField(data.oldSchemaMigration, "targetPath"))
  );
}

export function repairFaceVariableState(face: FontFace): FontFace {
  const axes = Array.isArray(face.axes) && face.axes.length > 0 ? face.axes : undefined;
  return { ...face, isVariable: Boolean(axes), axes };
}

export function repairFamilyVariableState(family: FontFamilyDoc): { family: FontFamilyDoc; changed: boolean } {
  const faces = (family.faces ?? []).map(repairFaceVariableState);
  const changed = faces.some((face, index) => face.isVariable !== family.faces[index]?.isVariable || face.axes !== family.faces[index]?.axes);
  const axes = faces.flatMap((face) => face.axes ?? []);
  return { family: { ...family, faces, axes: axes.length ? axes : undefined }, changed };
}

export function buildLegacyEnrichment(legacy: unknown, fallbackCategory: FontFamilyDoc["category"]): FontEnrichment | undefined {
  if (!isRecord(legacy)) return undefined;
  const metadata = isRecord(legacy.metadata) ? legacy.metadata : undefined;
  const classification = stringField(metadata, "subClassification") ?? stringField(legacy, "classification");
  const summary = stringField(legacy, "description");
  const moods = unique([...stringArray(legacy.tags), ...stringArray(metadata?.moods)]);
  const useCases = unique(stringArray(metadata?.useCases));
  if (!classification && !summary && moods.length === 0 && useCases.length === 0) return undefined;
  const enrichment: FontEnrichment = {
    category: fallbackCategory,
    modelId: "legacy-schema-migration",
    promptVersion: "legacy-schema",
  };
  if (classification) enrichment.classification = classification;
  if (summary) enrichment.summary = summary;
  if (moods.length) enrichment.moods = moods;
  if (useCases.length) enrichment.useCases = useCases;
  return enrichment;
}
