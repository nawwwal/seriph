/**
 * Store-first ingestion: parse -> canonicalize (Google Fonts model) -> transcode
 * to woff2 -> write canonical assets to the public bucket -> upsert the family
 * doc (status `ready`). The font is viewable + downloadable the moment this
 * returns; enrichment happens later on the batch cadence.
 */
import * as crypto from "crypto";
import { logger } from "firebase-functions";
import { serverParseFontFile } from "../parser/fontParser";
import { parseStyle, canonicalFilename, gfCategory, resolveCanonicalFontIdentity, canonicalFaceId } from "./canonicalize";
import { FontFormat } from "./transcode";
import { upsertFace } from "./familyStore";
import { writeArtifacts } from "./writeArtifacts";
import { buildFace } from "./buildFace";
import type { CanonicalAxis, FontFamilyDoc } from "../models/catalog.models";

export interface IngestResult {
  family: FontFamilyDoc;
  faceId: string;
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

  const identity = resolveCanonicalFontIdentity(parsed);
  const { familyName, slug, fileBase, styleName } = identity;

  const isVariable = !!parsed.isVariable;
  const axisTags = (parsed.variableAxes || []).map((a: any) => a.tag).filter(Boolean);
  const { weight, weightName, italic } = parseStyle(styleName, parsed.weight);
  const format = (parsed.format || "OTF") as FontFormat;
  const origExt = format.toLowerCase();
  const category = gfCategory(parsed.classification, !!parsed.isFixedPitch);

  const nameOpts = { variable: isVariable, italic, weight, axisTags, styleName };
  const woff2Filename = canonicalFilename(familyName, nameOpts, "woff2");
  const origFilename = canonicalFilename(familyName, nameOpts, origExt);

  const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
  const version = hash.slice(0, 8);

  const { origStoragePath, servedStoragePath, servedFilename } = await writeArtifacts({
    slug, version, fileBuffer, format, origExt, origFilename, woff2Filename, contentType, logLabel: originalFilename,
  });

  const axes: CanonicalAxis[] | undefined = isVariable
    ? (parsed.variableAxes || []).map((a: any) => ({
        tag: a.tag, min: a.minValue, max: a.maxValue, default: a.defaultValue, name: a.name,
      }))
    : undefined;

  const face = buildFace({
    parsed, faceId: canonicalFaceId(styleName, isVariable), styleName, weight, weightName, italic, isVariable, axes, format,
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
