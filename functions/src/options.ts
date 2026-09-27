/** Cloud Functions resource options, grouped by workload. minInstances
 * defaults to 0 everywhere (scale to zero). */

export const INGEST_FUNCTION_OPTIONS = {
  region: "asia-southeast1",
  memory: "1GiB" as const,
  // Parse (fontkit), woff2 transcode (wawoff2 WASM) and specimen render (skia)
  // are CPU-bound; 2 vCPU shortens per-font wall-clock on big batches.
  cpu: 2,
  timeoutSeconds: 300,
  maxInstances: 2,
};

export const DUE_EVENT_OPTIONS = {
  region: "asia-southeast1",
  memory: "256MiB" as const,
  retry: true,
};

export const SEARCH_FUNCTION_OPTIONS = {
  region: "us-central1",
  cors: true,
  memory: "1GiB" as const,
  timeoutSeconds: 90,
  concurrency: 16,
  maxInstances: 4,
  secrets: ["TYPESAFE_API_KEY"],
};

export const CDN_FUNCTION_OPTIONS = {
  region: "asia-southeast1",
  cors: true,
  maxInstances: 5,
};

export const IMPORT_TASK_WORKER_OPTIONS = {
  region: "asia-southeast1",
  memory: "1GiB" as const,
  cpu: 2,
  timeoutSeconds: 540,
  maxInstances: 4,
  invoker: "import-task-service-account@seriph.iam.gserviceaccount.com",
  secrets: ["TYPESAFE_API_KEY"],
};

export const IMPORT_SOURCE_FINALIZED_OPTIONS = {
  ...INGEST_FUNCTION_OPTIONS,
  maxInstances: 4,
  retry: true,
};
