# llm-output-eval

A small, opinionated evaluation harness for long-form generated text — the kind
of output a short-drama or novel-generation product produces. Paste a script,
get five dimension scores with **verbatim evidence sentences**, a categorical
safety flag, and a bad-case list you can export.

The point is not "an LLM can score text". It is that **a judge is a measuring
instrument, and an uncalibrated instrument produces confident nonsense.** So
this repo also contains the calibration work: a 30-item hand-labelled goldset
and three checks that measure how much the judge can be trusted.

---

## What it does

| Page | What you get |
|---|---|
| **Evaluate** | One text → 5 dimension scores (1–5), a per-dimension comment, the sentence(s) behind each score, and a safety category |
| **Compare** | Two versions → each scored independently *N* times, mean ± range per dimension, and a Δ that is only called "better/worse" when the ranges don't overlap |
| **Bad Cases** | Every dimension that scored ≤ 2 across real runs, filterable by dimension and source, exportable to CSV |

### The five dimensions

Scores are anchored behaviourally — each level describes *what a 2 looks like*
versus *what a 4 looks like*, rather than "bad → good".

| Dimension | 1 means | 5 means |
|---|---|---|
| **人设一致性 / persona** | Characters are interchangeable or self-contradicting | Every line is recognisably that character's |
| **剧情连贯性 / coherence** | No reconstructable causal chain | Every turn is earned by prior setup |
| **节奏与钩子密度 / pacing** | Mostly filler | Hooks land at a regular cadence |
| **对白自然度 / dialogue** | Narration in quotation marks | Subtext does the work |
| **结构完整性 / structure** | Stops mid-thought | Ending recontextualises the beginning |

**Safety is not scored.** "3/5 safe" is meaningless; the only useful output is
*does a human need to look at this*. It emits a category plus a `needs_review`
flag.

Why five and not ten: every extra dimension costs tokens, adds variance, and
makes the result harder for a writer to act on. Five covers the failure modes
that actually recur in script review.

---

## Why verbatim evidence

The judge is required to quote the input. Quotes are checked against the source
and **silently dropped if paraphrased** — see `src/lib/judge.ts`. The check
normalises curly quotes and full-width punctuation first, because judges swap
them constantly and treating that as a paraphrase threw away real evidence
early on (see git history).

This turns a score from an opinion into something falsifiable. If a dimension
says `2` with no surviving evidence, you know the judge asserted without
grounding, which is a different problem from disagreeing with the score.

---

## Judge calibration

`validation/` holds the calibration harness. It imports the **same prompt and
the same parser** as the app (via `npm run validate:build`) — otherwise the
report would describe a judge nobody uses.

Three checks, all against a 30-item goldset with author-assigned labels
(24 ordinary items, 6 edge cases: empty, garbled, off-topic, persona collapse,
overlong, truncated):

1. **Consistency** — the same text, same prompt, `temperature: 0`, three runs.
   How far do the scores move?
2. **Agreement** — model mean-of-3 vs hand labels: exact-match rate, within-±1,
   MAE, and Spearman ρ per dimension.
3. **Position bias** — 10 contrasting pairs shown in both orders, plus 4
   identical-text controls where any non-tie is pure bias.

**Results, methodology, and the failures are in
[`validation/judge-validation.md`](validation/judge-validation.md).** The
headline: `temperature: 0` does *not* mean deterministic, and the judge hedges
when the order swaps rather than flipping outright.

> The numbers only hold for the prompt that produced them. Edit
> `src/lib/prompts.ts` and you must re-run `npm run validate`.

---

## How to run it

```bash
npm install
npm run dev          # http://localhost:3000
```

No environment variables needed. Bring your own key: click **设置 API Key** in
the header, paste any OpenAI-compatible key. It is stored in
`localStorage` and forwarded through `/api/evaluate` — there is no server-side
fallback key, so a deployed instance cannot burn the author's quota.

Presets are included for OpenAI, DeepSeek, Moonshot, Zhipu and Gemini; any
OpenAI-compatible endpoint works.

### Running the calibration

```bash
cp .env.example .env      # LLM_BASE_URL / LLM_API_KEY / JUDGE_MODEL
npm run validate          # build + all three checks, ~5 min
```

Useful while iterating:

```bash
npm run validate:build
node validation/spot.mjs g17           # 3 runs on one item, scores only
node validation/probe-raw.mjs g17 5    # raw finish_reason/usage — for parse failures
```

`spot.mjs` tells you *that* a response failed; `probe-raw.mjs` tells you *why*.
That distinction is how a silent truncation was found (the old
`max_tokens: 2048` cut Chinese-language verdicts mid-JSON, which then showed up
as unparseable output rather than as an obvious budget error).

See [`DEPLOY.md`](DEPLOY.md) for Vercel.

---

## Layout

```
src/
  app/
    page.tsx               Evaluate — single text
    compare/page.tsx       Compare — two versions, N runs each
    bad-cases/page.tsx     Bad Cases — filter + CSV export
    api/evaluate/route.ts  Proxy; holds the visitor's key for one request
  lib/
    dimensions.ts          The 5 dimensions + safety, with 1–5 anchors
    prompts.ts             Judge prompt — single source of truth for app AND validation
    judge.ts               Defensive parser; verbatim check; truncation detection
    badcases.ts            localStorage collection + CSV
    stats.ts               mean / min / max / population SD
validation/
  goldset.jsonl            30 labelled items
  consistency.mjs          Check 1
  agreement.mjs            Check 2
  position-bias.mjs        Check 3
  spot.mjs / probe-raw.mjs Debugging helpers
  judge-validation.md      The report
```

---

## Limitations

- **Single author's labels.** The goldset is ~30 items labelled by one person.
  It is enough to catch systematic problems (the judge is lenient on off-topic
  input; pacing is noisier than the rest) and not enough to claim a population
  accuracy figure.
- **No inter-annotator agreement.** With one labeller there is no way to say
  how much of the "disagreement" is the judge and how much is one person's
  taste.
- **Chinese and English only**, and Chinese-heavy items are the more demanding
  case because verbatim quotes are costlier in tokens.
- **The compare page does not use pairwise prompting**, deliberately: pairing is
  exposed to position bias (measured above). It scores each side independently
  so the numbers stay comparable across more than two versions.
