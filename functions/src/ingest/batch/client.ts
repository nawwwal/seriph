import { GoogleGenAI } from "@google/genai";
import { ANALYSIS_SCHEMA } from "../../ai/enrichFont";
import { publicBucketName } from "../../config/catalogConfig";
import { RC_KEYS, RC_DEFAULTS } from "../../config/rcKeys";
import { getConfigValue, getConfigNumber, getConfigBoolean } from "../../config/remoteConfig";

export const JOBS_COLLECTION = "batchJobs";
export const ACTIVE_STATES = ["JOB_STATE_QUEUED", "JOB_STATE_PENDING", "JOB_STATE_RUNNING", "JOB_STATE_UPDATING"];
export const SUCCESS_STATES = ["JOB_STATE_SUCCEEDED", "JOB_STATE_PARTIALLY_SUCCEEDED"];
export const FAIL_STATES = ["JOB_STATE_FAILED", "JOB_STATE_CANCELLED", "JOB_STATE_EXPIRED"];

export const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
];

let client: GoogleGenAI | null = null;
export function batchClient(): GoogleGenAI {
  if (client) return client;
  const project = process.env.GOOGLE_CLOUD_PROJECT || "seriph";
  const location = getConfigValue(RC_KEYS.batchLocationId, RC_DEFAULTS[RC_KEYS.batchLocationId]);
  client = new GoogleGenAI({ vertexai: true, project, location, apiVersion: "v1" });
  return client;
}

export function analysisModelId(): string {
  return getConfigValue(RC_KEYS.analysisModelName, RC_DEFAULTS[RC_KEYS.analysisModelName]);
}

export function batchEnrichEnabled(): boolean {
  return getConfigBoolean(RC_KEYS.enrichBatchEnabled, RC_DEFAULTS[RC_KEYS.enrichBatchEnabled] === "true");
}

/** Bucket for batch JSONL IO. Defaults to the public bucket under an inert prefix. */
export function batchBucket(): string {
  const configured = getConfigValue(RC_KEYS.batchIoBucket, "");
  return configured && configured.trim() ? configured.trim() : publicBucketName();
}

/** Generation config mirroring the realtime analysis. */
export function batchGenerationConfig(): Record<string, unknown> {
  return {
    maxOutputTokens: getConfigNumber(RC_KEYS.maxOutputTokens, Number(RC_DEFAULTS[RC_KEYS.maxOutputTokens])),
    thinkingConfig: { thinkingLevel: "minimal" },
    responseMimeType: "application/json",
    responseSchema: ANALYSIS_SCHEMA,
  };
}
