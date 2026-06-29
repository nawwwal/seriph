export interface IntakePathParts {
  ownerId: string | null;
  batchId: string | null;
  objectName: string;
  isLegacy: boolean;
}

function cleanSegment(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function parseIntakePath(filePath: string, intakePrefix: string): IntakePathParts | null {
  const parts = filePath.split("/").filter(Boolean);
  if (parts[0] !== intakePrefix || parts.length < 3) return null;
  if (parts.length >= 4) {
    return {
      ownerId: cleanSegment(parts[1]),
      batchId: cleanSegment(parts[2]),
      objectName: parts.slice(3).join("/"),
      isLegacy: false,
    };
  }
  return {
    ownerId: null,
    batchId: cleanSegment(parts[1]),
    objectName: parts.slice(2).join("/"),
    isLegacy: true,
  };
}

export function processingIdFromObjectName(objectName: string): string | null {
  const leaf = objectName.split("/").pop() ?? objectName;
  const dashIndex = leaf.indexOf("-");
  if (dashIndex <= 0) return null;
  return leaf.slice(0, dashIndex);
}

export function buildIntakePath(params: {
  intakePrefix: string;
  ownerId: string;
  batchId: string;
  objectName: string;
}): string {
  const { intakePrefix, ownerId, batchId, objectName } = params;
  return `${intakePrefix}/${ownerId}/${batchId}/${objectName}`;
}
