import { getStorage } from "firebase-admin/storage";
import { CATALOG_KEY_PREFIX } from "../../ai/enrichFont";

export type BatchOutputRow = Record<string, unknown>;

function asRecord(value: unknown): BatchOutputRow | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as BatchOutputRow
    : null;
}

function records(value: unknown): BatchOutputRow[] {
  return Array.isArray(value) ? value.map(asRecord).filter((item): item is BatchOutputRow => item !== null) : [];
}

function nested(record: BatchOutputRow | null, key: string): BatchOutputRow | null {
  return record ? asRecord(record[key]) : null;
}

export function catalogKeyFromOutputRow(row: BatchOutputRow): string | null {
  if (typeof row.key === "string" && row.key) return row.key;
  const request = nested(row, "request");
  const contents = records(request?.contents);
  const parts = records(contents[0]?.parts);
  for (const part of parts) {
    const text = typeof part.text === "string" ? part.text : "";
    if (!text.includes(CATALOG_KEY_PREFIX)) continue;
    const match = text.match(new RegExp(`${CATALOG_KEY_PREFIX}\\s*(\\S+)`));
    if (match) return match[1];
  }
  return null;
}

export function textFromOutputRow(row: BatchOutputRow): string | undefined {
  const response = nested(row, "response");
  const candidates = records(response?.candidates);
  const content = nested(candidates[0] ?? null, "content");
  const parts = records(content?.parts);
  return typeof parts[0]?.text === "string" ? parts[0].text : undefined;
}

export async function readOutputLines(bucket: string, outputPrefix: string): Promise<BatchOutputRow[]> {
  const [files] = await getStorage().bucket(bucket).getFiles({ prefix: outputPrefix });
  const rows: BatchOutputRow[] = [];
  for (const file of files.filter((item) => item.name.endsWith(".jsonl"))) {
    const [buf] = await file.download();
    for (const line of buf.toString("utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = asRecord(JSON.parse(trimmed));
        if (parsed) rows.push(parsed);
      } catch {
        // Ignore malformed output rows; batch polling can continue with valid rows.
      }
    }
  }
  return rows;
}
