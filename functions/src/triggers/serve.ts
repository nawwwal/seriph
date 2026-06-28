import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { initializeRemoteConfig } from "../config/remoteConfig";
import { searchFonts } from "../search/searchFonts";
import { css2Handler, serveFontHandler } from "../serve/handlers";
import { SEARCH_FUNCTION_OPTIONS, CDN_FUNCTION_OPTIONS } from "../options";

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
    const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const response = await searchFonts(payload);
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
