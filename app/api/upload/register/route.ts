import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getAdminDb } from '@/lib/firebase/admin';
import { resolveUploadUid } from '@/lib/server/uploadAuth';
import { registerOneFile, REGISTER_LIMITS, type FileInfo, type Registration } from '@/lib/upload/registerFiles';

export const runtime = 'nodejs';

interface RegisterRequest {
  batchId?: string;
  files: FileInfo[];
}

/** Register uploads and return storage paths for client-side resumable uploads. */
export async function POST(request: NextRequest) {
  const auth = await resolveUploadUid(request);
  if ('error' in auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const uid = auth.uid;

  try {
    const body: RegisterRequest = await request.json();
    const files = body.files;
    const batchId = body.batchId || uuidv4();

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files specified.' }, { status: 400 });
    }
    if (files.length > REGISTER_LIMITS.MAX_FILES_PER_REQUEST) {
      return NextResponse.json({ error: `Too many files. Max ${REGISTER_LIMITS.MAX_FILES_PER_REQUEST}.` }, { status: 413 });
    }

    const firestore = getAdminDb();
    const results: Registration[] = [];
    for (const fileInfo of files) {
      results.push(await registerOneFile(fileInfo, uid, batchId, firestore));
    }

    if (results.every((r) => !r.success) && results.length > 0) {
      return NextResponse.json({ message: 'All file registrations failed.', results }, { status: 400 });
    }
    return NextResponse.json({
      message: `Registered ${results.filter((r) => r.success).length} file(s) for upload.`,
      batchId,
      results,
    });
  } catch (error: any) {
    console.error('API Upload Register Route Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process registration request.' }, { status: 500 });
  }
}
