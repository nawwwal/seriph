import { logger } from "firebase-functions";
import * as unzipper from "unzipper";
import { db, storage } from "../bootstrap/adminApp";
import { extOf, bumpLedger } from "./intakeLedger";
import { emitFont } from "./emitFont";
import { buildIntakePath } from "./intakePath";

export const FONT_EXTS = ["ttf", "otf", "woff", "woff2", "eot"];
export const MAX_EXPAND_DEPTH = 4;
// Inline (in-function) unzip ceiling. Larger archives should be routed to a
// Cloud Run job that streams from Storage (Phase 3 — not yet deployed).
export const MAX_INLINE_ZIP_BYTES = 150 * 1024 * 1024;

export interface ZipContext {
  bucket: string;
  intake: string;
  unprocessed: string;
  ownerId: string | null;
  batchId: string | null;
  relPath: string;
  depth: number;
}

/** Unzip one archive buffer: emit fonts, write nested zips back to intake to recurse. */
export async function expandZip(buffer: Buffer, ctx: ZipContext): Promise<void> {
  let directory: unzipper.CentralDirectory;
  try {
    directory = await unzipper.Open.buffer(buffer);
  } catch (e: any) {
    logger.error(`Failed to open zip`, { message: e?.message });
    return;
  }

  for (const entry of directory.files) {
    if (entry.type !== "File") continue;
    const entryName = entry.path.split("/").pop() || entry.path;
    if (!entryName || entryName.startsWith(".")) continue;
    const entryExt = extOf(entryName);
    const entryRel = `${ctx.relPath}/${entry.path}`;

    if (FONT_EXTS.includes(entryExt)) {
      await emitFont({
        bucket: ctx.bucket, buffer: await entry.buffer(), fileName: entryName,
        ownerId: ctx.ownerId, batchId: ctx.batchId, relPath: entryRel, unprocessedPrefix: ctx.unprocessed,
      });
    } else if (entryExt === "zip") {
      const objectName = `${db.collection("_").doc().id}-${entryName}`;
      const nestedDest = ctx.ownerId
        ? buildIntakePath({
            intakePrefix: ctx.intake,
            ownerId: ctx.ownerId,
            batchId: ctx.batchId || "nested",
            objectName,
          })
        : `${ctx.intake}/${ctx.batchId || "nested"}/${objectName}`;
      await storage.bucket(ctx.bucket).file(nestedDest).save(await entry.buffer(), {
        resumable: false,
        metadata: {
          metadata: {
            ownerId: ctx.ownerId || "", batchId: ctx.batchId || "",
            relPath: entryRel, expandDepth: String(ctx.depth + 1),
          },
        },
      });
    } else {
      await bumpLedger(ctx.ownerId, ctx.batchId, "skipped");
    }
  }
}
