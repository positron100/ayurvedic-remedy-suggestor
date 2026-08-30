/**
 * The NVIDIA NIM provider — the ONLY file that knows NVIDIA's wire format.
 *
 * NVIDIA's hosted inference API (`integrate.api.nvidia.com`) speaks the
 * OpenAI-compatible `/chat/completions` shape. Raw fetch on purpose: no SDK
 * dependency, runs unchanged on Node and edge runtimes, and it exposes the same
 * `LLMProvider` surface as the Anthropic provider — the deterministic engine,
 * prompts, grounding validation, symptom-id constraints, red-flag handling and
 * fallback behaviour are all identical regardless of which provider answers.
 * Nothing here leaks past `getProvider()`.
 */
import { ProviderError, type LLMProvider, type LLMEnv } from "../types.ts";
import { INTENT_SYSTEM, PHRASE_SYSTEM, buildIntentUser, buildPhraseUser } from "../prompts.ts";
import { extractJsonObject, validateIntent, validatePhrasing } from "../validate.ts";

const API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";

export function createNvidiaProvider(env: LLMEnv): LLMProvider {
  const apiKey = env.LLM_API_KEY;
  if (!apiKey) throw new ProviderError("nvidia: LLM_API_KEY is not set");
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
          authorization: `Bearer ${apiKey!}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature: 0,
          messages: [
            { role: "system", content: system },
            { role: "user", content: userJson },
          ],
        }),
      });
    } catch (e) {
      throw new ProviderError("nvidia: request failed or timed out", e);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      // Body is read for the operator log only; never returned to the browser.
      const detail = await res.text().catch(() => "");
      throw new ProviderError(`nvidia: HTTP ${res.status}`, detail.slice(0, 500));
    }

    const data = (await res.json().catch(() => null)) as {
      choices?: {
        message?: { content?: string | null; refusal?: string | null };
        finish_reason?: string;
      }[];
    } | null;
    if (!data) throw new ProviderError("nvidia: response was not JSON");

    const choice = data.choices?.[0];
    if (choice?.message?.refusal) throw new ProviderError("nvidia: model refused");
    if (choice?.finish_reason === "content_filter") throw new ProviderError("nvidia: response filtered");

    const text = choice?.message?.content;
    if (typeof text !== "string" || !text.trim()) throw new ProviderError("nvidia: empty response");

    // Grounding is enforced downstream in validate.ts — this only pulls the
    // JSON object out of whatever wrapper text the model emitted.
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

/** Same bounds as the Anthropic provider — kept in step deliberately: a
 *  provider swap must not change the timeout contract. */
function clampTimeout(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 8000;
  return Math.min(Math.max(n, 1000), 20000);
}
