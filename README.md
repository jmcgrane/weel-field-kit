# Weel Field Kit

A BDR training tool: pain points, terminology, competitor landscape, and existing
customers for each industry vertical Weel sells into. Built to be trivially
extendable — adding a new industry means adding data files, not writing code.

## Running it locally

No dependencies to install.

```
npm run dev
```

Then open http://localhost:4173. (It has to be served over HTTP, not opened as
a `file://` path — the app fetches its content as JSON at runtime, and browsers
block `fetch()` from local files.)

## How it's structured

```
index.html            The page shell — screens, containers, no per-industry content.
assets/
  app.js              The engine. Knows nothing about specific industries by name.
  styles.css          All styling.
data/
  industries.json     The registry — one entry per industry, in display order.
  <industry-id>/
    pains.json            Required. The 5 (or however many) core pain points.
    flashcards.json       Required. Active-recall cards, tagged to a pain.
    quiz.json              Required. Multiple choice / fill-in-blank / scenario questions.
    scenarios.json          Required. "On The Phone" live-objection practice.
    why-weel-wins.json      Optional. USP tiles. Empty array = tile hidden on home screen.
    use-cases.json          Optional. Core use-case tiles. Same rule.
    competitors.json        Optional. Competitor cards. Same rule.
    customers.json          Optional. Named customer wins. Same rule.
scripts/
  validate-content.js  Checks every industry's files against the schema below.
server.js              Zero-dependency local dev server.
```

**The 4 "optional" files are what make an industry look sparse or full.** If
`why-weel-wins.json` is `[]`, the "Why Weel Wins" tile simply doesn't appear on
the home screen for that industry — nothing breaks, there's just less to look
at yet. Fill it in whenever the content exists.

## Adding a new industry (e.g. Hospitality)

1. Create a new folder: `data/hospitality/`
2. Add the 4 required files (`pains.json`, `flashcards.json`, `quiz.json`,
   `scenarios.json`) and however many of the 4 optional ones you have content
   for — see schemas below. Empty arrays `[]` are fine for anything you don't
   have yet.
3. Add one entry to `data/industries.json`:
   ```json
   { "id": "hospitality", "label": "Hospitality", "accent": "#e0a83d", "painNames": ["...", "...", "...", "...", "..."] }
   ```
   `painNames` is a short (1-2 word) label per pain, used on the home screen's
   readiness widget — order must match `pains.json`.

   `accent` is a hex color, unique per industry — it's what makes each
   section visually distinct (buttons, active states, the persistent badge,
   headings all read from this one value, set at runtime). Pick something
   that isn't already used by another industry and has decent contrast
   against a near-black background (roughly luminance-checked against
   `#121212` — anything reasonably bright/saturated works; avoid dark or
   muddy tones since dark text sits on top of it for buttons).
4. Run `npm run validate` — fixes anything malformed before it goes live.
5. Run `npm run dev` and click through it.

That's it. No changes to `index.html` or `app.js` required for a pure content
addition. The industry switcher, the home screen's Vertical Playbook section,
and every practice mode all pick it up automatically from the registry.

### If you want to add a whole new *section* to every industry

Say you want to add a "Live Call Assist" feature to every vertical's page.
That's a real code change, not just content — roughly:

1. Add a new screen `<div id="callassist" class="screen">...</div>` to `index.html`.
2. Add a `go`-function and a `render`-function to `app.js` (copy the pattern used
   by `goWhyWeel()` / `renderCardGrid()` — fetch `data/<id>/call-assist.json`,
   render it, hide the tile if the array is empty).
3. Add `call-assist.json` (even if just `[]`) to each industry folder so nothing
   errors on fetch.
4. Add a tile to `renderVerticalPlaybookSection()` in `app.js` so it shows up
   on the home screen when that industry has data for it.

This is the one piece of genuine "code" work — everything else scales by just
adding JSON files.

## Content schemas

### `pains.json` (required)

Either the **simple** shape (recommended for new industries):

```json
[{ "num": "01", "title": "Pain Title", "summary": "One compiled paragraph, no single-client anecdotes." }]
```

...or the **rich** shape (used by Aged Care today — a fuller narrative per pain):

```json
[{
  "num": "01", "title": "Pain Title", "theySay": "What the prospect says when asked.",
  "story": "A few paragraphs, joined with <br><br>, using <strong>/<em>/<span class='hi'>/<span class='danger'> for emphasis.",
  "phoneQ": "One sharp diagnostic question a rep can ask on a call.",
  "rootCause": "One or two sentences — the underlying truth."
}]
```

Both are rendered correctly — the app checks whether `summary` is present.

### `flashcards.json` (required)

```json
[{ "id": "f1", "pain": 0, "q": "Recall question", "a": "Short, punchy answer." }]
```

`pain` is the zero-based index into that industry's `pains.json`.

### `quiz.json` (required)

Three types, mixed in one array:

```json
{ "id": "q1", "type": "mc", "pain": 0, "q": "...", "options": ["a","b","c","d"], "correct": 1, "explanation": "..." }
{ "id": "fq1", "type": "fitb", "pain": 0, "q": "Fill in the ___________ here.", "blank": "answer", "hint": "...", "explanation": "..." }
{ "id": "sq1", "type": "scenario", "pain": 0, "context": "Prospect says X.", "q": "What do you say?", "options": [...], "correct": 1, "explanation": "..." }
```

`fitb` questions must contain the literal string `___________` as the blank marker.

### `scenarios.json` (required)

```json
[{ "prospect": "An anonymized prospect quote.", "ideal": "The approach to take (2-3 sentences).", "hook": "The actual words a rep would say." }]
```

### `why-weel-wins.json` / `use-cases.json` (optional)

```json
[{ "title": "Short punchy title", "text": "1-2 sentence body. HTML like <strong> is fine." }]
```

### `competitors.json` (optional)

```json
[{
  "name": "Competitor Name",
  "status": "Short status label, e.g. \"Ruled out\"",
  "statusClass": "",
  "when": "When this competitor tends to come up.",
  "angle": "The positioning angle / how to win against them."
}]
```

`statusClass` is `""` (default, green), `"tier"` (blue), or `"uncommon"` (grey) —
just a visual pill colour.

### `customers.json` (optional)

Two supported shapes, detected automatically by whether an entry has `name`:

**Simple** — just a directory of named accounts by industry:

```json
[{ "industry": "GP", "businesses": "GP Collective &middot; Cornerstone Health" }]
```

**Story** — used when real case-study detail exists (e.g. from a sales deck with named challenge/solution/proof-point slides):

```json
[{
  "name": "Customer Name",
  "segment": "Short descriptor, e.g. \"~200 restaurants &middot; national rollout\"",
  "challenge": "What they came to Weel to solve.",
  "solution": "What Weel actually did for them.",
  "proof": "The quantified outcome — dollar figures, rollout numbers, a competitor beaten in evaluation, etc."
}]
```

Don't mix invented detail into either shape — only add a customer once you have
a real source (a case study, an account brief, a signed deal), never as a
stand-in for open pipeline.

## Content pipeline — going from a Gong transcript to a finished industry

This is how the first two industries in this repo were actually built, and
it's the repeatable process for the next one:

1. **Gather evidence.** Export or paste 4-6 real discovery-call transcripts
   for the vertical (Gong is the primary source; HubSpot deal notes/calls are
   a reasonable supplement if Gong isn't handy for a given deal).
2. **Ask Claude Code to read them and extract patterns**, not individual
   anecdotes — the ask that works well is something like: *"Here are N
   transcripts from [vertical]. Identify the 5 biggest, most common pains.
   For each, write one compiled, anonymized summary — no single-client
   specifics, no company names, generalized industry pattern language."*
3. **Ask it to draft the supporting decks** (flashcards/quiz/scenarios) against
   those same 5 pains, in the schemas above.
4. **Ask it to draft `why-weel-wins.json` and `use-cases.json`** the same way —
   compiled, generic value props grounded in what the transcripts actually
   showed demand for.
5. **`competitors.json`** — whatever tools prospects mentioned evaluating,
   rejecting, or already using, positioned honestly (including tools that are
   complementary rather than competitive, like ApprovalMax is for AP).
6. **`customers.json`** — only add named customers here once you have an
   actual source of truth for them: a real customer list, a case-study/sales
   deck with named accounts and account-brief links, or similar. Discovery
   calls with prospects are pipeline evidence, not proof of closed business —
   don't promote a transcript into a customer entry. When richer detail
   exists (challenge/solution/quantified proof, e.g. from a sales deck built
   from Gong account briefs), use the "story" shape documented above instead
   of the plain directory shape — it's a strictly better use of real data
   when you have it.
7. Drop the files in, register the industry, `npm run validate`, done.
8. A source document doesn't have to be a transcript — a PowerPoint, PDF, or
   any other file works the same way: hand it to Claude Code, point it at
   this schema, and ask it to extract and structure the content the same way.

## Known limitations (fast-follow items, not blockers)

- The **Integrations** and **What We Do** screens are still mostly static HTML
  in `index.html` rather than per-industry JSON — a few lines inside
  Integrations (accounting-system "hooks") use the `class="icp-text <id>"`
  pattern and will simply show nothing extra for a brand-new industry until
  someone adds a matching span. Worth migrating to the same JSON-driven
  pattern as everything else once a 3rd or 4th industry needs it.
- There's no build step, bundler, or dependency manager by design — this
  keeps the barrier to Claude Code edits as low as possible. If the tool
  outgrows plain HTML/CSS/JS (e.g. genuinely complex UI state), that's a
  deliberate, separate decision to make later — not something to reach for
  by default.
