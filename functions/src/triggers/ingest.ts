import { onObjectFinalized } from "firebase-functions/v2/storage";
import { expandIntakeObject } from "../ingest/expandArchive";
import { handleUnprocessedObject } from "../ingest/processUpload";
import { INGEST_FUNCTION_OPTIONS } from "../options";

/**
 * Intake expander. Anything dropped under the intake prefix (loose fonts, zips,
 * nested zips, folder trees) is normalized here: fonts move to the unprocessed
 * prefix, archives are unzipped and their entries written back to intake so this
 * same trigger recurses. Source-agnostic and recursive — see ingestion-at-scale.
 */
export const expandArchive = onObjectFinalized(INGEST_FUNCTION_OPTIONS, (event) =>
  expandIntakeObject(event)
);

/**
 * Store-first ingestion trigger. Delegates to handleUnprocessedObject: parse →
 * canonicalize → woff2 → public bucket → family doc (`ready`). The font is
 * viewable + downloadable the instant this finishes; enrichment is batched.
 */
export const processUploadedFontStorage = onObjectFinalized(INGEST_FUNCTION_OPTIONS, (event) =>
  handleUnprocessedObject(event)
);
