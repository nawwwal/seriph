import type { VariableAxisLike } from "./technology";

export interface LogicalFaceInput {
  styleName: string;
  weight: number;
  width: number;
  italic: boolean;
  slant?: number;
  opticalSize?: number | string;
  variableAxes?: readonly VariableAxisLike[];
  postScriptName?: string;
}

export function normalizeIdentityKey(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFC")
    .toLocaleLowerCase("en-US")
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function numberValue(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "none";
}

function axisValue(axis: VariableAxisLike, long: "minValue" | "maxValue" | "defaultValue", short: "min" | "max" | "default"): number | undefined {
  return axis[long] ?? axis[short];
}

export function axisSignature(axes: readonly VariableAxisLike[] | undefined): string {
  return (axes ?? [])
    .filter((axis) => Boolean(axis.tag?.trim()))
    .map((axis) => ({
      tag: normalizeIdentityKey(axis.tag),
      min: numberValue(axisValue(axis, "minValue", "min")),
      max: numberValue(axisValue(axis, "maxValue", "max")),
      value: numberValue(axisValue(axis, "defaultValue", "default")),
    }))
    .sort((left, right) => left.tag.localeCompare(right.tag))
    .map((axis) => `${axis.tag}-${axis.min}-${axis.max}-${axis.value}`)
    .join("_");
}

export function resolveLogicalFaceKey(input: LogicalFaceInput): string {
  const style = normalizeIdentityKey(input.styleName) || "regular";
  const axes = axisSignature(input.variableAxes) || "none";
  const optical = typeof input.opticalSize === "string"
    ? normalizeIdentityKey(input.opticalSize) || "none"
    : numberValue(input.opticalSize);
  return [
    style,
    `w-${numberValue(input.weight)}`,
    `wdth-${numberValue(input.width)}`,
    `italic-${input.italic ? "yes" : "no"}`,
    `slant-${numberValue(input.slant)}`,
    `opsz-${optical}`,
    `axes-${axes}`,
    `ps-${normalizeIdentityKey(input.postScriptName) || "none"}`,
  ].join("|");
}

export const logicalFaceKey = resolveLogicalFaceKey;
