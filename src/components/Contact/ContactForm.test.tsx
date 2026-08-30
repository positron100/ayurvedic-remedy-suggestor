// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ContactForm } from "./ContactForm";

/**
 * Reduced motion is forced on in the test setup, so `runDelivery` takes its
 * plain status-text path — no envelope choreography to wait on.
 */

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillValid() {
  fill(/my name is/i, "Jane Doe");
  fill(/you can reach me at/i, "jane@example.com");
  fill(/i wanted to say/i, "There is an entry that looks like it needs a citation.");
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ContactForm", () => {
  it("blocks an empty submit with per-field errors and sends nothing", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<ContactForm />);

    fireEvent.click(screen.getByRole("button", { name: /seal & send/i }));

    expect(await screen.findByText(/enter your name/i)).toBeInTheDocument();
    expect(screen.getByText(/enter your email/i)).toBeInTheDocument();
    expect(screen.getByText(/enter a message/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects an invalid email", async () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<ContactForm />);

    fill(/my name is/i, "Jane");
    fill(/you can reach me at/i, "not-an-email");
    fill(/i wanted to say/i, "A perfectly long enough message here.");
    fireEvent.click(screen.getByRole("button", { name: /seal & send/i }));

    expect(await screen.findByText(/valid email address/i)).toBeInTheDocument();
  });

  it("confirms delivery on a successful send", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }) as Response));
    render(<ContactForm />);

    fillValid();
    fireEvent.click(screen.getByRole("button", { name: /seal & send/i }));

    expect(await screen.findByText(/message delivered/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /write another/i })).toBeInTheDocument();
  });

  it("shows a retry affordance when the send fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({ error: "Unable to send right now." }) }) as Response),
    );
    render(<ContactForm />);

    fillValid();
    fireEvent.click(screen.getByRole("button", { name: /seal & send/i }));

    await waitFor(() => expect(screen.getByText(/the letter came back/i)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /email me directly/i })).toBeInTheDocument();
  });
});
