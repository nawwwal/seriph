import { serverParseFontFile } from "../parser/fontParser";
import type { FontFace, FontFamilyDoc, FontFaceMeta } from "../models/catalog.models";
import { mapWithConcurrency } from "./scriptConcurrency";

type ParsedFont = NonNullable<Awaited<ReturnType<typeof serverParseFontFile>>>;

interface FetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

type FetchOriginal = (url: string) => Promise<FetchResponse>;
type ParseFont = (fileBuffer: Buffer, originalFilename: string) => Promise<ParsedFont | null>;

export interface ReparseOriginalOptions {
  fetchOriginal?: FetchOriginal;
  parseFont?: ParseFont;
  concurrency?: number;
}

function defaultFetch(): FetchOriginal {
  const fetchOriginal = (globalThis as { fetch?: FetchOriginal }).fetch;
  if (!fetchOriginal) throw new Error("Global fetch is not available; run with Node 18+.");
  return fetchOriginal;
}

function filenameFromFace(face: FontFace): string {
  const source = face.original?.storagePath || face.original?.url || face.filename;
  const withoutQuery = source.split(/[?#]/)[0] ?? source;
  const parts = withoutQuery.split("/").filter(Boolean);
  return decodeURIComponent(parts.at(-1) ?? face.filename);
}

function metaFromParsed(parsed: ParsedFont, existing: FontFaceMeta | undefined): FontFaceMeta | undefined {
  const meta: FontFaceMeta = {
    ...existing,
    familyName: parsed.familyName,
    subfamilyName: parsed.subfamilyName,
    preferredFamily: parsed.preferredFamily,
    preferredSubfamily: parsed.preferredSubfamily,
    wwsFamilyName: parsed.wwsFamilyName,
    wwsSubfamilyName: parsed.wwsSubfamilyName,
    characterSetCoverage: parsed.characterSetCoverage,
    openTypeFeatures: parsed.openTypeFeatures,
    glyphCount: parsed.glyphCount,
    languageSupport: parsed.languageSupport,
    version: parsed.version,
    copyright: parsed.copyright,
    license: parsed.licenseUrl || parsed.licenseDescription || existing?.license,
  };
  return Object.fromEntries(Object.entries(meta).filter(([, value]) => value !== undefined)) as FontFaceMeta;
}

async function reparseFace(face: FontFace, options: Required<ReparseOriginalOptions>): Promise<FontFace> {
  const url = face.original?.url;
  if (!url) return face;
  const response = await options.fetchOriginal(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  const parsed = await options.parseFont(Buffer.from(await response.arrayBuffer()), filenameFromFace(face));
  if (!parsed) return face;
  return {
    ...face,
    format: parsed.format || face.format,
    postScriptName: parsed.postScriptName || face.postScriptName,
    fullName: parsed.fullName || face.fullName,
    weight: typeof parsed.weight === "number" ? parsed.weight : face.weight,
    isVariable: !!parsed.isVariable || face.isVariable,
    meta: metaFromParsed(parsed, face.meta),
  };
}

export async function reparseOriginalFaces(
  families: FontFamilyDoc[],
  options: ReparseOriginalOptions = {}
): Promise<FontFamilyDoc[]> {
  const resolved: Required<ReparseOriginalOptions> = {
    concurrency: options.concurrency ?? 8,
    fetchOriginal: options.fetchOriginal ?? defaultFetch(),
    parseFont: options.parseFont ?? serverParseFontFile,
  };
  return mapWithConcurrency(families, resolved.concurrency, async (family) => ({
    ...family,
    faces: await mapWithConcurrency(family.faces ?? [], resolved.concurrency, (face) => reparseFace(face, resolved)),
  }));
}
