import { createHash } from "crypto";
import { classifyRole, isSafeTextString, type ClassifiedInventory } from "./classifyRole";

export type ByteSource = Uint8Array | AsyncIterable<Uint8Array> | Iterable<Uint8Array>;
export interface InventoryProvenance {
  ownerId: string;
  batchId: string;
  sourceId: string;
  originalPath: string;
  archiveLineage: Array<{ archiveItemId: string; entryPath: string }>;
  filename: string;
  extension: string;
  declaredMimeType: string;
  crc32?: number;
}
export interface InventoryInput extends InventoryProvenance {
  bytes: ByteSource;
  name?: string;
}
export interface InventoryItem extends ClassifiedInventory, InventoryProvenance {
  itemId: string;
  sha256: string;
  byteSize: number;
  mimeType: string;
}

const MAX_SNIFF_BYTES = 4096;
const mimeTypes: Record<string, string> = {
  TTF: "font/ttf", OTF: "font/otf", WOFF: "font/woff", WOFF2: "font/woff2", EOT: "application/vnd.ms-fontobject",
  ZIP: "application/zip", GLYPHS: "application/x-glyphs", UNKNOWN: "application/octet-stream",
};

const asBytes = (value: Uint8Array): Uint8Array => value instanceof Uint8Array ? value : new Uint8Array(value);
const canonicalIdentity = (input: InventoryItem): string => JSON.stringify({
  ownerId: input.ownerId, batchId: input.batchId, sourceId: input.sourceId,
  originalPath: input.originalPath, archiveLineage: input.archiveLineage,
  filename: input.filename, extension: input.extension, sha256: input.sha256,
});

async function consume(source: ByteSource): Promise<{
  prefix: Uint8Array; sha256: string; byteSize: number; safeText: boolean;
}> {
  const hash = createHash("sha256");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const prefix: Uint8Array[] = [];
  let prefixSize = 0;
  let byteSize = 0;
  let sawBytes = false;
  let textSafe = true;
  const add = (value: Uint8Array) => {
    const bytes = asBytes(value);
    sawBytes = true;
    hash.update(bytes);
    byteSize += bytes.byteLength;
    if (textSafe) {
      try {
        textSafe = isSafeTextString(decoder.decode(bytes, { stream: true }));
      } catch {
        textSafe = false;
      }
    }
    if (prefixSize < MAX_SNIFF_BYTES) {
      const part = bytes.subarray(0, MAX_SNIFF_BYTES - prefixSize);
      prefix.push(part); prefixSize += part.byteLength;
    }
  };
  if (source instanceof Uint8Array) add(source);
  else if (Symbol.asyncIterator in source) for await (const value of source as AsyncIterable<Uint8Array>) add(value);
  else for (const value of source as Iterable<Uint8Array>) add(value);
  if (textSafe) {
    try {
      textSafe = isSafeTextString(decoder.decode());
    } catch {
      textSafe = false;
    }
  }
  const head = Buffer.concat(prefix.map((value) => Buffer.from(value)));
  return { prefix: head, sha256: hash.digest("hex"), byteSize, safeText: sawBytes && textSafe };
}

export async function buildInventoryItem(input: InventoryInput): Promise<InventoryItem> {
  const consumed = await consume(input.bytes);
  const classified = classifyRole({
    bytes: consumed.prefix, name: input.name ?? input.filename, safeText: consumed.safeText,
  });
  const { bytes: _bytes, name: _name, ...provenance } = input;
  const partial = {
    ...provenance, ...classified, sha256: consumed.sha256, byteSize: consumed.byteSize,
    mimeType: mimeTypes[classified.detectedFormat]!,
  };
  const itemId = `item-${createHash("sha256").update(canonicalIdentity(partial as InventoryItem)).digest("hex")}`;
  return { ...partial, itemId };
}

export const discoverInventoryItem = buildInventoryItem;
