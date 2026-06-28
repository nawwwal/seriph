import { v4 as uuidv4 } from 'uuid';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { NORMALIZATION_SPEC_VERSION } from '@/utils/normalizationSpec';

export const REGISTER_LIMITS = {
  MAX_FILE_SIZE: 512 * 1024 * 1024, // archives can be large; expansion handles fonts
  MAX_FILES_PER_REQUEST: 200,
};
const INTAKE_PATH = 'intake';

export interface FileInfo {
  originalName: string;
  size: number;
  relativePath?: string;
  contentType?: string;
  contentHash?: string;
  quickHash?: string;
  normalizationSpecVersion?: string;
  previewFamilyKey?: string;
}

export interface Registration {
  success: boolean;
  originalName: string;
  ingestId?: string;
  storagePath?: string;
  processingId?: string;
  requestId?: string;
  error?: string;
}

function sanitizeRel(rel: string): string {
  return rel.replace(/\\/g, '/').replace(/\.\.+/g, '').replace(/^\/+/, '');
}

/** Validate one file, dedupe by contentHash, and create an intake ingest doc. */
export async function registerOneFile(
  fileInfo: FileInfo,
  uid: string,
  batchId: string,
  firestore: Firestore
): Promise<Registration> {
  if (fileInfo.size > REGISTER_LIMITS.MAX_FILE_SIZE) {
    return { success: false, originalName: fileInfo.originalName, error: `File exceeds ${REGISTER_LIMITS.MAX_FILE_SIZE / (1024 * 1024)}MB limit.` };
  }

  const ext = fileInfo.originalName.split('.').pop()?.toLowerCase();

  if (fileInfo.contentHash) {
    try {
      const dup = await firestore
        .collection('users').doc(uid).collection('ingests')
        .where('contentHash', '==', fileInfo.contentHash).limit(1).get();
      if (!dup.empty) {
        const existing = dup.docs[0].data();
        return { success: false, originalName: fileInfo.originalName, error: 'duplicate', ingestId: existing.ingestId || dup.docs[0].id };
      }
    } catch (e) {
      console.warn('Duplicate check failed:', e);
    }
  }

  const processingId = firestore.collection('_').doc().id;
  const ingestRef = firestore.collection('users').doc(uid).collection('ingests').doc();
  const ingestId = ingestRef.id;
  const requestId = uuidv4();
  const relPath = sanitizeRel(fileInfo.relativePath || fileInfo.originalName);
  const destPath = `${INTAKE_PATH}/${batchId}/${processingId}-${fileInfo.originalName}`;

  try {
    const now = FieldValue.serverTimestamp();
    await ingestRef.set({
      ingestId, ownerId: uid, requestId, processingId, batchId, relPath,
      originalName: fileInfo.originalName, originalExtension: ext, originalSize: fileInfo.size,
      status: 'uploaded', error: null, errorCode: null, intakePath: destPath,
      uploadSource: 'web-app', contentType: fileInfo.contentType || null,
      createdAt: now, updatedAt: now, uploadedAt: now, events: [],
      contentHash: fileInfo.contentHash || null, quickHash: fileInfo.quickHash || null,
      normalizationSpecVersion: fileInfo.normalizationSpecVersion || NORMALIZATION_SPEC_VERSION,
      previewFamilyKey: fileInfo.previewFamilyKey || null,
      analysisState: 'not_started', uploadState: 'pending', uploadProgress: 0,
    });
    return { success: true, originalName: fileInfo.originalName, ingestId, storagePath: destPath, processingId, requestId };
  } catch (error: any) {
    console.error(`Error creating ingest for ${fileInfo.originalName}:`, error);
    return { success: false, originalName: fileInfo.originalName, error: 'Failed to register upload. Please try again.' };
  }
}
