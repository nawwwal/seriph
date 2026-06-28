import { NextRequest, NextResponse } from 'next/server';
import { getAdminStorage, getAdminDb } from '@/lib/firebase/admin';
import type { Storage } from 'firebase-admin/storage';
import { resolveUploadUid } from '@/lib/server/uploadAuth';
import { uploadDirectFile, DIRECT_UPLOAD_LIMITS } from '@/lib/upload/directUpload';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = await resolveUploadUid(request);
  if ('error' in auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const uid = auth.uid;

  try {
    const formData = await request.formData();
    const files = formData.getAll('fonts') as File[];
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded.' }, { status: 400 });
    }
    if (files.length > DIRECT_UPLOAD_LIMITS.MAX_FILES_PER_REQUEST) {
      return NextResponse.json({ error: `Too many files. Max ${DIRECT_UPLOAD_LIMITS.MAX_FILES_PER_REQUEST}.` }, { status: 413 });
    }

    let bucket: ReturnType<Storage['bucket']>;
    try {
      bucket = getAdminStorage().bucket();
    } catch (storageError: any) {
      console.error('Firebase Storage is not configured correctly.', storageError);
      return NextResponse.json({ error: 'Storage service unavailable. Contact an administrator.' }, { status: 500 });
    }

    const firestore = getAdminDb();
    const results = [];
    for (const file of files) {
      results.push(await uploadDirectFile(file, uid, bucket, firestore));
    }

    const succeeded = results.filter((r) => r.success).length;
    if (succeeded === 0 && results.length > 0) {
      return NextResponse.json({ message: 'All file submissions failed.', results }, { status: 400 });
    }
    return NextResponse.json({
      message: `Submission finished: ${succeeded} sent for processing, ${results.length - succeeded} failed.`,
      results,
    });
  } catch (error: any) {
    console.error('API Upload Route Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process upload request.' }, { status: 500 });
  }
}
