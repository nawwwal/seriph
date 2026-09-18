import { logger } from "firebase-functions";
import { RC_KEYS } from "../../config/rcKeys";
import { getConfigValue } from "../../config/remoteConfig";
import { parseSystemOneResult, type SystemOneResult } from "./answers";

export type { ChoiceAnswer, NoulAnswer, ScoreAnswer, SystemOneAnswer, SystemOneResult } from "./answers";
export {
  choiceConfidence,
  choiceProbabilities,
  choiceValue,
  nearestScoreLevel,
  noulValue,
  questionId,
  scoreLevelProbability,
  scoreValue,
} from "./answers";

const SYSTEM_ONE_URL = "https://api.typesafe.ai/v1/systemone";
const RETRY_STATUSES = new Set([429, 529]);
const MAX_ATTEMPTS = 4;

interface EvaluationOptions {
  maxAttempts?: number;
  timeoutMs?: number;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 4000);
  return Math.min(250 * 2 ** attempt, 4000);
}

async function postSystemOne(apiKey: string, body: string, options: EvaluationOptions = {}): Promise<Response> {
  let last: Response | undefined;
  const attempts = Math.max(1, Math.min(MAX_ATTEMPTS, options.maxAttempts ?? MAX_ATTEMPTS));
  const controller = new AbortController();
  const timer = options.timeoutMs ? setTimeout(() => controller.abort(), options.timeoutMs) : undefined;
  try {
    for (let attempt = 0; attempt < attempts; attempt++) {
      last = await fetch(SYSTEM_ONE_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });
      if (!RETRY_STATUSES.has(last.status)) return last;
      if (attempt < attempts - 1) await wait(retryDelay(last, attempt));
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
  return last!;
}

export async function evaluateSystemOne(
  state: unknown,
  questions: Record<string, unknown>,
  options?: EvaluationOptions,
): Promise<SystemOneResult> {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) throw new Error("typesafe_api_key_missing");
  const model = process.env.JEV_MODEL?.trim() || getConfigValue(RC_KEYS.jevModelName, "jev-1.13.0");
  const response = await postSystemOne(apiKey, JSON.stringify({ model, state, questions }), options);
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    logger.warn("typesafe systemone failed", { status: response.status, detail });
    throw new Error(`typesafe_http_${response.status}`);
  }
  return parseSystemOneResult(await response.json());
}
