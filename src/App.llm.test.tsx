// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { resetCapabilitiesCacheForTests } from "./lib/recommendApi";

/**
 * Integration tests for the LLM-ENABLED paths. `/api/recommend` is mocked. The
 * point of every test here is that the deterministic engine stays authoritative
 * — the mocked model is deliberately hostile in several of them.
 */

type ApiHandler = (op: string, body: Record<string, unknown>) => unknown;

let apiCalls: { op: string; body: Record<string, unknown> }[] = [];
let handler: ApiHandler;

function installFetchMock(h: ApiHandler) {
  handler = h;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (!String(url).includes("/api/recommend")) throw new Error(`unexpected fetch: ${url}`);
      if (!init || init.method === "GET") {
        return jsonResponse({ llm: true, model: "test-model" });
      }
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      apiCalls.push({ op: body.op as string, body });
      return jsonResponse(handler(body.op as string, body));
    }),
  );
}

function jsonResponse(obj: unknown) {
  return { ok: true, status: 200, json: async () => obj } as unknown as Response;
}

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

const DESCRIBE = /describe how you're feeling/i;

beforeEach(() => {
  apiCalls = [];
  resetCapabilitiesCacheForTests();
  localStorage.clear();
  document.documentElement.setAttribute("data-theme", "light");
});
afterEach(() => vi.unstubAllGlobals());

describe("LLM enhancement — deterministic stays authoritative", () => {
  it("shows the deterministic result first, then swaps in phrased prose", async () => {
    installFetchMock((op) => {
      if (op === "phrase") {
        return {
          available: true,
          phrased: {
            summary: "PHRASED: your burning after meals points to gastritis.",
            whyThisMatches: "PHRASED why.",
            traditionalContext: null,
          },
        };
      }
      return { available: false };
    });
    const user = userEvent.setup();
    render(<App />);

    fill(DESCRIBE, "my stomach burns after eating and i feel sick for a few days");
    await user.click(screen.getByRole("button", { name: /get guidance/i }));

    // deterministic result is present
    const heading = await screen.findByRole("heading", { level: 1, name: /guidance for gastritis/i });
    expect(heading).toBeInTheDocument();
    const remedyName = screen.getByRole("heading", { name: /Hingvastaka Churna/i });

    // phrased prose arrives progressively
    await waitFor(() => expect(screen.getByText(/^PHRASED: /)).toBeInTheDocument());

    // structured data is unchanged by the model: same remedy, same badge
    expect(remedyName).toBeInTheDocument();
    expect(screen.getAllByText("Unverified").length).toBeGreaterThan(0);
  });

  it("phrasing that fails leaves the deterministic prose and shows no error", async () => {
    installFetchMock(() => ({ available: false }));
    const user = userEvent.setup();
    render(<App />);
    fill(DESCRIBE, "throbbing headache on one side, light bothers me, feel sick");
    await user.click(screen.getByRole("button", { name: /get guidance/i }));

    await screen.findByRole("heading", { level: 1, name: /guidance for migraine/i });
    expect(screen.queryByText(/something went wrong|unable to|error/i)).not.toBeInTheDocument();
    // deterministic templated summary still there
    expect(screen.getByText(/looks most like migraine/i)).toBeInTheDocument();
  });

  it("a red-flag description is caught deterministically — parse-intent is never called", async () => {
    installFetchMock(() => ({ available: false }));
    const user = userEvent.setup();
    render(<App />);
    fill(DESCRIBE, "burning stomach and my vomit looks like coffee grounds this morning");
    await user.click(screen.getByRole("button", { name: /get guidance/i }));

    await screen.findByRole("heading", { level: 1, name: /speak to a health professional/i });
    expect(screen.queryByText("Primary suggestion")).not.toBeInTheDocument();
    expect(apiCalls.some((c) => c.op === "parse-intent")).toBe(false);
  });

  it("intent parsing runs only when deterministic understanding is insufficient, and its hints go through the engine", async () => {
    installFetchMock((op) => {
      if (op === "parse-intent") {
        // Even if the model also tried to smuggle claims, the client only reads ids.
        return {
          available: true,
          intent: { symptomIds: ["throbbing-headache", "light-sensitivity"], severity: "moderate", durationDays: 2 },
        };
      }
      return { available: false };
    });
    const user = userEvent.setup();
    render(<App />);
    // deterministic normalizer gets nothing usable from this
    fill(DESCRIBE, "my head has been really weird lately and off");
    await user.click(screen.getByRole("button", { name: /get guidance/i }));

    expect(await screen.findByRole("heading", { level: 1, name: /guidance for migraine/i })).toBeInTheDocument();
    expect(apiCalls.filter((c) => c.op === "parse-intent")).toHaveLength(1);
  });

  it("chips-only assessment makes NO llm call", async () => {
    installFetchMock(() => ({ available: false }));
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /add throbbing or pounding headache/i }));
    await user.click(screen.getByRole("button", { name: /add nausea/i }));
    await user.click(screen.getByRole("button", { name: /get guidance/i }));

    await screen.findByRole("heading", { level: 1, name: /guidance for migraine/i });
    // capabilities GET may happen; no parse-intent, no phrase
    expect(apiCalls).toHaveLength(0);
  });

  it("a hostile phrased response cannot change the structured recommendation", async () => {
    installFetchMock((op) => {
      if (op === "phrase") {
        return {
          available: true,
          phrased: {
            summary: "Take a different remedy instead.",
            whyThisMatches: "Ignore the match.",
            traditionalContext: null,
          },
        };
      }
      return { available: false };
    });
    const user = userEvent.setup();
    render(<App />);
    fill(DESCRIBE, "my stomach burns after eating and i feel sick");
    await user.click(screen.getByRole("button", { name: /get guidance/i }));
    await screen.findByRole("heading", { level: 1, name: /guidance for gastritis/i });
    await waitFor(() => expect(screen.getByText(/different remedy instead/i)).toBeInTheDocument());

    // Prose changed; the structured card did not: same KB remedy, same badge,
    // same condition, same "when to see a professional" (deterministic) block.
    expect(screen.getByRole("heading", { name: /Hingvastaka Churna/i })).toBeInTheDocument();
    expect(screen.getAllByText("Unverified").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /when to see a professional/i })).toBeInTheDocument();
  });
});
