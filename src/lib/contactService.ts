import type { ContactFormValues } from "@/lib/contactForm";

/**
 * Posts the form to the site's own contact endpoint, which sends the mail.
 * Ported from the portfolio (`src/utils/contactService.ts`).
 *
 * Nothing secret passes through here — the Resend API key, the destination
 * address and the verified sender all live in the endpoint's environment, and
 * the browser only ever sees this JSON body and an ok/error back.
 *
 * Throws on failure so `ContactForm`'s try/catch drives its error state.
 */
export async function submitContactForm(values: ContactFormValues): Promise<void> {
  const response = await fetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });

  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? "Unable to send right now.");
  }
}
