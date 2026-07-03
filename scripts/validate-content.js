#!/usr/bin/env node
// Validates every industry's content files against the schema documented
// in README.md. Run with `npm run validate`. Exits non-zero on any error
// so it can be wired into CI later if needed.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

let errors = 0;
let warnings = 0;

function fail(msg) { console.error('  ✗ ' + msg); errors++; }
function warn(msg) { console.warn('  ⚠ ' + msg); warnings++; }
function ok(msg) { console.log('  ✓ ' + msg); }

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    fail(`${file} is missing or is not valid JSON (${e.message})`);
    return null;
  }
}

function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }

const registryPath = path.join(DATA_DIR, 'industries.json');
const registry = readJSON(registryPath);
if (!Array.isArray(registry)) {
  console.error('data/industries.json must be a JSON array. Aborting.');
  process.exit(1);
}

console.log(`Found ${registry.length} industr${registry.length === 1 ? 'y' : 'ies'} in the registry.\n`);

registry.forEach((entry) => {
  console.log(`── ${entry.id || '(missing id)'} ──────────────────────────`);
  if (!isNonEmptyString(entry.id)) fail('registry entry missing "id"');
  if (!isNonEmptyString(entry.label)) fail('registry entry missing "label"');
  if (!Array.isArray(entry.painNames)) warn('registry entry missing "painNames" (readiness widget will fall back to pain titles)');

  const dir = path.join(DATA_DIR, entry.id || '');
  if (!fs.existsSync(dir)) {
    fail(`no folder at data/${entry.id}`);
    console.log('');
    return;
  }

  // pains.json — required, non-empty. Each item is either the "rich" shape
  // (num/title/theySay/story/phoneQ/rootCause) or the "simple" shape
  // (num/title/summary). Both are supported by the renderer.
  const pains = readJSON(path.join(dir, 'pains.json'));
  let painCount = 0;
  if (Array.isArray(pains)) {
    painCount = pains.length;
    if (pains.length === 0) fail('pains.json is empty — every industry needs at least one pain');
    pains.forEach((p, i) => {
      if (!isNonEmptyString(p.num)) fail(`pains[${i}] missing "num"`);
      if (!isNonEmptyString(p.title)) fail(`pains[${i}] missing "title"`);
      const hasSimple = isNonEmptyString(p.summary);
      const hasRich = isNonEmptyString(p.story) && isNonEmptyString(p.phoneQ) && isNonEmptyString(p.rootCause) && isNonEmptyString(p.theySay);
      if (!hasSimple && !hasRich) fail(`pains[${i}] ("${p.title}") needs either "summary" (simple format) or "story"+"theySay"+"phoneQ"+"rootCause" (rich format)`);
    });
    if (painCount > 0) ok(`pains.json — ${painCount} pain(s)`);
  }

  // flashcards.json
  const flashcards = readJSON(path.join(dir, 'flashcards.json'));
  if (Array.isArray(flashcards)) {
    flashcards.forEach((c, i) => {
      if (!isNonEmptyString(c.id)) fail(`flashcards[${i}] missing "id"`);
      if (typeof c.pain !== 'number' || c.pain < 0 || c.pain >= painCount) fail(`flashcards[${i}] "pain" index ${c.pain} is out of range (0-${painCount - 1})`);
      if (!isNonEmptyString(c.q)) fail(`flashcards[${i}] missing "q"`);
      if (!isNonEmptyString(c.a)) fail(`flashcards[${i}] missing "a"`);
    });
    ok(`flashcards.json — ${flashcards.length} card(s)`);
  }

  // quiz.json
  const quiz = readJSON(path.join(dir, 'quiz.json'));
  if (Array.isArray(quiz)) {
    const VALID_TYPES = ['mc', 'fitb', 'scenario'];
    quiz.forEach((q, i) => {
      if (!isNonEmptyString(q.id)) fail(`quiz[${i}] missing "id"`);
      if (!VALID_TYPES.includes(q.type)) fail(`quiz[${i}] "type" must be one of ${VALID_TYPES.join('/')}, got "${q.type}"`);
      if (typeof q.pain !== 'number' || q.pain < 0 || q.pain >= painCount) fail(`quiz[${i}] "pain" index ${q.pain} is out of range (0-${painCount - 1})`);
      if (!isNonEmptyString(q.q)) fail(`quiz[${i}] missing "q"`);
      if (!isNonEmptyString(q.explanation)) fail(`quiz[${i}] missing "explanation"`);
      if (q.type === 'mc' || q.type === 'scenario') {
        if (!Array.isArray(q.options) || q.options.length < 2) fail(`quiz[${i}] (${q.type}) needs an "options" array with 2+ choices`);
        if (typeof q.correct !== 'number' || q.correct < 0 || (Array.isArray(q.options) && q.correct >= q.options.length)) fail(`quiz[${i}] "correct" index is missing or out of range`);
        if (q.type === 'scenario' && !isNonEmptyString(q.context)) fail(`quiz[${i}] (scenario) missing "context"`);
      }
      if (q.type === 'fitb') {
        if (!q.q.includes('___________')) fail(`quiz[${i}] (fitb) "q" must contain the blank marker "___________"`);
        if (!isNonEmptyString(q.blank)) fail(`quiz[${i}] (fitb) missing "blank"`);
      }
    });
    ok(`quiz.json — ${quiz.length} question(s)`);
  }

  // scenarios.json
  const scenarios = readJSON(path.join(dir, 'scenarios.json'));
  if (Array.isArray(scenarios)) {
    scenarios.forEach((s, i) => {
      if (!isNonEmptyString(s.prospect)) fail(`scenarios[${i}] missing "prospect"`);
      if (!isNonEmptyString(s.ideal)) fail(`scenarios[${i}] missing "ideal"`);
      if (!isNonEmptyString(s.hook)) fail(`scenarios[${i}] missing "hook"`);
    });
    ok(`scenarios.json — ${scenarios.length} scenario(s)`);
  }

  // Optional "vertical playbook" files — empty arrays are fine (the tile
  // just won't show on the home screen), but if present, check shape.
  const whyWeel = readJSON(path.join(dir, 'why-weel-wins.json'));
  if (Array.isArray(whyWeel)) {
    whyWeel.forEach((w, i) => { if (!isNonEmptyString(w.title) || !isNonEmptyString(w.text)) fail(`why-weel-wins[${i}] needs "title" and "text"`); });
    ok(`why-weel-wins.json — ${whyWeel.length} item(s)${whyWeel.length === 0 ? ' (tile hidden on home screen)' : ''}`);
  }

  const useCases = readJSON(path.join(dir, 'use-cases.json'));
  if (Array.isArray(useCases)) {
    useCases.forEach((u, i) => { if (!isNonEmptyString(u.title) || !isNonEmptyString(u.text)) fail(`use-cases[${i}] needs "title" and "text"`); });
    ok(`use-cases.json — ${useCases.length} item(s)${useCases.length === 0 ? ' (tile hidden on home screen)' : ''}`);
  }

  const competitors = readJSON(path.join(dir, 'competitors.json'));
  if (Array.isArray(competitors)) {
    competitors.forEach((c, i) => { if (!isNonEmptyString(c.name) || !isNonEmptyString(c.status) || !isNonEmptyString(c.when) || !isNonEmptyString(c.angle)) fail(`competitors[${i}] needs "name", "status", "when", "angle"`); });
    ok(`competitors.json — ${competitors.length} item(s)${competitors.length === 0 ? ' (tile hidden on home screen)' : ''}`);
  }

  const customers = readJSON(path.join(dir, 'customers.json'));
  if (Array.isArray(customers)) {
    customers.forEach((c, i) => { if (!isNonEmptyString(c.industry) || !isNonEmptyString(c.businesses)) fail(`customers[${i}] needs "industry" and "businesses"`); });
    ok(`customers.json — ${customers.length} item(s)${customers.length === 0 ? ' (tile hidden on home screen)' : ''}`);
  }

  console.log('');
});

console.log('────────────────────────────────────────');
if (errors > 0) {
  console.error(`FAILED — ${errors} error(s), ${warnings} warning(s).`);
  process.exit(1);
} else {
  console.log(`PASSED — 0 errors, ${warnings} warning(s).`);
}
