import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { adminStorage } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';

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
            const decoded = await admin.auth().verifyIdToken(bearer);
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

        const uploadResults: Array<{ success: boolean; originalName: string; message?: string; error?: string; }>= [];

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
            const uniqueFilename = `${uuidv4()}-${file.name}`;
            const bucket = adminStorage.bucket();
            const destPath = `${UNPROCESSED_FONTS_PATH}/${uniqueFilename}`;

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
                            ...(uid ? { ownerId: uid } : {}),
                        },
                    },
                });

                uploadResults.push({
                    success: true,
                    originalName: file.name,
                    message: 'File submitted for processing.'
                });

            } catch (uploadError: any) {
                console.error(`Error uploading ${file.name} to ${UNPROCESSED_FONTS_PATH}:`, uploadError);
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
