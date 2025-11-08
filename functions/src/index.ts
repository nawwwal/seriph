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
import { runFontPipeline } from "./ai/pipeline/fontPipeline";
import { withRateLimit } from "./utils/rateLimiter";

const firestoreDb = getFirestore(); // Renamed to avoid conflict if 'firestore' is used as a module
const appStorage = getStorage(); // Renamed to avoid conflict

const UNPROCESSED_BUCKET_PATH = "unprocessed_fonts";
const PROCESSED_BUCKET_PATH = "processed_fonts";
const FAILED_BUCKET_PATH = "failed_processing";

/**
 * Update ingest record analysis state
 */
async function updateIngestAnalysisState(
  processingId: string,
  ownerId: string | null,
  analysisState: 'queued' | 'analyzing' | 'enriching' | 'complete' | 'error' | 'quarantined',
  error?: string
): Promise<void> {
  if (!ownerId) {
    logger.warn(`Cannot update ingest record: no ownerId for processingId ${processingId}`);
    return;
  }

  try {
    // Find ingest record by processingId
    const ingestsRef = firestoreDb.collection('users').doc(ownerId).collection('ingests');
    const querySnapshot = await ingestsRef.where('processingId', '==', processingId).limit(1).get();

    if (querySnapshot.empty) {
      logger.warn(`No ingest record found for processingId ${processingId}`);
      return;
    }

    const ingestDoc = querySnapshot.docs[0];
    await ingestDoc.ref.update({
      analysisState,
      error: error || admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`Updated ingest ${ingestDoc.id} analysisState to ${analysisState}`);
  } catch (error: any) {
    logger.error(`Failed to update ingest analysisState for ${processingId}:`, error);
    // Non-fatal: continue processing even if state update fails
  }
}

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
    
    // Extract processingId from filename (format: {processingId}-{originalFileName})
    const processingIdMatch = originalFileName.match(/^([^-]+)-(.+)$/);
    const processingId = processingIdMatch ? processingIdMatch[1] : admin.firestore().collection('_').doc().id;
    const actualFileName = processingIdMatch ? processingIdMatch[2] : originalFileName;
    
    // Get ownerId from file metadata (metadata is flat, not nested)
    const ownerIdFromMetadata = event.data.metadata?.ownerId || null;
    
    // Update analysis state to queued
    await updateIngestAnalysisState(processingId, ownerIdFromMetadata, 'queued');

    try {
      const [fileBuffer] = await unprocessedFile.download();
      logger.info(`[${originalFileName}] Downloaded ${fileBuffer.byteLength} bytes.`);

      logger.info(`[${originalFileName}] Parsing font file...`);
      const parsedFontData = await serverParseFontFile(fileBuffer, originalFileName);

      if (!parsedFontData) {
        logger.error(`[${actualFileName}] Failed to parse font.`);
        await updateIngestAnalysisState(processingId, ownerIdFromMetadata, 'error', 'Failed to parse font file');
        const failedFilePath = `${FAILED_BUCKET_PATH}/${processingId}-${actualFileName}`;
        await unprocessedFile.move(failedFilePath);
        logger.info(`[${actualFileName}] Moved to ${failedFilePath}.`);
        return null;
      }
      logger.info(`[${actualFileName}] Parsed font successfully. Family: ${parsedFontData.familyName}, Subfamily: ${parsedFontData.subfamilyName}, Foundry: ${parsedFontData.foundry || 'N/A'}`);

      // Update analysis state to analyzing
      await updateIngestAnalysisState(processingId, ownerIdFromMetadata, 'analyzing');

      // Run enhanced AI pipeline with rate limiting
      logger.info(`[${actualFileName}] Starting enhanced AI pipeline for: ${parsedFontData.familyName}`);
      let pipelineResult = null;
      let aiAnalysisResult = null;

      try {
        pipelineResult = await withRateLimit(
          () => runFontPipeline(fileBuffer, actualFileName),
          `Font pipeline for ${actualFileName}`
        );

        // Update to enriching if web enrichment is enabled
        const webEnrichmentEnabled = process.env.GEMINI_WEB_SEARCH_ENABLED === 'true';
        if (webEnrichmentEnabled && pipelineResult) {
          await updateIngestAnalysisState(processingId, ownerIdFromMetadata, 'enriching');
        }

        if (pipelineResult && pipelineResult.isValid) {
          // Convert pipeline result to legacy format for compatibility
          const enrichedAnalysis = pipelineResult.enrichedAnalysis || pipelineResult.visualAnalysis;
          if (enrichedAnalysis) {
            aiAnalysisResult = {
              description: pipelineResult.description || 'A well-designed font family.',
              tags: enrichedAnalysis.moods?.slice(0, 5).map((m: any) => m.value) || [],
              classification: enrichedAnalysis.style_primary?.value || parsedFontData.classification || 'Sans Serif',
              metadata: {
                subClassification: enrichedAnalysis.substyle?.value,
                moods: enrichedAnalysis.moods?.map((m: any) => m.value) || [],
                useCases: enrichedAnalysis.use_cases?.map((uc: any) => uc.value) || [],
                technicalCharacteristics: enrichedAnalysis.negative_tags || [],
                // Enhanced fields
                people: enrichedAnalysis.people,
                historical_context: enrichedAnalysis.historical_context,
                semantics: enrichedAnalysis,
                provenance: pipelineResult.parsedData?.provenance,
              },
            };
            logger.info(`[${actualFileName}] Enhanced AI pipeline completed successfully. Confidence: ${pipelineResult.confidence.toFixed(2)}`);
          }
        } else {
          logger.warn(`[${actualFileName}] Enhanced AI pipeline failed or returned invalid results. Falling back to legacy analysis.`);
          // Fallback to legacy analysis
          aiAnalysisResult = await getFontAnalysisVertexAI(parsedFontData);
        }
      } catch (pipelineError: any) {
        logger.error(`[${actualFileName}] Enhanced pipeline error:`, pipelineError);
        // Update to error state
        await updateIngestAnalysisState(processingId, ownerIdFromMetadata, 'error', pipelineError.message);
        // Fallback to legacy analysis
        logger.info(`[${actualFileName}] Falling back to legacy AI analysis.`);
        try {
          aiAnalysisResult = await getFontAnalysisVertexAI(parsedFontData);
        } catch (legacyError: any) {
          logger.error(`[${actualFileName}] Legacy analysis also failed:`, legacyError);
          await updateIngestAnalysisState(processingId, ownerIdFromMetadata, 'error', legacyError.message);
        }
      }

      if (!aiAnalysisResult) {
        logger.warn(`[${actualFileName}] AI analysis failed or returned no data. Proceeding with basic data.`);
        await updateIngestAnalysisState(processingId, ownerIdFromMetadata, 'error', 'AI analysis failed');
      } else {
        logger.info(`[${actualFileName}] AI analysis completed for ${parsedFontData.familyName}.`);
      }

      const processedFileName = `${processingId}-${actualFileName}`;
      const processedFileRef = bucket.file(`${PROCESSED_BUCKET_PATH}/${processedFileName}`);

      await processedFileRef.save(fileBuffer, {
        resumable: false,
        // Set contentType at the top level per GCS SaveOptions
        contentType: contentType || 'application/octet-stream',
        // cacheControl belongs in FileMetadata under `metadata`
        metadata: {
          cacheControl: 'public, max-age=31536000',
          // custom user metadata goes under `metadata`
          metadata: {
            processed: 'true',
            originalPath: filePath,
            processingId: processingId,
            ...(ownerIdFromMetadata ? { ownerId: ownerIdFromMetadata } : {}),
          },
        },
      });
      await processedFileRef.makePublic();
      const downloadUrl = processedFileRef.publicUrl();
      logger.info(`[${originalFileName}] Font saved to ${processedFileRef.name} and made public at ${downloadUrl}`);

      const fontFileDetails = {
        originalName: originalFileName,
        storagePath: processedFileRef.name,
        downloadUrl: downloadUrl,
        fileSize: fileBuffer.byteLength,
      };

      // Merge pipeline result data into parsedFontData if available
      const enhancedParsedData = pipelineResult?.parsedData || parsedFontData;
      if (pipelineResult?.visualMetrics) {
        enhancedParsedData.visual_metrics = pipelineResult.visualMetrics;
      }

      const familyResult = await serverAddFontToFamilyAdmin(enhancedParsedData, fontFileDetails, aiAnalysisResult, ownerIdFromMetadata || undefined);

      if (!familyResult) {
        logger.error(`[${actualFileName}] Failed to add font to family in Firestore. Attempting to move processed file to failed folder.`);
        await updateIngestAnalysisState(processingId, ownerIdFromMetadata, 'error', 'Failed to add font to family');
        const failedFilePath = `${FAILED_BUCKET_PATH}/${processedFileName}`;
        try {
          await processedFileRef.move(failedFilePath);
          logger.info(`[${actualFileName}] Moved processed file from ${processedFileRef.name} to ${failedFilePath} after DB error.`);
        } catch (moveError: any) {
          logger.error(`[${actualFileName}] Failed to move processed file ${processedFileRef.name} to failed folder. Manual cleanup may be needed.`, { error: moveError.message });
        }
        try {
            await unprocessedFile.delete({ ignoreNotFound: true });
            logger.info(`[${actualFileName}] Deleted original unprocessed file after DB error and moving processed to failed.`);
        } catch (delError: any) {
            logger.warn(`[${actualFileName}] Could not delete original unprocessed file. It might have been deleted already.`, {error: delError.message});
        }
        return null;
      }
      logger.info(`[${actualFileName}] Successfully added font to family: ${familyResult.name} (ID: ${familyResult.id}) in Firestore.`);

      // Update analysis state to complete
      await updateIngestAnalysisState(processingId, ownerIdFromMetadata, 'complete');

      // Update ingest record with familyId and mark as completed
      try {
        const ingestsRef = firestoreDb.collection('users').doc(ownerIdFromMetadata!).collection('ingests');
        const querySnapshot = await ingestsRef.where('processingId', '==', processingId).limit(1).get();
        if (!querySnapshot.empty) {
          const ingestDoc = querySnapshot.docs[0];
          await ingestDoc.ref.update({
            status: 'completed',
            familyId: familyResult.id,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (updateError: any) {
        logger.warn(`[${actualFileName}] Failed to update ingest record with familyId:`, updateError);
      }

      await unprocessedFile.delete();
      logger.info(`[${actualFileName}] Successfully processed. Original file ${filePath} deleted.`);

    } catch (error: any) {
      logger.error(`[${actualFileName}] Unhandled error in processUploadedFontStorage:`, {
        message: error.message,
        stack: error.stack,
        filePath: filePath
      });
      
      // Update ingest record to error state (reuse ownerIdFromMetadata from outer scope)
      await updateIngestAnalysisState(processingId, ownerIdFromMetadata, 'error', error.message);
      
      try {
        const failedFilePath = `${FAILED_BUCKET_PATH}/${processingId}-${actualFileName}`;
        await unprocessedFile.move(failedFilePath);
        logger.info(`[${actualFileName}] Moved original unprocessed file to ${failedFilePath} after unhandled error.`);
      } catch (moveError: any) {
        logger.error(`[${actualFileName}] CRITICAL: Failed to move original unprocessed file to ${FAILED_BUCKET_PATH} after unhandled error. File may be stuck in ${UNPROCESSED_BUCKET_PATH}.`, { moveError: moveError.message });
      }
    }
    return null;
  }
);
