export type JsonObject = Record<string, unknown>;

export type JsonObjectResult =
  | { ok: true; value: JsonObject }
  | { ok: false; message: string };

export interface JsonReadable {
  json: () => Promise<unknown>;
}

export function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function readJsonObject(request: JsonReadable): Promise<JsonObjectResult> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, message: 'Malformed JSON body' };
  }
  if (!isJsonObject(body)) {
    return { ok: false, message: 'Expected a JSON object body' };
  }
  return { ok: true, value: body };
}
