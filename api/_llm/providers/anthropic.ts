/**
 * The Anthropic provider — the ONLY file that knows Anthropic's wire format.
 *
 * Raw fetch on purpose: no SDK dependency, runs unchanged on Node and edge
 * runtimes, and a different provider is a sibling file with its own fetch and
 * the same `LLMProvider` surface. Nothing here leaks past `getProvider()`.
 */
import { ProviderError, type LLMProvider, type LLMEnv } from "../types";
import { INTENT_SYSTEM, PHRASE_SYSTEM, buildIntentUser, buildPhraseUser } from "../prompts";
import { extractJsonObject, validateIntent, validatePhrasing } from "../validate";

const API_URL = "https://api.anthropic.com/v1/messages";
// The stable Messages API version string (a fixed identifier, not "today").
const API_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-haiku-4-5";

export function createAnthropicProvider(env: LLMEnv): LLMProvider {
  const apiKey = env.LLM_API_KEY;
  if (!apiKey) throw new ProviderError("anthropic: LLM_API_KEY is not set");
  const model = env.LLM_MODEL?.trim() || DEFAULT_MODEL;
  const timeoutMs = clampTimeout(env.LLM_TIMEOUT_MS);

  async function call(system: string, userJson: string, maxTokens: number): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(API_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "x-api-key": apiKey!,
          "anthropic-version": API_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature: 0,
          system,
          messages: [{ role: "user", content: userJson }],
        }),
      });
    } catch (e) {
      throw new ProviderError("anthropic: request failed or timed out", e);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      // Body is read for the operator log only; never returned to the browser.
      const detail = await res.text().catch(() => "");
      throw new ProviderError(`anthropic: HTTP ${res.status}`, detail.slice(0, 500));
    }

    const data = (await res.json().catch(() => null)) as {
      content?: { type: string; text?: string }[];
      stop_reason?: string;
    } | null;
    if (!data) throw new ProviderError("anthropic: response was not JSON");
    if (data.stop_reason === "refusal") throw new ProviderError("anthropic: model refused");

    const text = (data.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("");
    if (!text) throw new ProviderError("anthropic: empty response");

    return extractJsonObject(text);
  }

  const provider: LLMProvider = {
    model,
    async parseIntent({ text, allowedSymptoms }) {
      const raw = await call(INTENT_SYSTEM, buildIntentUser(text, allowedSymptoms), 400);
      return validateIntent(raw, allowedSymptoms);
    },
    async phraseRecommendation(payload) {
      const raw = await call(PHRASE_SYSTEM, buildPhraseUser(payload), 700);
      return validatePhrasing(raw, payload);
    },
  };
  return provider;
}

function clampTimeout(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 8000;
  return Math.min(Math.max(n, 1000), 20000);
}
