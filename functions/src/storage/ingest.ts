/**
 * Store-first ingestion: parse -> canonicalize (Google Fonts model) -> transcode
 * to woff2 -> write canonical assets to the public bucket -> upsert the family
 * doc (status `ready`). The font is viewable + downloadable the moment this
 * returns; enrichment happens later via a Firestore trigger on the family doc.
 */
import * as crypto from 'crypto';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { serverParseFontFile } from '../parser/fontParser';
import {
  familySlug,
  familyFileBase,
  parseStyle,
  canonicalFilename,
  gfCategory,
} from './canonicalize';
import { toWoff2, FontFormat } from './transcode';
import { servedPath, originalPath, cdnUrl, publicBucketName } from '../config/catalogConfig';
import { upsertFace } from './familyStore';
import type { CanonicalAxis, FontFace, FontFamilyDoc } from '../models/catalog.models';

const IMMUTABLE = 'public, max-age=31536000, immutable';

export interface IngestResult {
  family: FontFamilyDoc;
  faceId: string;
}

/** Stable face id, e.g. "semibold", "bold-italic", or "vf"/"vf-italic". */
function faceId(weightName: string, italic: boolean, isVariable: boolean): string {
  if (isVariable) return italic ? 'vf-italic' : 'vf';
  return `${weightName.toLowerCase()}${italic ? '-italic' : ''}`;
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

  const familyName: string = parsed.familyName || 'Unknown Family';
  const slug = familySlug(familyName);
  const fileBase = familyFileBase(familyName);

  const isVariable = !!parsed.isVariable;
  const axisTags = (parsed.variableAxes || []).map((a: any) => a.tag).filter(Boolean);
  const { weight, weightName, italic } = parseStyle(parsed.subfamilyName, parsed.weight);
  const format = (parsed.format || 'OTF') as FontFormat;
  const origExt = format.toLowerCase();
  const category = gfCategory(parsed.classification, !!parsed.isFixedPitch);

  const nameOpts = { variable: isVariable, italic, weight, axisTags };
  const woff2Filename = canonicalFilename(familyName, nameOpts, 'woff2');
  const origFilename = canonicalFilename(familyName, nameOpts, origExt);

  // Content hash = immutable, cache-bustable path segment.
  const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const version = hash.slice(0, 8);

  const bucket = getStorage().bucket(publicBucketName());

  // 1) Original (download artifact).
  const origStoragePath = originalPath(slug, version, origFilename);
  await bucket.file(origStoragePath).save(fileBuffer, {
    resumable: false,
    contentType: contentType || `font/${origExt}`,
    metadata: { cacheControl: IMMUTABLE },
  });

  // 2) Web artifact: woff2 when possible, else serve the original under s/.
  const woff2 = await toWoff2(fileBuffer, format);
  let servedFilename = woff2Filename;
  let servedStoragePath = servedPath(slug, version, woff2Filename);
  if (woff2) {
    await bucket.file(servedStoragePath).save(Buffer.from(woff2), {
      resumable: false,
      contentType: 'font/woff2',
      metadata: { cacheControl: IMMUTABLE },
    });
  } else {
    logger.warn(`[${originalFilename}] woff2 transcode unavailable (${format}); serving original.`);
    servedFilename = origFilename;
    servedStoragePath = servedPath(slug, version, origFilename);
    await bucket.file(servedStoragePath).save(fileBuffer, {
      resumable: false,
      contentType: contentType || `font/${origExt}`,
      metadata: { cacheControl: IMMUTABLE },
    });
  }

  const axes: CanonicalAxis[] | undefined = isVariable
    ? (parsed.variableAxes || []).map((a: any) => ({
        tag: a.tag,
        min: a.minValue,
        max: a.maxValue,
        default: a.defaultValue,
        name: a.name,
      }))
    : undefined;

  const face: FontFace = {
    id: faceId(weightName, italic, isVariable),
    styleName: isVariable
      ? italic
        ? 'Italic Variable'
        : 'Variable'
      : `${weightName}${italic ? ' Italic' : ''}`,
    weight,
    weightName,
    italic,
    isVariable,
    axes,
    format,
    postScriptName: parsed.postScriptName,
    fullName: parsed.fullName,
    fileSize: fileBuffer.byteLength,
    filename: servedFilename,
    woff2: { storagePath: servedStoragePath, url: cdnUrl(servedStoragePath) },
    original: { storagePath: origStoragePath, url: cdnUrl(origStoragePath) },
    contentHash: hash,
    meta: {
      characterSetCoverage: parsed.characterSetCoverage,
      openTypeFeatures: parsed.openTypeFeatures,
      glyphCount: parsed.glyphCount,
      languageSupport: parsed.languageSupport,
      version: parsed.version,
      copyright: parsed.copyright,
      license: parsed.licenseUrl || undefined,
    },
  };

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
