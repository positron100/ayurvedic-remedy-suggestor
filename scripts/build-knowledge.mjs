/**
 * Compiles and validates content/ into src/generated/knowledge.json.
 *
 * Validation is deliberately hand-rolled (no ajv dependency) — the schema is
 * small and the checks that matter are cross-references, not deep shape
 * validation. The build FAILS (exit 1) on any broken reference or missing
 * required field, so a bad edit to content/ can never ship.
 *
 * Run: node scripts/build-knowledge.mjs   (also runs via predev / prebuild)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = resolve(root, "content");
const outFile = resolve(root, "src/generated/knowledge.json");

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

function readJson(name) {
  const path = resolve(contentDir, name);
  if (!existsSync(path)) {
    err(`missing content file: ${name}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    err(`invalid JSON in ${name}: ${e.message}`);
    return null;
  }
}

// ---------------------------------------------------------------- load

if (!existsSync(contentDir)) {
  // Phase A fallback — no content yet. Emit an empty KB and stop.
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(
    outFile,
    JSON.stringify(
      { version: 0, generatedAt: new Date().toISOString(), conditions: [], remedies: [], symptoms: [], redFlags: [], sources: [], safety: null },
      null,
      2,
    ),
  );
  console.warn("[kb] content/ not found — wrote empty knowledge base.");
  process.exit(0);
}

const sourcesDoc = readJson("sources.json");
const symptomsDoc = readJson("symptoms.json");
const redFlagsDoc = readJson("red-flags.json");
const safetyDoc = readJson("safety.json");
const conditionsDoc = readJson("conditions.json");
const remediesDoc = readJson("remedies.json");

if (errors.length) fail();

const sources = sourcesDoc.sources ?? [];
const symptoms = symptomsDoc.symptoms ?? [];
const redFlags = redFlagsDoc.redFlags ?? [];
const safety = safetyDoc.safety ?? null;
const conditions = conditionsDoc.conditions ?? [];
const remedies = remediesDoc.remedies ?? [];

// ---------------------------------------------------------------- id sets

const sourceIds = idSet(sources, "sources.json");
const symptomIds = idSet(symptoms, "symptoms.json");
const redFlagIds = idSet(redFlags, "red-flags.json");
const remedyIds = idSet(remedies, "remedies.json");
idSet(conditions, "conditions.json"); // registers duplicate-id checks for conditions

function idSet(arr, file) {
  const set = new Set();
  for (const item of arr) {
    if (!item.id || typeof item.id !== "string") {
      err(`${file}: record without a string id`);
      continue;
    }
    if (set.has(item.id)) err(`${file}: duplicate id "${item.id}"`);
    set.add(item.id);
  }
  return set;
}

// ---------------------------------------------------------------- ref checks

const VALID_PROVENANCE = new Set(["inherited-legacy-dataset", "sourced", "editorial", "unverified"]);
const VALID_VERIFICATION = new Set(["unverified", "needs_review", "sourced", "reviewed"]);
const VALID_URGENCY = new Set(["emergency", "urgent", "advisory"]);
const VALID_SEVERITY = new Set(["mild", "moderate", "severe"]);
const VALID_DEMOGRAPHIC = new Set(["pregnancy", "breastfeeding", "child", "older-adult", "none"]);

function checkSourceRefs(refs, where) {
  for (const id of refs ?? []) {
    if (!sourceIds.has(id)) err(`${where}: unknown source id "${id}"`);
  }
}

function checkAttributed(a, where) {
  if (a == null) return;
  if (!VALID_PROVENANCE.has(a.provenance)) err(`${where}: invalid provenance "${a.provenance}"`);
  if (a.provenance === "sourced" && (!a.sources || a.sources.length === 0)) {
    err(`${where}: provenance "sourced" but no sources listed`);
  }
  checkSourceRefs(a.sources, where);
}

// symptoms
for (const s of symptoms) {
  if (!s.label) err(`symptom ${s.id}: missing label`);
  if (!Array.isArray(s.synonyms)) err(`symptom ${s.id}: synonyms must be an array`);
}

// red flags
for (const f of redFlags) {
  if (!f.label) err(`red flag ${f.id}: missing label`);
  if (!Array.isArray(f.triggers) || f.triggers.length === 0) err(`red flag ${f.id}: needs at least one trigger`);
  if (!f.guidance) err(`red flag ${f.id}: missing guidance`);
  if (!VALID_URGENCY.has(f.urgency)) err(`red flag ${f.id}: invalid urgency "${f.urgency}"`);
  if (!VALID_PROVENANCE.has(f.provenance)) err(`red flag ${f.id}: invalid provenance`);
  checkSourceRefs(f.sources, `red flag ${f.id}`);
}

// safety
if (!safety) {
  err("safety.json: missing `safety` object");
} else {
  for (const id of safety.globalRedFlags ?? []) {
    if (!redFlagIds.has(id)) err(`safety.globalRedFlags: unknown red flag id "${id}"`);
  }
  for (const key of ["lowConfidenceThreshold", "insufficientInfoThreshold", "minSymptomSignals"]) {
    if (typeof safety[key] !== "number") err(`safety.${key}: must be a number`);
  }
  if (!safety.disclaimer?.short || !safety.disclaimer?.full) err("safety.disclaimer: needs short and full");
}

// remedies
const VALID_REMEDY_TYPE = new Set([
  "single-herb", "classical-formulation", "home-preparation", "mineral-preparation", "combination", "procedure",
]);
for (const r of remedies) {
  const w = `remedy ${r.id}`;
  if (!r.canonicalName) err(`${w}: missing canonicalName`);
  if (!Array.isArray(r.aliases)) err(`${w}: aliases must be an array`);
  if (!VALID_REMEDY_TYPE.has(r.type)) err(`${w}: invalid type "${r.type}"`);
  for (const f of ["ingredients", "contraindications", "precautions", "interactions", "avoidIf", "sources"]) {
    if (!Array.isArray(r[f])) err(`${w}: ${f} must be an array`);
  }
  checkAttributed(r.summary, `${w}.summary`);
  checkAttributed(r.traditionalUse, `${w}.traditionalUse`);
  checkAttributed(r.preparation, `${w}.preparation`);
  checkAttributed(r.usage, `${w}.usage`);
  (r.precautions ?? []).forEach((p, i) => checkAttributed(p, `${w}.precautions[${i}]`));
  (r.interactions ?? []).forEach((p, i) => checkAttributed(p, `${w}.interactions[${i}]`));
  (r.ingredients ?? []).forEach((ing, i) => {
    if (!ing.name) err(`${w}.ingredients[${i}]: missing name`);
    if (!VALID_PROVENANCE.has(ing.provenance)) err(`${w}.ingredients[${i}]: invalid provenance`);
    checkSourceRefs(ing.sources, `${w}.ingredients[${i}]`);
  });
  (r.contraindications ?? []).forEach((c, i) => {
    if (!c.detail) err(`${w}.contraindications[${i}]: missing detail`);
    if (!VALID_PROVENANCE.has(c.provenance)) err(`${w}.contraindications[${i}]: invalid provenance`);
    checkSourceRefs(c.sources, `${w}.contraindications[${i}]`);
  });
  for (const f of r.avoidIf ?? []) {
    if (!VALID_DEMOGRAPHIC.has(f)) err(`${w}.avoidIf: invalid flag "${f}"`);
  }
  for (const cid of r.components ?? []) {
    if (!remedyIds.has(cid)) err(`${w}.components: unknown remedy id "${cid}"`);
  }
  if (!r.verification || !VALID_VERIFICATION.has(r.verification.level)) err(`${w}: invalid/missing verification.level`);
  if (r.verification && !r.verification.summary) err(`${w}: verification.summary is required`);
  checkSourceRefs(r.sources, `${w}.sources`);
}

// conditions
for (const c of conditions) {
  const w = `condition ${c.id}`;
  if (!c.name) err(`${w}: missing name`);
  if (!c.summary) err(`${w}: missing summary`);
  checkAttributed(c.ayurvedicView, `${w}.ayurvedicView`);

  for (const link of c.symptoms ?? []) {
    if (!symptomIds.has(link.symptomId)) err(`${w}.symptoms: unknown symptom id "${link.symptomId}"`);
    if (![1, 2, 3].includes(link.weight)) err(`${w}.symptoms[${link.symptomId}]: weight must be 1-3`);
  }
  if (!c.symptoms || c.symptoms.length === 0) err(`${w}: needs at least one symptom link`);

  for (const link of c.remedies ?? []) {
    if (!remedyIds.has(link.remedyId)) err(`${w}.remedies: unknown remedy id "${link.remedyId}"`);
    if (![1, 2, 3].includes(link.weight)) err(`${w}.remedies[${link.remedyId}]: weight must be 1-3`);
    for (const s of link.severity ?? []) {
      if (!VALID_SEVERITY.has(s)) err(`${w}.remedies[${link.remedyId}]: invalid severity "${s}"`);
    }
    if (!link.severity || link.severity.length === 0) err(`${w}.remedies[${link.remedyId}]: needs at least one severity`);
    if (!VALID_PROVENANCE.has(link.provenance)) err(`${w}.remedies[${link.remedyId}]: invalid provenance`);
    checkSourceRefs(link.sources, `${w}.remedies[${link.remedyId}]`);
  }
  if (!c.remedies || c.remedies.length === 0) err(`${w}: needs at least one remedy link`);

  for (const id of c.redFlags ?? []) {
    if (!redFlagIds.has(id)) err(`${w}.redFlags: unknown red flag id "${id}"`);
  }
  (c.generalPrecautions ?? []).forEach((p, i) => checkAttributed(p, `${w}.generalPrecautions[${i}]`));
  (c.whenToSeeProfessional ?? []).forEach((p, i) => checkAttributed(p, `${w}.whenToSeeProfessional[${i}]`));
  if (!c.whenToSeeProfessional || c.whenToSeeProfessional.length === 0) {
    err(`${w}: whenToSeeProfessional is required (safety-critical)`);
  }
  for (const sev of ["mild", "moderate", "severe"]) {
    if (!c.severityGuidance?.[sev]) err(`${w}.severityGuidance.${sev}: required`);
  }
  checkSourceRefs(c.sources, `${w}.sources`);
  if (!c.verification || !VALID_VERIFICATION.has(c.verification.level)) err(`${w}: invalid/missing verification.level`);
}

// Reverse check — every remedy should be reachable from at least one condition.
const linkedRemedies = new Set(conditions.flatMap((c) => (c.remedies ?? []).map((l) => l.remedyId)));
for (const id of remedyIds) {
  if (!linkedRemedies.has(id)) warn(`remedy "${id}" is not linked from any condition`);
}

if (errors.length) fail();

// ---------------------------------------------------------------- emit

const kb = {
  version: 1,
  generatedAt: new Date().toISOString(),
  conditions,
  remedies,
  symptoms,
  redFlags,
  sources,
  safety,
};

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(kb, null, 2));

const counts = `${conditions.length} conditions, ${remedies.length} remedies, ${symptoms.length} symptoms, ${redFlags.length} red flags`;
const verified = remedies.filter((r) => r.verification.level === "sourced" || r.verification.level === "reviewed").length;
console.log(`[kb] ok — ${counts}. ${verified}/${remedies.length} remedies have sourced content.`);
if (warnings.length) console.warn(`[kb] ${warnings.length} warning(s):\n  - ${warnings.join("\n  - ")}`);

function fail() {
  console.error(`[kb] BUILD FAILED — ${errors.length} error(s):\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}
