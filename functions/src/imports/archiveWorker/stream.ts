import { createHash } from "node:crypto";
import { Readable, Transform } from "node:stream";
import * as unzipper from "unzipper";
import type { ArchiveParser, ArchiveStreamEntry } from "./types";

export interface ObservedArchive {
  stream: NodeJS.ReadableStream;
  complete: Promise<{ sha256: string; byteSize: number; prefix: Buffer }>;
}

export function observe(source: NodeJS.ReadableStream | AsyncIterable<Uint8Array>): ObservedArchive {
  const input = "pipe" in source ? source : Readable.from(source); const hash = createHash("sha256");
  const prefix: Buffer[] = []; let byteSize = 0; let resolveComplete!: (value: ObservedArchive["complete"] extends Promise<infer T> ? T : never) => void;
  let rejectComplete!: (error: unknown) => void;
  const complete = new Promise<{ sha256: string; byteSize: number; prefix: Buffer }>((resolve, reject) => { resolveComplete = resolve; rejectComplete = reject; });
  const output = new Transform({
    transform(chunk: Buffer | string, _encoding, callback) {
      const bytes = Buffer.from(chunk); hash.update(bytes); byteSize += bytes.byteLength;
      if (Buffer.concat(prefix).byteLength < 8) prefix.push(bytes.subarray(0, 8 - Buffer.concat(prefix).byteLength));
      callback(null, bytes);
    },
    flush(callback) { resolveComplete({ sha256: hash.digest("hex"), byteSize, prefix: Buffer.concat(prefix) }); callback(); },
  });
  input.once("error", rejectComplete); output.once("error", rejectComplete);
  (input as NodeJS.ReadableStream & { pipe: (destination: NodeJS.WritableStream) => unknown }).pipe(output);
  return { stream: output, complete };
}

export const sourceLooksLikeZip = (source: { filename: string; declaredMimeType: string }, prefix: Buffer): boolean =>
  source.declaredMimeType.toLowerCase() === "application/zip" && /\.zip$/i.test(source.filename) && ["504b0304", "504b0506", "504b0708"].some((signature) => prefix.subarray(0, 4).toString("hex") === signature);

export const drain = async (entry: ArchiveStreamEntry): Promise<void> => { for await (const _chunk of entry.stream()) { /* bounded discard */ } };

export const defaultParser: ArchiveParser = (source) => {
  const parser = unzipper.Parse({ forceStream: true });
  (source as NodeJS.ReadableStream & { pipe: (destination: NodeJS.WritableStream) => unknown }).pipe(parser);
  return (async function* () {
    for await (const raw of parser as AsyncIterable<Record<string, any>>) {
      const values = raw.vars ?? raw;
      yield { path: raw.path, type: raw.type ?? values.type, flags: Number(values.flags ?? raw.flags ?? 0), compressionMethod: Number(values.compressionMethod ?? raw.compressionMethod ?? 0),
        compressedSize: Number(values.compressedSize ?? raw.compressedSize ?? 0), uncompressedSize: Number(values.uncompressedSize ?? raw.uncompressedSize ?? 0),
        versionMadeBy: values.versionMadeBy ?? raw.versionMadeBy, externalFileAttributes: values.externalFileAttributes ?? raw.externalFileAttributes,
        stream: () => raw as unknown as AsyncIterable<Uint8Array> };
    }
  })();
};
