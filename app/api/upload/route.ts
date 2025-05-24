import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/firebase/config'; // Client-side Firebase storage instance
import { ref, uploadBytes } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB per file limit
const ALLOWED_FONT_EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2', 'eot'];
const UNPROCESSED_FONTS_PATH = 'unprocessed_fonts'; // Target path for the Cloud Function

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const files = formData.getAll('fonts') as File[];

        if (!files || files.length === 0) {
            return NextResponse.json({ error: 'No files uploaded.' }, { status: 400 });
        }

        const uploadResults = [];

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

            // Upload directly to the path monitored by the Cloud Function
            const uniqueFilename = `${uuidv4()}-${file.name}`;
            const storageRef = ref(storage, `${UNPROCESSED_FONTS_PATH}/${uniqueFilename}`);

            try {
                // Using client-side uploadBytes directly to the target path
                await uploadBytes(storageRef, file, { contentType: file.type });

                uploadResults.push({
                    success: true,
                    originalName: file.name,
                    message: 'File submitted for processing.' // Generic message
                });

            } catch (uploadError: any) {
                console.error(`Error uploading ${file.name} directly to ${UNPROCESSED_FONTS_PATH}:`, uploadError);
                uploadResults.push({
                    success: false,
                    originalName: file.name,
                    error: `Failed to submit file for processing: ${uploadError.code || uploadError.message}`
                });
            }
        }

        const allSubmissionsFailed = uploadResults.every(r => !r.success);
        const anySubmissionsSucceeded = uploadResults.some(r => r.success);

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
