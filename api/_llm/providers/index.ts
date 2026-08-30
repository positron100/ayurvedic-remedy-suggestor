import type { LLMProvider, LLMEnv } from "../types.ts";
import { createAnthropicProvider } from "./anthropic.ts";
import { createNvidiaProvider } from "./nvidia.ts";

/**
 * Resolves the configured provider, or `null` when the LLM layer is not set up.
 * `null` is the normal, fully-supported state — the app runs deterministically.
 *
 * Adding a provider: write a sibling file exposing `create<Name>Provider(env):
 * LLMProvider` and add one case here. Nothing else in the codebase changes.
 */
export function getProvider(env: LLMEnv): LLMProvider | null {
  const name = env.LLM_PROVIDER?.trim().toLowerCase();
  if (!name) return null;
  try {
    switch (name) {
      case "anthropic":
        return createAnthropicProvider(env);
      case "nvidia":
        return createNvidiaProvider(env);
      default:
        console.error(`[llm] unknown LLM_PROVIDER "${name}" — running without LLM enhancement`);
        return null;
    }
  } catch (e) {
    console.error("[llm] provider init failed — running without LLM enhancement", e);
    return null;
  }
}
