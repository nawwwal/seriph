import { detectContentSignature, type DetectedFormat } from "./contentSignature";

export type InventoryRole = "font" | "archive" | "source" | "documentation" | "web" | "junk" | "unresolved";
export type InventoryAction = "parse" | "expand" | "retain_private" | "discard" | "review";

export interface ClassifiedInventory {
  format: DetectedFormat;
  detectedFormat: DetectedFormat;
  role: InventoryRole;
  action: InventoryAction;
  reasonCode: string;
}

const disposableNames = new Set([".ds_store", "thumbs.db", "desktop.ini"]);
const documentationExtensions = new Set([".md", ".markdown", ".txt", ".text", ".rst"]);
const webExtensions = new Set([".css", ".scss", ".sass", ".html", ".htm", ".js", ".json", ".xml"]);

const extensionOf = (name: string): string => {
  const base = name.split(/[\\/]/).pop() ?? name;
  const dot = base.lastIndexOf(".");
  return dot < 0 ? "" : base.slice(dot).toLowerCase();
};

export const isSafeTextString = (text: string): boolean => {
  if (text.includes("\uFFFD") || text.includes("\u0000")) return false;
  return [...text].every((character) => {
    const code = character.codePointAt(0)!;
    return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
  });
};

export const isSafeTextContent = (bytes: Uint8Array): boolean => {
  if (bytes.length === 0) return false;
  try {
    return isSafeTextString(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return false;
  }
};

const recognizedWebPayload = (extension: string, bytes: Uint8Array): boolean => {
  if (!isSafeTextContent(bytes)) return false;
  const text = Buffer.from(bytes).toString("utf8").trim();
  if ([".html", ".htm"].includes(extension)) return /<!doctype\s+html|<html(?:\s|>)/i.test(text);
  if ([".xml"].includes(extension)) return /^<\?xml\b|<[A-Za-z][^>]*>/.test(text);
  if ([".css", ".scss", ".sass"].includes(extension)) return /\{[\s\S]*\}/.test(text) && /[\w-]+\s*:/.test(text);
  if ([".json"].includes(extension)) {
    try {
      const value: unknown = JSON.parse(text);
      return typeof value === "object" && value !== null;
    } catch {
      return false;
    }
  }
  return /\b(?:const|let|var|function|class|import|export)\b|=>|\b(?:document|window)\./.test(text);
};

export function classifyRole(input: { bytes: Uint8Array; name: string; safeText?: boolean }): ClassifiedInventory {
  const format = detectContentSignature(input.bytes);
  const basename = (input.name.split(/[\\/]/).pop() ?? input.name).toLowerCase();
  const isDsStore = input.bytes.length >= 4 && Buffer.from(input.bytes.subarray(0, 4)).toString("ascii") === "Bud1";
  if (disposableNames.has(basename) || isDsStore) {
    return { format, detectedFormat: format, role: "junk", action: "discard", reasonCode: "disposable_name" };
  }
  if (["TTF", "OTF", "WOFF", "WOFF2", "EOT"].includes(format)) {
    return { format, detectedFormat: format, role: "font", action: "parse", reasonCode: "detected_font" };
  }
  if (format === "ZIP") {
    return { format, detectedFormat: format, role: "archive", action: "expand", reasonCode: "archive_container" };
  }
  if (format === "GLYPHS") {
    return { format, detectedFormat: format, role: "source", action: "retain_private", reasonCode: "source_asset" };
  }
  const extension = extensionOf(input.name);
  const textSafe = input.safeText ?? isSafeTextContent(input.bytes);
  if (documentationExtensions.has(extension) && textSafe) {
    return {
      format, detectedFormat: format, role: "documentation", action: "retain_private", reasonCode: "documentation",
    };
  }
  if (webExtensions.has(extension) && textSafe && recognizedWebPayload(extension, input.bytes)) {
    return { format, detectedFormat: format, role: "web", action: "retain_private", reasonCode: "web_asset" };
  }
  return { format, detectedFormat: format, role: "unresolved", action: "review", reasonCode: "unsupported_content" };
}

export const classifyInventoryItem = classifyRole;
