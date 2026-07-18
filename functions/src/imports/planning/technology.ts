import type { FontFormat } from "../../storage/transcode";

export type FontTechnology = "Variable" | "OTF" | "TTF" | "WOFF" | "WOFF2" | "EOT";

export interface VariableAxisLike {
  tag?: string;
  minValue?: number;
  maxValue?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  default?: number;
}

const FORMATS = new Set<FontFormat>(["TTF", "OTF", "WOFF", "WOFF2", "EOT"]);

function formatValue(value: string | undefined): FontFormat | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase().replace(/^\./, "").replace(/^FONT\//, "");
  return FORMATS.has(normalized as FontFormat) ? normalized as FontFormat : undefined;
}

export function resolveContainerFormat(input: {
  format?: string;
  extension?: string;
  filename?: string;
}): FontFormat {
  const filenameExtension = input.filename?.match(/\.([^.]+)$/)?.[1];
  return formatValue(input.format) ?? formatValue(input.extension) ?? formatValue(filenameExtension) ?? "OTF";
}

export function resolveFontTechnology(input: {
  format?: string;
  extension?: string;
  filename?: string;
  isVariable?: boolean;
  variableAxes?: readonly VariableAxisLike[];
}): FontTechnology {
  if ((input.variableAxes ?? []).length > 0) return "Variable";
  return resolveContainerFormat(input);
}

export const resolveTechnology = resolveFontTechnology;
