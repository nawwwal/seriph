import { NextRequest } from 'next/server';
import { getAdminDb, getAdminStorage } from '@/lib/firebase/admin';
import { fail, ok } from '@/lib/server/apiResponse';
import { resolveUploadUid } from '@/lib/server/uploadAuth';
import { mapWithConcurrency } from '@/lib/upload/boundedConcurrency';
import { DIRECT_UPLOAD_LIMITS, uploadDirectFile } from '@/lib/upload/directUpload';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = await resolveUploadUid(request);
  if ('error' in auth) return fail('unauthorized', 'Unauthorized', 401);

  try {
    const formData = await request.formData();
    const files = formData.getAll('fonts').filter((file): file is File => file instanceof File);
    if (files.length === 0) return fail('bad_request', 'No files uploaded.', 400);
    if (files.length > DIRECT_UPLOAD_LIMITS.MAX_FILES_PER_REQUEST) return fail('payload_too_large', `Too many files. Max ${DIRECT_UPLOAD_LIMITS.MAX_FILES_PER_REQUEST}.`, 413);

    const bucket = getAdminStorage().bucket();
    const db = getAdminDb();
    const results = await mapWithConcurrency(files, 3, (file) => uploadDirectFile(file, auth.uid, bucket, db));
    const succeeded = results.filter((result) => result.success).length;
    if (succeeded === 0) return fail('bad_request', 'All file submissions failed.', 400, results);
    return ok({ message: `Submission finished: ${succeeded} sent for processing, ${results.length - succeeded} failed.`, results });
  } catch (error) {
    console.error('POST /api/v1/uploads/direct-submissions failed', error);
    return fail('internal_error', 'Failed to process upload request.', 500);
  }
}
