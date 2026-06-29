import { v4 as uuidv4 } from 'uuid';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { Storage } from 'firebase-admin/storage';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB per file
const ALLOWED_FONT_EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2', 'eot'];
const UNPROCESSED_FONTS_PATH = 'unprocessed_fonts';

export const DIRECT_UPLOAD_LIMITS = { MAX_FILE_SIZE, MAX_FILES_PER_REQUEST: 20 };

export interface DirectUploadResult {
  success: boolean;
  originalName: string;
  message?: string;
  error?: string;
  ingestId?: string;
}

function uploadError(error: unknown): { code?: string; message: string } {
  if (error instanceof Error) return { message: error.message };
  if (error && typeof error === 'object') {
    const value = error as { code?: unknown; message?: unknown };
    return {
      code: typeof value.code === 'string' ? value.code : undefined,
      message: typeof value.message === 'string' ? value.message : 'Upload failed.',
    };
  }
  return { message: 'Upload failed.' };
}

/** Validate one file, register an ingest doc, and upload it to the unprocessed prefix. */
export async function uploadDirectFile(
  file: File,
  uid: string,
  bucket: ReturnType<Storage['bucket']>,
  firestore: Firestore
): Promise<DirectUploadResult> {
  if (file.size > MAX_FILE_SIZE) {
    return { success: false, originalName: file.name, error: `File exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit.` };
  }
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'zip') {
    return { success: false, originalName: file.name, error: 'ZIP uploads are handled by a different process.' };
  }
  if (!ext || !ALLOWED_FONT_EXTENSIONS.includes(ext)) {
    return { success: false, originalName: file.name, error: 'Unsupported file type.' };
  }

  const processingId = firestore.collection('_').doc().id;
  const ingestRef = firestore.collection('users').doc(uid).collection('ingests').doc();
  const ingestId = ingestRef.id;
  const requestId = uuidv4();
  const destPath = `${UNPROCESSED_FONTS_PATH}/${processingId}-${file.name}`;

  try {
    const now = FieldValue.serverTimestamp();
    await ingestRef.set({
      ingestId, ownerId: uid, requestId, processingId,
      originalName: file.name, originalExtension: ext, originalSize: file.size,
      status: 'uploaded', error: null, errorCode: null, unprocessedPath: destPath,
      uploadSource: 'web-app', contentType: file.type || null,
      createdAt: now, updatedAt: now, uploadedAt: now, events: [],
    });
  } catch (error) {
    console.error(`Error creating ingest for ${file.name}:`, error);
    return { success: false, originalName: file.name, error: 'Failed to register upload. Please try again.' };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await bucket.file(destPath).save(buffer, {
      resumable: false,
      metadata: {
        contentType: file.type || 'application/octet-stream',
        metadata: { originalName: file.name, ownerId: uid, ingestId, processingId, requestId, uploadSource: 'web-app' },
      },
    });
    return { success: true, originalName: file.name, message: 'File submitted for processing.', ingestId };
  } catch (error) {
    const failure = uploadError(error);
    console.error(`Error uploading ${file.name}:`, error);
    try {
      await ingestRef.set(
        { status: 'failed', error: failure.message, errorCode: failure.code || 'upload_failed', updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    } catch (updateError) {
      console.error(`Failed to mark ingest ${ingestId} failed:`, updateError);
    }
    return { success: false, originalName: file.name, error: `Failed to submit file: ${failure.code || failure.message}` };
  }
}
