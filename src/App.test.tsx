// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

/**
 * Product-flow tests against the real compiled knowledge base (App calls
 * `getKnowledgeBase()`). Reduced motion is forced on in the test setup, so the
 * assessment resolves synchronously with no processing screen.
 */

/** Set a field's value in one event — `userEvent.type` re-renders per keystroke,
 *  which is far too slow with framer-motion in the tree. */
function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function setup() {
  return { user: userEvent.setup(), ...render(<App />) };
}

const DESCRIBE = /describe how you're feeling/i;

describe("Sattva — assessment flow", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.setAttribute("data-theme", "light");
  });

  it("landing shows the composer and the disclaimer", () => {
    setup();
    expect(screen.getByRole("heading", { name: /how are you feeling today/i })).toBeInTheDocument();
    expect(screen.getByLabelText(DESCRIBE)).toBeInTheDocument();
    expect(screen.getAllByText(/not medical advice/i).length).toBeGreaterThan(0);
  });

  it("submit is disabled with no input and enabled once a symptom is picked", async () => {
    const { user } = setup();
    const submit = screen.getByRole("button", { name: /get guidance/i });
    expect(submit).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /add throbbing or pounding headache/i }));
    expect(submit).toBeEnabled();
  });

  it("selecting and removing a symptom chip works", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /add joint pain/i }));
    const yourSymptoms = screen.getByText("Your symptoms").parentElement!;
    expect(within(yourSymptoms).getByText("Joint pain")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /remove joint pain/i }));
    expect(screen.queryByText("Your symptoms")).not.toBeInTheDocument();
  });

  it("a clear symptom description produces a structured recommendation", async () => {
    const { user } = setup();
    fill(DESCRIBE, "throbbing headache on one side of my head and bright lights bother me, feel sick");
    await user.click(screen.getByRole("button", { name: /get guidance/i }));

    expect(await screen.findByRole("heading", { level: 1, name: /guidance for migraine/i })).toBeInTheDocument();
    expect(screen.getByText(/match strength/i)).toBeInTheDocument();
    expect(screen.getByText("Primary suggestion")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /precautions & when to avoid/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /when to see a professional/i })).toBeInTheDocument();
  });

  it("insufficient input asks for more rather than guessing", async () => {
    const { user } = setup();
    fill(DESCRIBE, "I feel a bit tired");
    await user.click(screen.getByRole("button", { name: /get guidance/i }));

    expect(await screen.findByRole("heading", { level: 1, name: /tell me a little more/i })).toBeInTheDocument();
    expect(screen.queryByText("Primary suggestion")).not.toBeInTheDocument();
    expect(screen.getByText(/do any of these apply/i)).toBeInTheDocument();
  });

  it("can continue from an insufficient result in place, without restarting", async () => {
    const { user } = setup();
    fill(DESCRIBE, "I feel a bit tired");
    await user.click(screen.getByRole("button", { name: /get guidance/i }));
    await screen.findByRole("heading", { name: /tell me a little more/i });

    await user.click(screen.getByRole("button", { name: /add burning or gnawing pain in the upper abdomen/i }));
    await user.click(screen.getByRole("button", { name: /add stomach discomfort that changes with meals/i }));
    await user.click(screen.getByRole("button", { name: /^continue$/i }));

    expect(await screen.findByRole("heading", { level: 1, name: /guidance for gastritis/i })).toBeInTheDocument();
  });

  it("a red-flag description overrides everything and shows no remedy", async () => {
    const { user } = setup();
    fill(DESCRIBE, "burning stomach and my vomit looks like coffee grounds this morning");
    await user.click(screen.getByRole("button", { name: /get guidance/i }));

    expect(await screen.findByRole("heading", { level: 1, name: /speak to a health professional/i })).toBeInTheDocument();
    expect(screen.queryByText("Primary suggestion")).not.toBeInTheDocument();
    expect(screen.getByText("Emergency")).toBeInTheDocument();
  });

  it("restart returns to an empty composer", async () => {
    const { user } = setup();
    fill(DESCRIBE, "throbbing headache with light sensitivity and nausea");
    await user.click(screen.getByRole("button", { name: /get guidance/i }));
    await screen.findByRole("heading", { level: 1, name: /guidance for/i });

    await user.click(screen.getByRole("button", { name: "New assessment" }));
    expect(await screen.findByLabelText(DESCRIBE)).toHaveValue("");
  });

  it("expand/collapse disclosure sections are keyboard operable", async () => {
    const { user } = setup();
    fill(DESCRIBE, "throbbing headache one side, light and sound bother me, nausea");
    await user.click(screen.getByRole("button", { name: /get guidance/i }));
    await screen.findByRole("heading", { level: 1, name: /guidance for migraine/i });

    const trigger = screen.getByRole("button", { name: /how it is traditionally used/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("theme toggle flips data-theme and persists", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /switch to dark theme/i }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });
});
