type Env = Record<string, string | undefined>;

function configBucket(value: string | undefined): string | undefined {
  try {
    const bucket = JSON.parse(value ?? "").storageBucket;
    return typeof bucket === "string" && bucket.trim() ? bucket.trim() : undefined;
  } catch { return undefined; }
}

export function resolveStorageBucket(env: Env = process.env): string | undefined {
  return env.FIREBASE_STORAGE_BUCKET?.trim() || env.GOOGLE_CLOUD_STORAGE_BUCKET?.trim() ||
    configBucket(env.FIREBASE_CONFIG) || env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
}
