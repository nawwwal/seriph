function requiredEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing required environment variable: ${keys.join(" or ")}`);
}

function projectId(): string {
  return requiredEnv("GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT", "GCP_PROJECT");
}

function location(): string {
  return requiredEnv("IMPORT_TASKS_LOCATION", "CLOUD_TASKS_LOCATION", "GOOGLE_CLOUD_LOCATION", "FUNCTIONS_REGION");
}

export function queuePath(): string {
  const queue = requiredEnv("IMPORT_TASKS_QUEUE", "IMPORT_TASK_QUEUE", "CLOUD_TASKS_QUEUE");
  return `projects/${projectId()}/locations/${location()}/queues/${queue}`;
}

function privateWorkerUrl(value: string, allowlistKey: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Invalid private worker URL"); }
  const host = url.hostname.toLowerCase();
  const region = location();
  const runHost = new RegExp(`^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?-${region}\\.a\\.run\\.app$`).test(host);
  const functionHost = host === `${region}-${projectId()}.cloudfunctions.net`;
  const allowlist = requiredEnv(allowlistKey).split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  const authority = value.split("://")[1]?.split("/")[0] ?? "";
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash
    || authority.includes(":") || (!runHost && !functionHost) || !allowlist.includes(host)) {
    throw new Error("Worker URL is not an allowlisted private deployment");
  }
  return value;
}

export function workerUrl(): string { return privateWorkerUrl(requiredEnv("IMPORT_WORKER_URL", "IMPORT_PRIVATE_WORKER_URL", "CLOUD_TASKS_WORKER_URL"), "IMPORT_WORKER_ALLOWED_HOSTS"); }
export function archiveWorkerUrl(): string { return privateWorkerUrl(requiredEnv("IMPORT_ARCHIVE_WORKER_URL"), "IMPORT_ARCHIVE_WORKER_ALLOWED_HOSTS"); }

export function workerServiceAccount(): string {
  const project = projectId();
  const email = process.env.IMPORT_WORKER_SERVICE_ACCOUNT?.trim() || process.env.IMPORT_TASKS_SERVICE_ACCOUNT?.trim()
    || process.env.CLOUD_TASKS_SERVICE_ACCOUNT?.trim() || `${project}@appspot.gserviceaccount.com`;
  if (email !== `${project}@appspot.gserviceaccount.com` && !email.endsWith(`@${project}.iam.gserviceaccount.com`)) {
    throw new Error("Cloud Tasks service account must belong to the configured project");
  }
  return email;
}
