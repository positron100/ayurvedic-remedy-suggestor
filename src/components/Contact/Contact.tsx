import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, m, useAnimationControls, useReducedMotion } from "framer-motion";
import { ContactForm } from "@/components/Contact/ContactForm";
import { ContactBackground } from "@/components/Contact/ContactBackground";
import { Magnetic } from "@/components/Magnetic";
import { Reveal } from "@/components/Reveal";
import { SectionTitle } from "@/components/SectionTitle";
import { contactCopy, siteConfig } from "@/data/site";
import { cn } from "@/lib/cn";
import { duration, ease, jiggle, press } from "@/utils/motion";
import type { ContactFormValues } from "@/lib/contactForm";

/**
 * The closing section. Adapted from the portfolio's `Contact` — same two-column
 * shape (invitation + reachable channels on the left, the letter on the right)
 * and the same letter/envelope send sequence in `ContactForm`. The portfolio's
 * `SectionBigTitle` scroll-scaling headline is swapped for this site's calmer
 * `SectionTitle`, and `useConnectedScroll` is dropped — the other sections here
 * settle in with `Reveal`, so this one does too.
 */
export function Contact() {
  const { email, socials } = siteConfig;
  const [activeField, setActiveField] = useState<keyof ContactFormValues | null>(null);

  return (
    <section id="contact" className="relative scroll-mt-24 overflow-hidden border-t border-border py-24 sm:py-32">
      <ContactBackground />

      <div className="container-px relative mx-auto max-w-5xl">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-12">
          <div>
            <SectionTitle kicker={contactCopy.kicker} heading={contactCopy.heading} subtitle={contactCopy.subtitle} />

            <Reveal delay={0.15} className="mt-10 space-y-2">
              <EmailRow email={email} isActive={activeField === "email"} />
              {socials.linkedin && (
                <ContactLink href={socials.linkedin} label="LinkedIn" value="Connect on LinkedIn" icon={<LinkedInIcon />} />
              )}
              {socials.github && (
                <ContactLink href={socials.github} label="GitHub" value="View the source" icon={<GitHubIcon />} />
              )}
            </Reveal>
          </div>

          <Reveal delay={0.12}>
            <ContactForm onFieldFocus={setActiveField} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function EmailRow({ email, isActive }: { email: string; isActive?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable — the mailto link right next to this still works.
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Magnetic strength={8} className="min-w-0 flex-1">
        <a
          href={`mailto:${email}`}
          className={cn(
            "flex items-center gap-4 rounded-2xl border p-4 transition-colors hover:border-border-strong hover:bg-bg-subtle",
            isActive ? "border-accent bg-accent-soft" : "border-border bg-bg-elevated",
          )}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-subtle text-fg">
            <MailIcon />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-medium tracking-widest text-fg-faint uppercase">Email</span>
            <span className="block truncate text-sm font-medium text-fg">{email}</span>
          </span>
        </a>
      </Magnetic>

      <CopyButton email={email} copied={copied} onCopy={handleCopy} />
    </div>
  );
}

/**
 * The copy control — magnetic like every other button, with the copy mark
 * cross-fading to a drawn tick rather than being swapped for one. Two elements,
 * one job each: the magnetic wrapper owns `x`/`y`, the button owns the press
 * and the settle.
 */
function CopyButton({ email, copied, onCopy }: { email: string; copied: boolean; onCopy: () => void }) {
  const reduceMotion = useReducedMotion();
  const controls = useAnimationControls();
  const wasCopied = useRef(false);

  useEffect(() => {
    if (copied && !wasCopied.current && !reduceMotion) {
      controls.start({ ...jiggle.settle, transition: jiggle.settleTransition });
    }
    wasCopied.current = copied;
  }, [copied, controls, reduceMotion]);

  const swap = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 520, damping: 26, mass: 0.7 };

  return (
    <div className="relative shrink-0">
      <AnimatePresence>
        {copied && (
          <m.span
            aria-hidden="true"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 2, scale: 0.95 }}
            transition={{ duration: duration.fast, ease: ease.standard }}
            className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border bg-bg-elevated px-2.5 py-1 text-[11px] whitespace-nowrap text-fg-muted shadow-sm"
          >
            Copied
          </m.span>
        )}
      </AnimatePresence>

      <Magnetic strength={10}>
        <m.button
          type="button"
          onClick={onCopy}
          animate={controls}
          whileTap={reduceMotion ? undefined : press.whileTap}
          transition={press.transition}
          aria-label={copied ? `${email} copied to clipboard` : `Copy ${email} to clipboard`}
          className={cn(
            "relative flex h-11 w-11 items-center justify-center rounded-full border transition-colors",
            copied ? "border-accent text-accent" : "border-border text-fg-muted hover:border-border-strong hover:text-fg",
          )}
        >
          <m.span
            aria-hidden="true"
            initial={false}
            animate={{ opacity: copied ? 0 : 1, scale: copied ? 0.5 : 1, rotate: copied ? -12 : 0 }}
            transition={swap}
            className="absolute flex items-center justify-center"
          >
            <CopyIcon />
          </m.span>
          <m.span
            aria-hidden="true"
            initial={false}
            animate={{ opacity: copied ? 1 : 0, scale: copied ? 1 : 0.5 }}
            transition={swap}
            className="absolute flex items-center justify-center"
          >
            <DrawnCheckIcon copied={copied} reduceMotion={Boolean(reduceMotion)} />
          </m.span>

          <span role="status" aria-live="polite" className="sr-only">
            {copied ? "Email address copied to clipboard" : ""}
          </span>
        </m.button>
      </Magnetic>
    </div>
  );
}

function DrawnCheckIcon({ copied, reduceMotion }: { copied: boolean; reduceMotion: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <m.path
        d="M20 6 9 17l-5-5"
        initial={false}
        animate={{ pathLength: copied ? 1 : 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.32, delay: copied ? 0.06 : 0, ease: ease.standard }}
      />
    </svg>
  );
}

function ContactLink({ href, label, value, icon }: { href: string; label: string; value: string; icon: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="group flex items-center gap-4 rounded-2xl border border-border bg-bg-elevated p-4 transition-colors hover:border-border-strong hover:bg-bg-subtle"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-subtle text-fg">{icon}</span>
      <span className="flex-1">
        <span className="block text-xs font-medium tracking-widest text-fg-faint uppercase">{label}</span>
        <span className="block text-sm font-medium text-fg">{value}</span>
      </span>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-fg-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      >
        <path d="M7 17 17 7M8 7h9v9" />
      </svg>
    </a>
  );
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.15 1.45-2.15 2.94v5.67H9.34V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45Z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.58 2 12.19c0 4.5 2.87 8.32 6.84 9.67.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.73 0 0 .84-.28 2.75 1.05a9.3 9.3 0 0 1 2.5-.35c.85 0 1.71.12 2.5.35 1.91-1.33 2.75-1.05 2.75-1.05.55 1.42.2 2.47.1 2.73.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.19C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}
