import { NextRequest } from 'next/server';
import { getAdminStorage, getAdminDb } from '@/lib/firebase/admin';
import type { Storage } from 'firebase-admin/storage';
import { fail, ok } from '@/lib/server/apiResponse';
import { resolveUploadUid } from '@/lib/server/uploadAuth';
import { mapWithConcurrency } from '@/lib/upload/boundedConcurrency';
import { uploadDirectFile, DIRECT_UPLOAD_LIMITS } from '@/lib/upload/directUpload';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = await resolveUploadUid(request);
  if ('error' in auth) return fail('unauthorized', 'Unauthorized', 401);

  try {
    const formData = await request.formData();
    const files = formData.getAll('fonts').filter((item): item is File => item instanceof File);
    if (files.length === 0) return fail('bad_request', 'No files uploaded.', 400);
    if (files.length > DIRECT_UPLOAD_LIMITS.MAX_FILES_PER_REQUEST) {
      return fail('payload_too_large', `Too many files. Max ${DIRECT_UPLOAD_LIMITS.MAX_FILES_PER_REQUEST}.`, 413);
    }

    let bucket: ReturnType<Storage['bucket']>;
    try {
      bucket = getAdminStorage().bucket();
    } catch (storageError) {
      console.error('Firebase Storage is not configured correctly.', storageError);
      return fail('internal_error', 'Storage service unavailable. Contact an administrator.', 500);
    }

    const firestore = getAdminDb();
    const results = await mapWithConcurrency(files, 3, (file) => uploadDirectFile(file, auth.uid, bucket, firestore));

    const succeeded = results.filter((r) => r.success).length;
    if (succeeded === 0 && results.length > 0) {
      return fail('bad_request', 'All file submissions failed.', 400, results);
    }
    return ok({
      message: `Submission finished: ${succeeded} sent for processing, ${results.length - succeeded} failed.`,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process upload request.';
    console.error('API Upload Route Error:', error);
    return fail('internal_error', message, 500);
  }
}
