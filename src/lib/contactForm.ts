/**
 * Contact form shape + client-side validation. Ported from the portfolio
 * (`src/types/index.ts` + `src/utils/validateContactForm.ts`). The browser
 * check is a convenience; `api/_contact.ts` re-validates and is the rule.
 */

export type FormStatus = "idle" | "submitting" | "success" | "error";

export interface ContactFormValues {
  name: string;
  email: string;
  message: string;
  /** Honeypot, filled only by bots. Never rendered visibly. */
  company?: string;
}

export type ContactFormErrors = Partial<Record<keyof ContactFormValues, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContactForm(values: ContactFormValues): ContactFormErrors {
  const errors: ContactFormErrors = {};

  if (!values.name.trim()) {
    errors.name = "Please enter your name.";
  } else if (values.name.trim().length < 2) {
    errors.name = "Name must be at least 2 characters.";
  }

  if (!values.email.trim()) {
    errors.email = "Please enter your email.";
  } else if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = "Please enter a valid email address.";
  }

  if (!values.message.trim()) {
    errors.message = "Please enter a message.";
  } else if (values.message.trim().length < 10) {
    errors.message = "Message should be at least 10 characters.";
  }

  return errors;
}
