import { canonicalSearchClassification } from "./searchClassification";
import type { SearchIntent } from "../ai/jev/search/intent";

export interface AnalyzedQueryIntent {
  intent: SearchIntent;
  inferredClass: string | null;
  requiresVariable: boolean;
}

const VIBE_WORDS = /\b(happy|joy|joyful|cheerful|playful|warm|cozy|cold|cool|editorial|luxury|luxurious|minimal|minimalist|brutalist|retro|vintage|90s|80s|70s|60s|futuristic|modern|classic|friendly|serious|authoritative|elegant|romantic|spooky|calm|energetic|bold|soft|clean|sharp|geometric|organic|humanist|grotesque|transitional|didone|slab|quirky|expressive|neutral|refined|whimsical|formal|casual|industrial|handcrafted|artisan|mood|vibe|feel|energy|era|style|aesthetic)\b/;
const JOB_WORDS = /\b(wedding|invitation|invite|poster|headline|headlines|branding|brand|packaging|book|books|magazine|article|ui|ux|app|dashboard|code|coding|terminal|ide|programming|menu|restaurant|logotype|logo|body|caption|subhead|billboard|ecommerce|portfolio|presentation|deck|certificate|signage|wayfinding|newspaper|label|card|flyer|title)\b/;

export function inferredQueryClassification(rawQuery: string): string | null {
  const q = rawQuery.toLowerCase();
  if (!q.trim()) return null;
  if (/\bsans[- ]serif\b/.test(q) || /\bgrotesk\b|\bgrotesque\b/.test(q)) return "Sans Serif";
  if (/\b(mono|monospace|typewriter|coding|terminal)\b/.test(q)) return "Monospace";
  if (/\b(script|handwriting|handwritten|cursive|calligraph\w*|brush)\b/.test(q)) return "Script & Handwriting";
  if (/\b(symbol|icon|icons|dingbat)\b/.test(q)) return "Symbol & Icon";
  if (/\bserif\b/.test(q) && !/\bsans\b/.test(q)) return "Serif";
  if (/\bslab\b/.test(q)) return "Serif";
  if (/\b(display|decorative|ornamental|blackletter|gothic)\b/.test(q)) return "Display & Decorative";
  return canonicalSearchClassification(q);
}

export function analyzeQueryIntent(normalizedQuery: string): AnalyzedQueryIntent {
  const q = normalizedQuery.toLowerCase();
  const inferredClass = inferredQueryClassification(q);
  const requiresVariable = /\b(variable|axes|axis|wght|opsz)\b/.test(q);
  if (JOB_WORDS.test(q)) return { intent: "job", inferredClass, requiresVariable };
  if (VIBE_WORDS.test(q)) return { intent: "vibe", inferredClass, requiresVariable };
  if (!q.trim()) return { intent: "browse", inferredClass: null, requiresVariable: false };
  return { intent: "vibe", inferredClass, requiresVariable };
}
