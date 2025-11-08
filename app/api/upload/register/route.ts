import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getAdminDb, getAdminAuth } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { NORMALIZATION_SPEC_VERSION } from '@/utils/normalizationSpec';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB per file limit
const ALLOWED_FONT_EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2', 'eot'];
const UNPROCESSED_FONTS_PATH = 'unprocessed_fonts';
const MAX_FILES_PER_REQUEST = 20;

interface RegisterRequest {
  files: Array<{
    originalName: string;
    size: number;
    contentType?: string;
    contentHash?: string;
    quickHash?: string;
    normalizationSpecVersion?: string;
    previewFamilyKey?: string;
  }>;
}

/**
 * Register uploads and return storage paths for resumable uploads
 */
export async function POST(request: NextRequest) {
  let uid: string | null = null;
  const authHeader = request.headers.get('authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  
  if (bearer) {
    try {
      const adminAuth = getAdminAuth();
      const decoded = await adminAuth.verifyIdToken(bearer);
      uid = decoded.uid;
    } catch (e) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  
  // Fallback: allow dev environment with x-upload-token if configured
  if (!uid) {
    const providedToken = request.headers.get('x-upload-token') || '';
    const requiredToken = process.env.UPLOAD_SECRET_TOKEN || '';
    const isDev = process.env.NODE_ENV !== 'production';
    if (!isDev || !requiredToken || providedToken !== requiredToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    uid = `dev-${providedToken}`;
  }

  try {
    const body: RegisterRequest = await request.json();
    const { files } = body;

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files specified.' }, { status: 400 });
    }

    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json({ error: `Too many files. Max ${MAX_FILES_PER_REQUEST}.` }, { status: 413 });
    }

    const firestore = getAdminDb();
    const registrations: Array<{
      success: boolean;
      originalName: string;
      ingestId?: string;
      storagePath?: string;
      processingId?: string;
      requestId?: string;
      error?: string;
      isDuplicate?: boolean;
      existingIngestId?: string;
    }> = [];

    for (const fileInfo of files) {
      // Validate file
      if (fileInfo.size > MAX_FILE_SIZE) {
        registrations.push({
          success: false,
          originalName: fileInfo.originalName,
          error: `File exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit.`,
        });
        continue;
      }

      const fileExtension = fileInfo.originalName.split('.').pop()?.toLowerCase();

      if (!fileExtension || !ALLOWED_FONT_EXTENSIONS.includes(fileExtension)) {
        registrations.push({
          success: false,
          originalName: fileInfo.originalName,
          error: 'Unsupported file type.',
        });
        continue;
      }

      // Check for duplicate by contentHash if provided
      let isDuplicate = false;
      let existingIngestId: string | null = null;
      if (fileInfo.contentHash) {
        try {
          // Check user's ingests for same contentHash
          const userIngestsRef = firestore.collection('users').doc(uid).collection('ingests');
          const duplicateQuery = await userIngestsRef
            .where('contentHash', '==', fileInfo.contentHash)
            .limit(1)
            .get();

          if (!duplicateQuery.empty) {
            const existingIngest = duplicateQuery.docs[0].data();
            isDuplicate = true;
            existingIngestId = existingIngest.ingestId || duplicateQuery.docs[0].id;
          }
        } catch (queryError) {
          // Non-fatal: continue with registration even if duplicate check fails
          console.warn('Duplicate check failed:', queryError);
        }
      }

      if (isDuplicate && existingIngestId) {
        registrations.push({
          success: false,
          originalName: fileInfo.originalName,
          error: 'duplicate',
          ingestId: existingIngestId,
        });
        continue;
      }

      // Create ingest record
      const processingRef = firestore.collection('_').doc();
      const processingId = processingRef.id;
      const ingestRef = firestore.collection('users').doc(uid).collection('ingests').doc();
      const ingestId = ingestRef.id;
      const requestId = uuidv4();
      const uniqueFilename = `${processingId}-${fileInfo.originalName}`;
      const destPath = `${UNPROCESSED_FONTS_PATH}/${uniqueFilename}`;

      try {
        const now = FieldValue.serverTimestamp();
        await ingestRef.set({
          ingestId,
          ownerId: uid,
          requestId,
          processingId,
          originalName: fileInfo.originalName,
          originalExtension: fileExtension,
          originalSize: fileInfo.size,
          status: 'uploaded',
          error: null,
          errorCode: null,
          unprocessedPath: destPath,
          uploadSource: 'web-app',
          contentType: fileInfo.contentType || null,
          createdAt: now,
          updatedAt: now,
          uploadedAt: now,
          events: [],
          // New fields
          contentHash: fileInfo.contentHash || null,
          quickHash: fileInfo.quickHash || null,
          normalizationSpecVersion: fileInfo.normalizationSpecVersion || NORMALIZATION_SPEC_VERSION,
          previewFamilyKey: fileInfo.previewFamilyKey || null,
          analysisState: 'not_started',
          uploadState: 'uploaded',
        });

        registrations.push({
          success: true,
          originalName: fileInfo.originalName,
          ingestId,
          storagePath: destPath,
          processingId,
          requestId,
        });
      } catch (error: any) {
        console.error(`Error creating ingest document for ${fileInfo.originalName}:`, error);
        registrations.push({
          success: false,
          originalName: fileInfo.originalName,
          error: 'Failed to register upload. Please try again.',
        });
      }
    }

    const allFailed = registrations.every(r => !r.success);

    if (allFailed && registrations.length > 0) {
      return NextResponse.json(
        {
          message: 'All file registrations failed.',
          results: registrations,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: `Registered ${registrations.filter(r => r.success).length} file(s) for upload.`,
      results: registrations,
    });
  } catch (error: any) {
    console.error('API Upload Register Route Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process registration request.' }, { status: 500 });
  }
}

