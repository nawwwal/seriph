import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getAuth } from "firebase-admin/auth";
import { initializeRemoteConfig } from "../config/remoteConfig";
import { searchFonts } from "../search/searchFonts";
import { css2Handler, serveFontHandler } from "../serve/handlers";
import { SEARCH_FUNCTION_OPTIONS, CDN_FUNCTION_OPTIONS } from "../options";

async function uidFromBearer(authHeader: string | undefined): Promise<string | null> {
  const header = authHeader || "";
  if (!header.startsWith("Bearer ")) return null;
  try {
    return (await getAuth().verifyIdToken(header.slice("Bearer ".length))).uid;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function objectPayload(body: unknown): Record<string, unknown> {
  if (typeof body === "string") {
    const parsed: unknown = JSON.parse(body || "{}");
    return isRecord(parsed) ? parsed : {};
  }
  return isRecord(body) ? body : {};
}

function searchRequestFromPayload(payload: Record<string, unknown>, uid: string) {
  const filters = isRecord(payload.filters) ? payload.filters : {};
  const limit = typeof payload.limit === "number" && Number.isFinite(payload.limit)
    ? Math.min(100, Math.max(1, Math.floor(payload.limit)))
    : undefined;
  return {
    q: typeof payload.q === "string" ? payload.q : "",
    limit,
    debug: payload.debug === true,
    filters: {
      ownerId: uid,
      category: typeof filters.category === "string" ? filters.category : undefined,
      isVariable: typeof filters.isVariable === "boolean" ? filters.isVariable : undefined,
    },
  };
}

/** Semantic font search. POST { q?, filters?, limit? }. */
export const searchFontsHttp = onRequest(SEARCH_FUNCTION_OPTIONS, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    await initializeRemoteConfig();
  } catch {
    // defaults
  }
  try {
    const uid = await uidFromBearer(req.headers.authorization);
    if (!uid) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const payload = objectPayload(req.body);
    const response = await searchFonts(searchRequestFromPayload(payload, uid));
    res.status(200).json(response);
  } catch (e: any) {
    logger.error("searchFontsHttp failed", { message: e?.message, stack: e?.stack });
    res.status(500).json({ error: "Search failed", details: e?.message });
  }
});

/** Google-Fonts-style CSS API. GET /css2?family=... (Hosting rewrites /css2 here). */
export const css2 = onRequest(CDN_FUNCTION_OPTIONS, async (req, res) => {
  try {
    await initializeRemoteConfig();
  } catch {
    // defaults
  }
  await css2Handler(req as any, res as any);
});

/** Font asset serving: /s/** (web woff2) and /d/** (original download). */
export const serveFont = onRequest(CDN_FUNCTION_OPTIONS, async (req, res) => {
  try {
    await initializeRemoteConfig();
  } catch {
    // defaults
  }
  await serveFontHandler(req as any, res as any);
});
