import { describe, it, expect, vi, afterEach } from "vitest";
import { createNvidiaProvider } from "./nvidia";
import { ProviderError, type AllowedSymptom, type LLMEnv, type PhrasePayload } from "../types";

const ENV: LLMEnv = { LLM_PROVIDER: "nvidia", LLM_API_KEY: "test-key" };

const ALLOWED: AllowedSymptom[] = [
  { id: "burning-stomach", label: "Burning stomach pain", synonyms: ["burning stomach"] },
  { id: "nausea", label: "Nausea", synonyms: ["feel sick"] },
];

const UNVERIFIED_PAYLOAD: PhrasePayload = {
  conditionName: "Gastritis",
  userDescription: "burning after meals",
  matchedSymptoms: ["Burning stomach pain"],
  rationale: ["Prominent option."],
  remedy: {
    name: "Hingvastaka Churna",
    type: "classical-formulation",
    verification: "unverified",
    summary: null,
    traditionalUse: null,
    preparation: null,
    usage: null,
    precautions: [],
    avoidIf: [],
  },
};

/** Stub NVIDIA's OpenAI-compatible chat/completions response. */
function stubNvidia(
  content: string,
  opts: { ok?: boolean; status?: number; finish?: string; refusal?: string; notJson?: boolean } = {},
) {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => {
    return {
      ok: opts.ok ?? true,
      status: opts.status ?? 200,
      json: async () => {
        if (opts.notJson) throw new Error("not json");
        return {
          choices: [
            {
              message: { role: "assistant", content, refusal: opts.refusal ?? null },
              finish_reason: opts.finish ?? "stop",
            },
          ],
        };
      },
      text: async () => "nvidia error detail",
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("createNvidiaProvider — construction", () => {
  it("throws a ProviderError when LLM_API_KEY is missing", () => {
    expect(() => createNvidiaProvider({ LLM_PROVIDER: "nvidia" })).toThrow(ProviderError);
  });

  it("defaults to nvidia/nemotron-3.5-lightning-30b-a3b", () => {
    expect(createNvidiaProvider(ENV).model).toBe("nvidia/nemotron-3.5-lightning-30b-a3b");
  });

  it("honours an LLM_MODEL override", () => {
    expect(createNvidiaProvider({ ...ENV, LLM_MODEL: "nvidia/other-model" }).model).toBe("nvidia/other-model");
  });
});

describe("createNvidiaProvider — request shape", () => {
  it("posts to the NVIDIA endpoint with a Bearer key and system+user messages", async () => {
    const fetchMock = stubNvidia(JSON.stringify({ symptomIds: [], severity: null, durationDays: null }));
    await createNvidiaProvider(ENV).parseIntent({ text: "burning stomach", allowedSymptoms: ALLOWED });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer test-key");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("nvidia/nemotron-3.5-lightning-30b-a3b");
    expect(body.temperature).toBe(0);
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(["system", "user"]);
    expect(body.messages[1].content).toContain("burning stomach");
    // The key is never in the serialisable body.
    expect(JSON.stringify(body)).not.toContain("test-key");
  });
});

describe("createNvidiaProvider — parseIntent grounding", () => {
  it("constrains symptom ids to the allowed list and keeps an explicit severity", async () => {
    stubNvidia(JSON.stringify({ symptomIds: ["burning-stomach", "made-up-id"], severity: "mild", durationDays: 3 }));
    const hints = await createNvidiaProvider(ENV).parseIntent({ text: "mild burning for 3 days", allowedSymptoms: ALLOWED });
    expect(hints).toEqual({ symptomIds: ["burning-stomach"], severity: "mild", durationDays: 3 });
  });

  it("extracts the JSON object even when the model wraps it in prose", async () => {
    stubNvidia('Sure, here is the result:\n{"symptomIds":["nausea"],"severity":null,"durationDays":null}\nHope that helps.');
    const hints = await createNvidiaProvider(ENV).parseIntent({ text: "feeling sick", allowedSymptoms: ALLOWED });
    expect(hints.symptomIds).toEqual(["nausea"]);
  });
});

describe("createNvidiaProvider — phraseRecommendation grounding", () => {
  it("returns validated prose for a well-formed response", async () => {
    stubNvidia(
      JSON.stringify({
        summary: "Based on the burning you described, this traditional formulation came up.",
        whyThisMatches: "Your burning stomach pain matched the entry for this condition.",
        traditionalContext: null,
      }),
    );
    const out = await createNvidiaProvider(ENV).phraseRecommendation(UNVERIFIED_PAYLOAD);
    expect(out.summary).toContain("burning");
    expect(out.traditionalContext).toBeNull();
  });

  it("rejects an overclaim on unverified knowledge (→ deterministic fallback)", async () => {
    stubNvidia(
      JSON.stringify({
        summary: "This remedy is clinically proven to cure gastritis.",
        whyThisMatches: "It treats the condition effectively.",
        traditionalContext: null,
      }),
    );
    await expect(createNvidiaProvider(ENV).phraseRecommendation(UNVERIFIED_PAYLOAD)).rejects.toThrow(ProviderError);
  });

  it("rejects invented traditionalContext when the payload has no such facts", async () => {
    stubNvidia(
      JSON.stringify({
        summary: "A calm summary tied to your description.",
        whyThisMatches: "Grounded in the matched symptom.",
        traditionalContext: "It is traditionally brewed as a morning tea with honey.",
      }),
    );
    await expect(createNvidiaProvider(ENV).phraseRecommendation(UNVERIFIED_PAYLOAD)).rejects.toThrow(ProviderError);
  });
});

describe("createNvidiaProvider — transport failures all fall back", () => {
  it("HTTP error → ProviderError", async () => {
    stubNvidia("", { ok: false, status: 500 });
    await expect(createNvidiaProvider(ENV).parseIntent({ text: "x", allowedSymptoms: ALLOWED })).rejects.toThrow(
      ProviderError,
    );
  });

  it("content_filter finish_reason → ProviderError", async () => {
    stubNvidia("{}", { finish: "content_filter" });
    await expect(createNvidiaProvider(ENV).parseIntent({ text: "x", allowedSymptoms: ALLOWED })).rejects.toThrow(
      ProviderError,
    );
  });

  it("model refusal → ProviderError", async () => {
    stubNvidia("", { refusal: "I can't help with that." });
    await expect(createNvidiaProvider(ENV).parseIntent({ text: "x", allowedSymptoms: ALLOWED })).rejects.toThrow(
      ProviderError,
    );
  });

  it("empty content → ProviderError", async () => {
    stubNvidia("   ");
    await expect(createNvidiaProvider(ENV).parseIntent({ text: "x", allowedSymptoms: ALLOWED })).rejects.toThrow(
      ProviderError,
    );
  });

  it("non-JSON body → ProviderError", async () => {
    stubNvidia("", { notJson: true });
    await expect(createNvidiaProvider(ENV).parseIntent({ text: "x", allowedSymptoms: ALLOWED })).rejects.toThrow(
      ProviderError,
    );
  });

  it("network throw → ProviderError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNRESET");
      }),
    );
    await expect(createNvidiaProvider(ENV).parseIntent({ text: "x", allowedSymptoms: ALLOWED })).rejects.toThrow(
      ProviderError,
    );
  });
});
