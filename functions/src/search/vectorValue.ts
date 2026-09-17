function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numbers(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every((item) => typeof item === "number" && Number.isFinite(item))) return null;
  return value;
}

export function asNumberVector(value: unknown): number[] | null {
  const direct = numbers(value);
  if (direct) return direct;
  if (!isRecord(value)) return null;
  if (typeof value.toArray === "function") {
    const fromMethod = numbers(value.toArray());
    if (fromMethod) return fromMethod;
  }
  return numbers(value._values) ?? numbers(value.values);
}
