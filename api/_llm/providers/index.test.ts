import { describe, it, expect } from "vitest";
import { getProvider } from "./index";
import type { LLMEnv } from "../types";

describe("getProvider — selection", () => {
  it("returns null when LLM_PROVIDER is unset", () => {
    expect(getProvider({})).toBeNull();
    expect(getProvider({ LLM_API_KEY: "k" })).toBeNull();
  });

  it("returns the Anthropic provider for LLM_PROVIDER=anthropic", () => {
    const p = getProvider({ LLM_PROVIDER: "anthropic", LLM_API_KEY: "k" });
    expect(p?.model).toBe("claude-haiku-4-5");
  });

  it("returns the NVIDIA provider for LLM_PROVIDER=nvidia", () => {
    const p = getProvider({ LLM_PROVIDER: "nvidia", LLM_API_KEY: "k" });
    expect(p?.model).toBe("nvidia/nemotron-3.5-lightning-30b-a3b");
  });

  it("is case- and whitespace-insensitive on the provider name", () => {
    expect(getProvider({ LLM_PROVIDER: "  NVIDIA ", LLM_API_KEY: "k" })?.model).toBe(
      "nvidia/nemotron-3.5-lightning-30b-a3b",
    );
  });

  it("honours LLM_MODEL per provider", () => {
    expect(getProvider({ LLM_PROVIDER: "nvidia", LLM_API_KEY: "k", LLM_MODEL: "nvidia/custom" })?.model).toBe(
      "nvidia/custom",
    );
  });

  it("returns null (not a throw) when the selected provider has no key", () => {
    const env: LLMEnv = { LLM_PROVIDER: "nvidia" };
    expect(getProvider(env)).toBeNull();
  });

  it("returns null for an unknown provider name", () => {
    expect(getProvider({ LLM_PROVIDER: "openai", LLM_API_KEY: "k" })).toBeNull();
  });
});
