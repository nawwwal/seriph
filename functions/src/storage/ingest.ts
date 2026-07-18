/**
 * Store-first ingestion: parse -> canonicalize (Google Fonts model) -> transcode
 * to woff2 -> write canonical assets to the public bucket -> upsert the family
 * doc (status `ready`). The font is viewable + downloadable the moment this
 * returns; enrichment happens later on the batch cadence.
 */
import * as crypto from "crypto";
import { logger } from "firebase-functions";
import { serverParseFontFile } from "../parser/fontParser";
import {
  familyFileBase,
  canonicalFilename,
  gfCategory,
  resolvePlannedFontIdentity,
  weightNameFromNumber,
} from "./canonicalize";
import type { GfCategory, PlannedFontIdentity } from "./canonicalize";
import type { FontFormat } from "./transcode";
import { upsertFace } from "./familyStore";
import { writeArtifacts } from "./writeArtifacts";
import { buildFace } from "./buildFace";
import type { CanonicalAxis, FontFamilyDoc } from "../models/catalog.models";

export interface IngestResult {
  family: FontFamilyDoc;
  faceId: string;
}

export interface IngestPlan {
  identity: PlannedFontIdentity;
  familyName: string;
  slug: string;
  fileBase: string;
  styleName: string;
  isVariable: boolean;
  axisTags: string[];
  axes?: CanonicalAxis[];
  weight: number;
  weightName: string;
  italic: boolean;
  format: FontFormat;
  origExt: string;
  category: GfCategory;
  faceId: string;
}

/** Build the identity and persistence fields consumed by the upload writer. */
export function planIngestedFont(parsed: any, originalFilename: string): IngestPlan {
  const identity = resolvePlannedFontIdentity({
    ...parsed,
    filename: originalFilename,
    format: parsed.format ?? parsed.detectedFormat,
  });
  const isVariable = identity.technology === "Variable";
  const axisTags = (parsed.variableAxes || []).map((axis: any) => axis.tag).filter(Boolean);
  const { weight, italic } = identity;
  const weightName = weightNameFromNumber(weight);
  const format = identity.containerFormat;
  const axes: CanonicalAxis[] | undefined = isVariable
    ? (parsed.variableAxes || []).map((axis: any) => ({
        tag: axis.tag, min: axis.minValue, max: axis.maxValue, default: axis.defaultValue, name: axis.name,
      }))
    : undefined;
  return {
    identity,
    familyName: identity.familyName,
    slug: identity.familySlug,
    fileBase: familyFileBase(identity.familyName),
    styleName: identity.styleName,
    isVariable,
    axisTags,
    axes,
    weight,
    weightName,
    italic,
    format,
    origExt: format.toLowerCase(),
    category: gfCategory(parsed.classification, !!parsed.isFixedPitch),
    faceId: identity.logicalFaceKey,
  };
}

export async function ingestFont(params: {
  fileBuffer: Buffer;
  originalFilename: string;
  ownerId?: string;
  contentType?: string;
}): Promise<IngestResult | null> {
  const { fileBuffer, originalFilename, ownerId, contentType } = params;

  const parsed = await serverParseFontFile(fileBuffer, originalFilename);
  if (!parsed) return null;

  const plan = planIngestedFont(parsed, originalFilename);
  const { familyName, slug, fileBase, styleName, isVariable, axisTags, weight, italic, format, origExt, category } = plan;
  const { weightName } = plan;

  const nameOpts = { variable: isVariable, italic, weight, axisTags, styleName };
  const woff2Filename = canonicalFilename(familyName, nameOpts, "woff2");
  const origFilename = canonicalFilename(familyName, nameOpts, origExt);

  const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
  const version = hash.slice(0, 8);

  const { origStoragePath, servedStoragePath, servedFilename } = await writeArtifacts({
    slug, version, fileBuffer, format, origExt, origFilename, woff2Filename, contentType, logLabel: originalFilename,
  });

  const { axes } = plan;

  const face = buildFace({
    parsed, faceId: plan.faceId, styleName, weight, weightName, italic, isVariable, axes, format,
    fileSize: fileBuffer.byteLength, servedFilename, servedStoragePath, origStoragePath, contentHash: hash,
  });

  const family = await upsertFace({
    slug,
    name: familyName,
    fileBase,
    category,
    classification: parsed.classification,
    foundry: parsed.foundry,
    designer: parsed.designer,
    license: parsed.licenseUrl || undefined,
    ownerId,
    familyAxes: axes,
    face,
  });

  logger.info(`[${originalFilename}] Ingested into family ${slug} as face ${face.id}.`);
  return { family, faceId: face.id };
}
