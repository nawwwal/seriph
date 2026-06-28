import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";
import { toWoff2, FontFormat } from "./transcode";
import { servedPath, originalPath, publicBucketName } from "../config/catalogConfig";

const IMMUTABLE = "public, max-age=31536000, immutable";

export interface WrittenArtifacts {
  origStoragePath: string;
  servedStoragePath: string;
  servedFilename: string;
}

/** Write the original (download) artifact and the web artifact (woff2, or the
 *  original under s/ when transcode is unavailable) to the public bucket. */
export async function writeArtifacts(params: {
  slug: string;
  version: string;
  fileBuffer: Buffer;
  format: FontFormat;
  origExt: string;
  origFilename: string;
  woff2Filename: string;
  contentType?: string;
  logLabel: string;
}): Promise<WrittenArtifacts> {
  const { slug, version, fileBuffer, format, origExt, origFilename, woff2Filename, contentType, logLabel } = params;
  const bucket = getStorage().bucket(publicBucketName());

  const origStoragePath = originalPath(slug, version, origFilename);
  await bucket.file(origStoragePath).save(fileBuffer, {
    resumable: false,
    contentType: contentType || `font/${origExt}`,
    metadata: { cacheControl: IMMUTABLE },
  });

  const woff2 = await toWoff2(fileBuffer, format);
  let servedFilename = woff2Filename;
  let servedStoragePath = servedPath(slug, version, woff2Filename);
  if (woff2) {
    await bucket.file(servedStoragePath).save(Buffer.from(woff2), {
      resumable: false,
      contentType: "font/woff2",
      metadata: { cacheControl: IMMUTABLE },
    });
  } else {
    logger.warn(`[${logLabel}] woff2 transcode unavailable (${format}); serving original.`);
    servedFilename = origFilename;
    servedStoragePath = servedPath(slug, version, origFilename);
    await bucket.file(servedStoragePath).save(fileBuffer, {
      resumable: false,
      contentType: contentType || `font/${origExt}`,
      metadata: { cacheControl: IMMUTABLE },
    });
  }

  return { origStoragePath, servedStoragePath, servedFilename };
}
