import { Readable } from "node:stream";
import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";
import { handleArchive } from "../../src/imports/archiveWorker/handleArchive";
import { archiveHeaders, archiveLimits, archivePayload, testDependencies, testSource } from "./archiveWorkerSupport";

describe("archive worker streaming policy", () => {
  it("reviews and drains entries after maxEntries without persisting them", async () => {
    const parser = vi.fn(async function* (stream) { stream.resume(); for (const name of ["one.ttf", "two.ttf"]) yield { path: name, type: "File", flags: 0, compressionMethod: 0, compressedSize: 4, uncompressedSize: 4, stream: () => Readable.from([Buffer.from([0, 1, 0, 0])]) }; });
    const deps = testDependencies(testSource(), { parser, limits: { ...archiveLimits, maxEntries: 1 } });
    await expect(handleArchive({ body: archivePayload, headers: archiveHeaders }, deps)).resolves.toMatchObject({ status: 204 });
    expect(deps.persistence.persistChild).toHaveBeenCalledOnce(); expect(deps.persistence.completeArchive).toHaveBeenCalledWith(expect.objectContaining({ reviews: [expect.objectContaining({ reasonCode: "entry_limit" })] }));
  });
  it("applies shared path policy reviews and renews the lease", async () => {
    const parser = vi.fn(async function* (stream) { stream.resume(); yield { path: "../escape.ttf", type: "File", flags: 0, compressionMethod: 0, compressedSize: 4, uncompressedSize: 4, stream: () => Readable.from([Buffer.from("bad")]) }; });
    const deps = testDependencies(testSource(), { parser });
    await expect(handleArchive({ body: archivePayload, headers: archiveHeaders }, deps)).resolves.toMatchObject({ status: 204 });
    expect(deps.persistence.persistChild).not.toHaveBeenCalled(); expect(deps.persistence.completeArchive).toHaveBeenCalledWith(expect.objectContaining({ reviews: [expect.objectContaining({ reasonCode: "path_traversal" })] }));
    expect(deps.lease.renew).toHaveBeenCalled();
  });
  it("rejects a registered non-ZIP and a mismatched streamed byte count", async () => {
    const nonZip = testDependencies(testSource({ filename: "font.ttf", declaredMimeType: "application/octet-stream" }));
    await expect(handleArchive({ body: archivePayload, headers: archiveHeaders }, nonZip)).resolves.toMatchObject({ status: 400 });
    const mismatch = testDependencies(testSource({ declaredSize: 150 * 1024 * 1024 + 10 }));
    await expect(handleArchive({ body: archivePayload, headers: archiveHeaders }, mismatch)).resolves.toMatchObject({ status: 400, body: { code: "source_size_mismatch" } });
  });
  it("parses a real ZIP through the streaming parser", async () => {
    const zip = new JSZip(); zip.file("font.ttf", Buffer.from([0, 1, 0, 0]));
    const bytes = Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "STORE" }));
    const source = testSource({ declaredSize: bytes.byteLength, createReadStream: vi.fn(() => Readable.from([bytes])) });
    const deps = testDependencies(source, { parser: undefined, limits: { ...archiveLimits, maxEntries: 10, maxExpandedBatchBytes: 100 } });
    await expect(handleArchive({ body: archivePayload, headers: archiveHeaders }, deps)).resolves.toMatchObject({ status: 204 });
  });
});
