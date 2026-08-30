/**
 * All user-facing copy lives here, never hardcoded in JSX (portfolio rule,
 * kept). Product name is provisional — "Sattva" (सत्त्व), the Ayurvedic
 * principle of balance and clarity. Easy to change: it appears only here and
 * in index.html.
 */

export const siteConfig = {
  name: "Sattva",
  tagline: "Calm, structured Ayurvedic remedy guidance.",
  intro:
    "Describe your symptoms in your own words. Sattva matches them against a curated Ayurvedic knowledge base and returns structured guidance — with clear precautions and honest signals for when to see a professional.",
  author: "Mukul Negi",
  email: "mukuknegi2005@gmail.com",
  // Real profile URLs go here — each link only renders when its value is
  // present, so nothing points at a made-up address in the meantime.
  socials: {
    github: undefined as string | undefined,
    linkedin: undefined as string | undefined,
  },
} as const;

/**
 * Contact section copy. The "letter" the visitor writes is addressed to the
 * site's author; the wax seal carries their initials.
 */
export const contactCopy = {
  kicker: "Contact",
  heading: "Spotted something we should fix?",
  subtitle:
    "Sattva's knowledge base is small and deliberately conservative. If an entry reads wrong, or you know an authoritative source we should cite, tell me.",
  greeting: "Dear Mukul,",
  sealInitials: "MN",
  delivered: "Your message reached Mukul. I'll read it soon.",
} as const;

/**
 * The standing medical disclaimer. Shown in the footer and alongside every
 * recommendation. This text is deliberately central so it reads identically
 * everywhere it appears.
 */
export const disclaimer = {
  short: "Guidance only — not medical advice, diagnosis, or treatment.",
  full: "Sattva offers general information drawn from traditional Ayurvedic sources. It is not a medical diagnosis or a treatment plan, and it cannot account for your full health history. Always consult a qualified healthcare professional before starting any remedy, and seek prompt medical care for severe, sudden, or worsening symptoms.",
} as const;

export const conditionsInScope = ["Arthritis", "Diarrhea", "Gastritis", "Migraine"] as const;

/** Example prompts shown in the empty state to seed the free-text input. */
export const examplePrompts = [
  "Burning pain in my upper stomach that gets worse after meals",
  "Throbbing headache on one side with sensitivity to light",
  "Loose, watery stools since yesterday and mild stomach cramps",
  "Stiff, aching knees in the morning that ease as I move",
] as const;

export const navLinks = [
  { id: "how-it-works", label: "How it works" },
  { id: "about", label: "About" },
  { id: "contact", label: "Contact" },
] as const;

/** Severity segmented-control options. `undefined` value = "Not sure". */
export const severityOptions = [
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
  { value: undefined, label: "Not sure" },
] as const;

/**
 * How a 0–1 engine confidence value is described to the user. This communicates
 * *how well the input matched a condition* — never medical certainty or
 * effectiveness.
 */
export const confidenceBands = [
  { min: 0.7, label: "Strong match", tone: "accent" as const },
  { min: 0.5, label: "Good match", tone: "accent" as const },
  { min: 0.3, label: "Limited match", tone: "clay" as const },
  { min: 0, label: "More information needed", tone: "clay" as const },
];

/** Short steps shown during the processing micro-transition. */
export const processingSteps = [
  "Reading your description",
  "Matching curated knowledge",
  "Preparing your guidance",
] as const;

/** Copy for each recommendation outcome's screen. */
export const resultCopy = {
  ok: {
    eyebrow: "Based on what you've described",
    announce: "Guidance is ready.",
  },
  low_confidence: {
    eyebrow: "A tentative match, based on what you've described",
    announce: "A tentative match is ready. Read it lightly.",
  },
  insufficient_information: {
    eyebrow: "Let's narrow this down",
    announce: "A little more information would help.",
  },
  no_matching_condition: {
    eyebrow: "Outside what Sattva covers",
    announce: "This doesn't match a condition Sattva covers.",
  },
  red_flag: {
    eyebrow: "This is worth getting checked",
    announce: "Some of what you described is worth having a professional look at.",
  },
} as const;
