import { onRequest } from "firebase-functions/v2/https";
import { initializeRemoteConfig } from "../config/remoteConfig";
import { css2Handler, serveFontHandler } from "../serve/handlers";
import { SEARCH_FUNCTION_OPTIONS, CDN_FUNCTION_OPTIONS } from "../options";
import { serveSearchRequest } from "../search/httpHandler";

/** Semantic font search. POST { q?, filters?, limit? }. */
export const searchFontsHttpUs = onRequest(SEARCH_FUNCTION_OPTIONS, serveSearchRequest);

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
