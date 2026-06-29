import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getAdminDb } from '@/lib/firebase/admin';
import { readJsonObject } from '@/lib/server/apiRequest';
import { fail, ok } from '@/lib/server/apiResponse';
import { resolveUploadUid } from '@/lib/server/uploadAuth';
import { mapWithConcurrency } from '@/lib/upload/boundedConcurrency';
import { isFileInfoArray } from '@/lib/upload/fileInfoGuards';
import { REGISTER_LIMITS, registerOneFile, type Registration } from '@/lib/upload/registerFiles';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = await resolveUploadUid(request);
  if ('error' in auth) return fail('unauthorized', 'Unauthorized', 401);

  try {
    const body = await readJsonObject(request);
    if (!body.ok) return fail('bad_request', body.message, 400);
    const files = body.value.files;
    const batchId = typeof body.value.batchId === 'string' ? body.value.batchId : uuidv4();
    if (!isFileInfoArray(files) || files.length === 0) return fail('bad_request', 'No files specified.', 400);
    if (files.length > REGISTER_LIMITS.MAX_FILES_PER_REQUEST) return fail('payload_too_large', `Too many files. Max ${REGISTER_LIMITS.MAX_FILES_PER_REQUEST}.`, 413);

    const db = getAdminDb();
    const results: Registration[] = await mapWithConcurrency(files, 4, (fileInfo) => registerOneFile(fileInfo, auth.uid, batchId, db));
    if (results.every((result) => !result.success)) return fail('bad_request', 'All file registrations failed.', 400, results);
    return ok({ message: `Registered ${results.filter((result) => result.success).length} file(s) for upload.`, batchId, results });
  } catch (error) {
    console.error('POST /api/v1/uploads/registrations failed', error);
    return fail('internal_error', 'Failed to process registration request.', 500);
  }
}
