// Firebase Admin SDK
import * as admin from "firebase-admin";
admin.initializeApp();

// Firebase Functions
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { logger } from "firebase-functions";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";

// Helper imports (ensure these paths are correct based on your structure within functions/src)
import { serverParseFontFile } from "./parser/fontParser";
import { serverAddFontToFamilyAdmin } from "./db/firestoreUtils.admin";
import { getFontAnalysisVertexAI } from "./ai/vertexAIHelper";

const firestoreDb = getFirestore(); // Renamed to avoid conflict if 'firestore' is used as a module
const appStorage = getStorage(); // Renamed to avoid conflict

const UNPROCESSED_BUCKET_PATH = "unprocessed_fonts";
const PROCESSED_BUCKET_PATH = "processed_fonts";
const FAILED_BUCKET_PATH = "failed_processing";

export const processUploadedFontStorage = onObjectFinalized(
  {
    bucket: admin.storage().bucket().name, // Uses the default bucket associated with the Firebase project
    region: "us-central1", // Specify the region for the function
    memory: "1GiB",        // Specify memory allocation
    timeoutSeconds: 540,   // Specify timeout
  },
  async (event) => {
    const fileBucket = event.data.bucket;
    const filePath = event.data.name;
    const contentType = event.data.contentType;

    if (!filePath || !filePath.startsWith(`${UNPROCESSED_BUCKET_PATH}/`)) {
      logger.log("File is not in the designated unprocessed directory. Ignoring.", { path: filePath });
      return null;
    }

    if (filePath.endsWith("/")) {
      logger.log("This is a folder creation event. Ignoring.", { path: filePath });
      return null;
    }

    // The onObjectFinalized trigger ensures the object exists.
    // Further checks for metadata can prevent reprocessing.
    if (event.data.metadata && event.data.metadata.processed === 'true') {
        logger.log("File has metadata indicating it was already processed. Ignoring.", {path: filePath});
        return null;
    }

    const originalFileName = filePath.split("/").pop();
    if (!originalFileName) {
      logger.error("Could not extract original file name from path.", { path: filePath });
      return null;
    }

    logger.info(`Processing file: ${originalFileName} from ${filePath}`);

    const bucket = appStorage.bucket(fileBucket);
    const unprocessedFile = bucket.file(filePath);
    const processingId = admin.firestore().collection('_').doc().id;

    try {
      const [fileBuffer] = await unprocessedFile.download();
      logger.info(`[${originalFileName}] Downloaded ${fileBuffer.byteLength} bytes.`);

      logger.info(`[${originalFileName}] Parsing font file...`);
      const parsedFontData = await serverParseFontFile(fileBuffer, originalFileName);

      if (!parsedFontData) {
        logger.error(`[${originalFileName}] Failed to parse font.`);
        const failedFilePath = `${FAILED_BUCKET_PATH}/${processingId}-${originalFileName}`;
        await unprocessedFile.move(failedFilePath);
        logger.info(`[${originalFileName}] Moved to ${failedFilePath}.`);
        return null;
      }
      logger.info(`[${originalFileName}] Parsed font successfully. Family: ${parsedFontData.familyName}, Subfamily: ${parsedFontData.subfamilyName}, Foundry: ${parsedFontData.foundry || 'N/A'}`);

      logger.info(`[${originalFileName}] Starting AI analysis for: ${parsedFontData.familyName} using Vertex AI client.`);
      const aiAnalysisResult = await getFontAnalysisVertexAI(parsedFontData);

      if (!aiAnalysisResult) {
        logger.warn(`[${originalFileName}] AI analysis (Vertex AI) failed or returned no data. Proceeding with basic data.`);
      } else {
        logger.info(`[${originalFileName}] AI analysis (Vertex AI) completed for ${parsedFontData.familyName}.`);
      }

      const processedFileName = `${processingId}-${originalFileName}`;
      const processedFileRef = bucket.file(`${PROCESSED_BUCKET_PATH}/${processedFileName}`);

      const newMetadata = {
        contentType: contentType,
        metadata: {
            processed: 'true',
            originalPath: filePath,
            processingId: processingId,
            cacheControl: 'public, max-age=31536000'
        }
      };
      await processedFileRef.save(fileBuffer, newMetadata);
      await processedFileRef.makePublic();
      const downloadUrl = processedFileRef.publicUrl();
      logger.info(`[${originalFileName}] Font saved to ${processedFileRef.name} and made public at ${downloadUrl}`);

      const fontFileDetails = {
        originalName: originalFileName,
        storagePath: processedFileRef.name,
        downloadUrl: downloadUrl,
        fileSize: fileBuffer.byteLength,
      };

      const familyResult = await serverAddFontToFamilyAdmin(parsedFontData, fontFileDetails, aiAnalysisResult);

      if (!familyResult) {
        logger.error(`[${originalFileName}] Failed to add font to family in Firestore. Attempting to move processed file to failed folder.`);
        const failedFilePath = `${FAILED_BUCKET_PATH}/${processedFileName}`;
        try {
          await processedFileRef.move(failedFilePath);
          logger.info(`[${originalFileName}] Moved processed file from ${processedFileRef.name} to ${failedFilePath} after DB error.`);
        } catch (moveError: any) {
          logger.error(`[${originalFileName}] Failed to move processed file ${processedFileRef.name} to failed folder. Manual cleanup may be needed.`, { error: moveError.message });
        }
        try {
            await unprocessedFile.delete({ ignoreNotFound: true });
            logger.info(`[${originalFileName}] Deleted original unprocessed file after DB error and moving processed to failed.`);
        } catch (delError: any) {
            logger.warn(`[${originalFileName}] Could not delete original unprocessed file. It might have been deleted already.`, {error: delError.message});
        }
        return null;
      }
      logger.info(`[${originalFileName}] Successfully added font to family: ${familyResult.name} (ID: ${familyResult.id}) in Firestore.`);

      await unprocessedFile.delete();
      logger.info(`[${originalFileName}] Successfully processed. Original file ${filePath} deleted.`);

    } catch (error: any) {
      logger.error(`[${originalFileName}] Unhandled error in processUploadedFontStorage:`, {
        message: error.message,
        stack: error.stack,
        filePath: filePath
      });
      try {
        const failedFilePath = `${FAILED_BUCKET_PATH}/${processingId}-${originalFileName}`;
        await unprocessedFile.move(failedFilePath);
        logger.info(`[${originalFileName}] Moved original unprocessed file to ${failedFilePath} after unhandled error.`);
      } catch (moveError: any) {
        logger.error(`[${originalFileName}] CRITICAL: Failed to move original unprocessed file to ${FAILED_BUCKET_PATH} after unhandled error. File may be stuck in ${UNPROCESSED_BUCKET_PATH}.`, { moveError: moveError.message });
      }
    }
    return null;
  }
);
