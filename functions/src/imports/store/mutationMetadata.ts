import type { CanonicalAxis, FontAsset, FontFace, FontFaceMeta } from "../../models/catalog.assets";
import type { FontFamilyDoc } from "../../models/catalog.models";
import { gfCategory } from "../../storage/canonicalCategory";
import type { DiscoveredFontMetadata } from "../discovery/inventory";
import type { WrittenPlannedAsset } from "../apply/writePlannedAssets";

function mergeFamilyAxes(faces: readonly FontFace[]): CanonicalAxis[] {
  const byTag = new Map<string, CanonicalAxis>();
  for (const face of faces) {
    for (const axis of face.axes ?? []) byTag.set(axis.tag, axis);
  }
  return [...byTag.values()];
}

function asAxes(raw: DiscoveredFontMetadata["variableAxes"]): CanonicalAxis[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const axes = raw.flatMap((item): CanonicalAxis[] => {
    const tag = typeof item.tag === "string" ? item.tag : "";
    const min = typeof item.min === "number" ? item.min : Number.NaN;
    const max = typeof item.max === "number" ? item.max : Number.NaN;
    const def = typeof item.default === "number" ? item.default : typeof item.defaultValue === "number" ? item.defaultValue : min;
    if (!tag || !Number.isFinite(min) || !Number.isFinite(max)) return [];
    return [{ tag, name: typeof item.name === "string" ? item.name : tag, min, max, default: def }];
  });
  return axes.length ? axes : undefined;
}

export function faceMetaFromMetadata(meta: DiscoveredFontMetadata | undefined): FontFaceMeta | undefined {
  if (!meta) return undefined;
  const out: FontFaceMeta = {
    ...(typeof meta.glyphCount === "number" ? { glyphCount: meta.glyphCount } : {}),
    ...(Array.isArray(meta.openTypeFeatures) ? { openTypeFeatures: [...meta.openTypeFeatures] } : {}),
    ...(Array.isArray(meta.languageSupport) ? { languageSupport: [...meta.languageSupport] } : {}),
    ...(Array.isArray(meta.characterSetCoverage) ? { characterSetCoverage: [...meta.characterSetCoverage] } : {}),
    ...(meta.version ? { version: meta.version } : {}),
    ...(meta.licenseUrl ? { license: meta.licenseUrl } : {}),
    ...(meta.preferredFamily ? { preferredFamily: meta.preferredFamily } : {}),
    ...(meta.preferredSubfamily ? { preferredSubfamily: meta.preferredSubfamily } : {}),
    ...(meta.wwsFamilyName ? { wwsFamilyName: meta.wwsFamilyName } : {}),
    ...(meta.wwsSubfamilyName ? { wwsSubfamilyName: meta.wwsSubfamilyName } : {}),
    ...(typeof meta.isFixedPitch === "boolean" ? { isFixedPitch: meta.isFixedPitch } : {}),
  };
  return Object.keys(out).length ? out : undefined;
}

export function faceFieldsFromAssets(assets: readonly WrittenPlannedAsset[], existing?: FontFace): Partial<FontFace> {
  const metas = assets.map((asset) => asset.source.fontMetadata).filter((m): m is DiscoveredFontMetadata => Boolean(m));
  const primary = metas[0];
  const axes = asAxes(primary?.variableAxes) ?? existing?.axes;
  const isVariable = Boolean(axes?.length) || Boolean(primary?.isVariable && primary?.variableAxes?.length) || Boolean(existing?.isVariable && existing?.axes?.length);
  const meta = faceMetaFromMetadata(primary) ?? existing?.meta;
  return {
    isVariable,
    ...(axes ? { axes } : {}),
    ...(meta ? { meta } : {}),
    ...(primary?.postScriptName ?? existing?.postScriptName ? { postScriptName: primary?.postScriptName ?? existing?.postScriptName } : {}),
    ...(primary?.fullName ?? existing?.fullName ? { fullName: primary?.fullName ?? existing?.fullName } : {}),
  };
}

export function familyFieldsFromClaims(
  existing: FontFamilyDoc | undefined,
  assets: readonly WrittenPlannedAsset[],
  faces: readonly FontFace[],
  now: Date,
): Partial<FontFamilyDoc> {
  const metas = assets.map((asset) => asset.source.fontMetadata).filter((m): m is DiscoveredFontMetadata => Boolean(m));
  const primary = metas[0];
  const axes = mergeFamilyAxes(faces);
  const isVariable = faces.some((face) => face.isVariable === true) || axes.length > 0;
  const classification = existing?.classification ?? primary?.classification;
  const category = existing?.category ?? gfCategory(classification, primary?.isFixedPitch);
  return {
    category,
    ...(classification ? { classification } : {}),
    ...(existing?.foundry ?? primary?.foundry ? { foundry: existing?.foundry ?? primary?.foundry } : {}),
    ...(existing?.designer ?? primary?.designer ? { designer: existing?.designer ?? primary?.designer } : {}),
    ...(existing?.license ?? primary?.licenseUrl ? { license: existing?.license ?? primary?.licenseUrl } : {}),
    isVariable,
    ...(axes.length ? { axes } : {}),
    createdAt: existing?.createdAt ?? now,
  };
}

export function assetSizeBytes(assets: readonly WrittenPlannedAsset[], preferred: FontAsset | undefined, existing?: FontFace): number {
  if (!preferred?.contentHash) return existing?.fileSize ?? 0;
  const matched = assets.find((asset) => asset.sha256 === preferred.contentHash);
  return matched ? matched.bytes.byteLength : (existing?.fileSize ?? 0);
}
