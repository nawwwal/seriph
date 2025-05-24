import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/firebase/config';
import { ref, uploadBytes, getDownloadURL, getBlob, deleteObject } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
import { parseFontFile } from '@/lib/fonts/parser'; // Assuming parser.ts is in lib/fonts/
import { addFontToFamily } from '@/lib/db/firestoreUtils';
import { FontFamily as FontFamilyModel, Font as FontModel } from '@/models/font.models'; // Renaming to avoid conflict

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB per file limit (configurable)
const ALLOWED_FONT_EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2', 'eot'];
const PROCESSED_FONTS_PATH = 'processed_fonts'; // Storage path for successfully processed fonts
const RAW_UPLOADS_PATH = 'raw_uploads';

interface FileToProcess {
    originalName: string;
    buffer: ArrayBuffer;
    size: number;
}

async function processSingleFile(fileToProcess: FileToProcess, rawStoragePath: string | null): Promise<{ success: boolean; data?: any; error?: string; originalName: string; familyId?: string }> {
    try {
        const parsedData = await parseFontFile(fileToProcess.buffer, fileToProcess.originalName);
        if (!parsedData) {
            return { success: false, error: 'Failed to parse font data.', originalName: fileToProcess.originalName };
        }

        // Move file from raw_uploads to processed_fonts and get new download URL
        let finalDownloadUrl = '';
        let finalStoragePath = '';

        if (rawStoragePath) {
            const fileExtension = fileToProcess.originalName.split('.').pop()?.toLowerCase() || 'bin';
            const uniqueProcessedFilename = `${uuidv4()}.${fileExtension}`;
            const processedFileRef = ref(storage, `${PROCESSED_FONTS_PATH}/${uniqueProcessedFilename}`);

            // Upload buffer to new location (effectively a move)
            const uploadResult = await uploadBytes(processedFileRef, fileToProcess.buffer);
            finalDownloadUrl = await getDownloadURL(uploadResult.ref);
            finalStoragePath = uploadResult.ref.fullPath;

            // Optionally, delete from raw_uploads if it was stored there first
            const rawFileRef = ref(storage, rawStoragePath);
            try {
                await deleteObject(rawFileRef);
            } catch (deleteError) {
                console.warn(`Failed to delete raw file ${rawStoragePath}:`, deleteError);
                // Non-critical, proceed
            }
        } else {
            // This case would be for files extracted from ZIP that were not individually uploaded to raw_uploads first
            // We'd still need to upload them to processed_fonts
            const fileExtension = fileToProcess.originalName.split('.').pop()?.toLowerCase() || 'bin';
            const uniqueProcessedFilename = `${uuidv4()}.${fileExtension}`;
            const processedFileRef = ref(storage, `${PROCESSED_FONTS_PATH}/${uniqueProcessedFilename}`);
            const uploadResult = await uploadBytes(processedFileRef, fileToProcess.buffer);
            finalDownloadUrl = await getDownloadURL(uploadResult.ref);
            finalStoragePath = uploadResult.ref.fullPath;
        }

        const updatedFamily = await addFontToFamily(parsedData, {
            originalName: fileToProcess.originalName,
            storagePath: finalStoragePath,
            downloadUrl: finalDownloadUrl,
            fileSize: fileToProcess.size,
        });

        if (updatedFamily) {
            return { success: true, data: { ...parsedData, downloadUrl: finalDownloadUrl }, originalName: fileToProcess.originalName, familyId: updatedFamily.id };
        } else {
            return { success: false, error: 'Failed to save font family data to Firestore or retrieve it for indexing.', originalName: fileToProcess.originalName };
        }
    } catch (error: any) {
        console.error(`Error processing file ${fileToProcess.originalName}:`, error);
        return { success: false, error: error.message || 'Unknown processing error', originalName: fileToProcess.originalName };
    }
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const files = formData.getAll('fonts') as File[];

        if (!files || files.length === 0) {
            return NextResponse.json({ error: 'No files uploaded.' }, { status: 400 });
        }

        const processingResults: Array<{ success: boolean; data?: any; error?: string; originalName: string; familyId?: string }> = [];

        for (const file of files) {
            if (file.size > MAX_FILE_SIZE) {
                processingResults.push({ success: false, error: `File exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit.`, originalName: file.name });
                continue;
            }

            const fileExtension = file.name.split('.').pop()?.toLowerCase();

            if (fileExtension === 'zip') {
                try {
                    const zip = new JSZip();
                    const content = await file.arrayBuffer();
                    await zip.loadAsync(content);

                    let zipHasFonts = false;
                    for (const filenameInZip of Object.keys(zip.files)) {
                        if (zip.files[filenameInZip].dir) continue; // Skip directories

                        const extInZip = filenameInZip.split('.').pop()?.toLowerCase();
                        if (extInZip && ALLOWED_FONT_EXTENSIONS.includes(extInZip)) {
                            zipHasFonts = true;
                            const zipFileEntry = zip.file(filenameInZip);
                            if (zipFileEntry) {
                                const buffer = await zipFileEntry.async('arraybuffer');
                                if (buffer.byteLength > MAX_FILE_SIZE) {
                                    processingResults.push({ success: false, error: `File ${filenameInZip} in ZIP exceeds ${MAX_FILE_SIZE / (1024*1024)}MB.`, originalName: filenameInZip });
                                    continue;
                                }
                                // For files from ZIP, rawStoragePath is null as they aren't in raw_uploads individually yet
                                const result = await processSingleFile({ originalName: filenameInZip, buffer, size: buffer.byteLength }, null);
                                processingResults.push(result);
                            }
                        }
                    }
                    if (!zipHasFonts && Object.keys(zip.files).length > 0) {
                         processingResults.push({ success: false, error: 'ZIP file did not contain any processable font files.', originalName: file.name });
                    }
                } catch (zipError: any) {
                    console.error(`Error processing ZIP file ${file.name}:`, zipError);
                    processingResults.push({ success: false, error: `Failed to process ZIP file: ${zipError.message}`, originalName: file.name });
                }
            } else if (fileExtension && ALLOWED_FONT_EXTENSIONS.includes(fileExtension)) {
                // Upload individual font file to raw_uploads first
                const uniqueRawFilename = `${uuidv4()}.${fileExtension}`;
                const rawStorageRef = ref(storage, `${RAW_UPLOADS_PATH}/${uniqueRawFilename}`);
                let rawFileSnapshot;
                try {
                    rawFileSnapshot = await uploadBytes(rawStorageRef, file);
                    const buffer = await file.arrayBuffer(); // Use the buffer from the incoming file directly for parsing
                    const result = await processSingleFile({ originalName: file.name, buffer, size: file.size }, rawFileSnapshot.ref.fullPath);
                    processingResults.push(result);
                } catch (uploadError: any) {
                    console.error(`Error in raw upload or processing for ${file.name}:`, uploadError);
                    processingResults.push({ success: false, error: `Initial upload or processing failed: ${uploadError.message}`, originalName: file.name });
                }
            } else {
                processingResults.push({ success: false, error: 'Unsupported file type.', originalName: file.name });
            }
        }

        const successfulOps = processingResults.filter(r => r.success);
        const failedOps = processingResults.filter(r => !r.success);

        if (successfulOps.length === 0 && failedOps.length > 0) {
            return NextResponse.json(
                {
                    message: 'All file operations failed.',
                    errors: failedOps.map(f => ({ file: f.originalName, error: f.error })),
                },
                { status: 400 }
            );
        }

        return NextResponse.json({
            message: `Processed ${files.length} initial file(s). ${successfulOps.length} fonts processed, ${failedOps.length} operations failed.`,
            results: processingResults
        });

    } catch (error: any) {
        console.error('API Upload Main Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to process upload request.' }, { status: 500 });
    }
}
