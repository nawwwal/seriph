import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getAdminStorage, getAdminDb, getAdminAuth } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Storage } from 'firebase-admin/storage';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB per file limit
const ALLOWED_FONT_EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2', 'eot'];
const UNPROCESSED_FONTS_PATH = 'unprocessed_fonts'; // Target path for the Cloud Function
const MAX_FILES_PER_REQUEST = 20;

export async function POST(request: NextRequest) {
    // Require Firebase ID token for authenticated uploads
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
        const formData = await request.formData();
        const files = formData.getAll('fonts') as File[];

        if (!files || files.length === 0) {
            return NextResponse.json({ error: 'No files uploaded.' }, { status: 400 });
        }

        if (files.length > MAX_FILES_PER_REQUEST) {
            return NextResponse.json({ error: `Too many files. Max ${MAX_FILES_PER_REQUEST}.` }, { status: 413 });
        }

        let bucket: ReturnType<Storage['bucket']>;
        try {
            bucket = getAdminStorage().bucket();
        } catch (storageError: any) {
            console.error('Firebase Storage is not configured correctly.', storageError);
            return NextResponse.json(
                { error: 'Storage service unavailable. Contact an administrator.' },
                { status: 500 }
            );
        }

        const uploadResults: Array<{ success: boolean; originalName: string; message?: string; error?: string; ingestId?: string; }> = [];

        const firestore = getAdminDb();

        for (const file of files) {
            if (file.size > MAX_FILE_SIZE) {
                uploadResults.push({
                    success: false,
                    originalName: file.name,
                    error: `File exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit.`
                });
                continue;
            }

            const fileExtension = file.name.split('.').pop()?.toLowerCase();

            // Skip ZIP file handling for now as per simplified flow
            if (fileExtension === 'zip') {
                uploadResults.push({
                    success: false,
                    originalName: file.name,
                    error: 'ZIP file uploads are handled by a different process or should be unpacked first.'
                });
                continue;
            }

            if (!fileExtension || !ALLOWED_FONT_EXTENSIONS.includes(fileExtension)) {
                uploadResults.push({
                    success: false,
                    originalName: file.name,
                    error: 'Unsupported file type.'
                });
                continue;
            }

            // Upload directly to the path monitored by the Cloud Function using Admin SDK
            const processingRef = firestore.collection('_').doc();
            const processingId = processingRef.id;
            const ingestRef = firestore.collection('users').doc(uid).collection('ingests').doc();
            const ingestId = ingestRef.id;
            const requestId = uuidv4();
            const uniqueFilename = `${processingId}-${file.name}`;
            const destPath = `${UNPROCESSED_FONTS_PATH}/${uniqueFilename}`;

            try {
                const now = FieldValue.serverTimestamp();
                await ingestRef.set({
                    ingestId,
                    ownerId: uid,
                    requestId,
                    processingId,
                    originalName: file.name,
                    originalExtension: fileExtension,
                    originalSize: file.size,
                    status: 'uploaded',
                    error: null,
                    errorCode: null,
                    unprocessedPath: destPath,
                    uploadSource: 'web-app',
                    contentType: file.type || null,
                    createdAt: now,
                    updatedAt: now,
                    uploadedAt: now,
                    events: [],
                });
            } catch (ingestError: any) {
                console.error(`Error creating ingest document for ${file.name}:`, ingestError);
                uploadResults.push({
                    success: false,
                    originalName: file.name,
                    error: 'Failed to register upload. Please try again.'
                });
                continue;
            }

            try {
                const arrayBuffer = await file.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                await bucket.file(destPath).save(buffer, {
                    resumable: false,
                    metadata: {
                        contentType: file.type || 'application/octet-stream',
                        // No cache control for unprocessed uploads
                        metadata: {
                            originalName: file.name,
                            ownerId: uid,
                            ingestId,
                            processingId,
                            requestId,
                            uploadSource: 'web-app',
                        },
                    },
                });

                uploadResults.push({
                    success: true,
                    originalName: file.name,
                    message: 'File submitted for processing.',
                    ingestId,
                });

            } catch (uploadError: any) {
                console.error(`Error uploading ${file.name} to ${UNPROCESSED_FONTS_PATH}:`, uploadError);
                try {
                    await ingestRef.set({
                        status: 'failed',
                        error: uploadError?.message || 'Upload failed.',
                        errorCode: uploadError?.code || 'upload_failed',
                        updatedAt: FieldValue.serverTimestamp(),
                    }, { merge: true });
                } catch (updateError) {
                    console.error(`Failed to mark ingest ${ingestId} as failed after upload error:`, updateError);
                }
                uploadResults.push({
                    success: false,
                    originalName: file.name,
                    error: `Failed to submit file for processing: ${uploadError.code || uploadError.message}`
                });
            }
        }

        const allSubmissionsFailed = uploadResults.every(r => !r.success);

        if (allSubmissionsFailed && uploadResults.length > 0) {
             return NextResponse.json(
                {
                    message: 'All file submissions failed.',
                    results: uploadResults,
                },
                { status: 400 }
            );
        }

        return NextResponse.json({
            message: `Submission attempt finished for ${uploadResults.length} file(s). ${uploadResults.filter(r=>r.success).length} sent for processing, ${uploadResults.filter(r=>!r.success).length} failed. Background processing initiated.`,
            results: uploadResults
        });

    } catch (error: any) {
        console.error('API Upload Route Error (Direct to Unprocessed): ', error);
        return NextResponse.json({ error: error.message || 'Failed to process upload request.' }, { status: 500 });
    }
}
