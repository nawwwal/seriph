import { normalizeArchivePath } from "./archivePolicy";

const idSegment = (value: string, name: string): string => {
  if (!value || value.includes("/")) throw new Error(`invalid ${name}`);
  return value;
};

export function archiveStagingPath(input: {
  ownerId: string; batchId: string; archiveItemId: string; entryPath: string;
}): string {
  const safePath = normalizeArchivePath(input.entryPath);
  if (typeof safePath !== "string") throw new Error(`unsafe archive path: ${safePath.reasonCode}`);
  return ["import_staging", idSegment(input.ownerId, "ownerId"), idSegment(input.batchId, "batchId"),
    idSegment(input.archiveItemId, "archiveItemId"), safePath].join("/");
}
