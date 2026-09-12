# Judge validation report

**Judge:** `gemini-2.5-flash`, temperature 0, `response_format: json_object`, via an OpenAI-compatible relay
**Prompt:** `src/lib/prompts.ts` at commit `eb8a113` — any change to the prompt invalidates these numbers
**Goldset:** `goldset.jsonl`, 30 items, 6 edge cases (20%)
**Run date:** 2026-09-12
**Raw data:** `results/consistency.json`, `results/agreement.json`, `results/position-bias.json` — every number below is read from those files.

> **Human scores are the author's own judgement, single annotator, not a team.**
> "Agreement with humans" here means "agreement with one person who also wrote the rubric". That inflates agreement relative to an independent annotator. The numbers are useful for spotting *where* the judge diverges, less so as an absolute quality claim.

---

## Summary

| Check | Result |
|---|---|
| Consistency | 8/30 items scored identically across 3 runs; pacing is the noisiest dimension (mean SD 0.25) |
| Agreement | Overall MAE 0.26, Spearman ρ 0.93; exact-score match 57–73% per dimension |
| Position bias | 0/10 pairs flipped, 0/24 identical-text controls broke tie; 4/10 pairs hedge when the better text is second |

Two defects were found and fixed during this run — a **response truncation** that silently dropped items, and **null scores poisoning the aggregates**. Both are described below, because the version of this report they affected looked plausible.

---

## Check 1 — Consistency (same text, 3 runs)

Question: at temperature 0, how much do scores move between runs of the identical prompt?

| Dimension | Mean SD | Mean range | Items with any change | Items with range ≥ 2 | Max range |
|---|---|---|---|---|---|
| persona | 0.09 | 0.20 | 5 / 30 | 1 | 2 |
| coherence | 0.22 | 0.47 | 12 / 30 | 1 | 3 |
| **pacing** | **0.25** | **0.53** | **15 / 30** | 1 | 2 |
| dialogue | 0.13 | 0.27 | 7 / 30 | 1 | 2 |
| structure | 0.15 | 0.33 | 9 / 30 | 1 | 2 |

Fully stable items (all five dimensions identical across 3 runs): **8 / 30**.

**`temperature: 0` is not deterministic.** 22 of 30 items moved on at least one dimension. Most movement is ±1; five item-dimension pairs moved by 2 or more.

**Pacing is the highest-variance dimension**, and by a clear margin (SD 0.25 vs persona's 0.09). The rubric asks "how much of the text earns its place" — a judgement about *proportion* with no hard anchor in the text, unlike a contradiction (coherence) or an out-of-character line (persona) which can be pointed at directly. The judge's pacing evidence is also the weakest in the run: it tends to quote the *good* sentences rather than the dead stretches.

### The range-2 cases (5)

| Item | Dimension | Runs | What happened |
|---|---|---|---|
| `g18` | coherence | **4 / 1 / 4** | Run 2 applied the non-narrative rule; runs 1 and 3 did not — see below |
| `g22` | structure | 3 / 2 / 4 | All three runs agreed the setup is abandoned; they differed on how much that costs |
| `g13` | persona | 1 / 1 / 3 | A text with no characterisation; two runs said "absent = failed", one said "minimal" |
| `g02` | pacing | 3 / 4 / 2 | Genuine mid-scale indecision — the text is competent but inert |
| `g07` | dialogue | 2 / 4 / 4 | One run read the lines as expository, two as natural |

**`g18` is the interesting one, and it is a defect I introduced.** The text is a flat diary — "woke up, brushed teeth, went to the supermarket, bought milk, came home, watched the news". To fix a separate failure (`e03`, an air-purifier manual) I added this rule:

> NON-NARRATIVE INPUT = ALL 1. If the input is not narrative fiction (an instruction manual, an essay, a product description, a list, a news article), score every dimension 1 and say in each comment that the input is not a story.

Run 2 read the diary as "a list of disconnected daily activities" and gave coherence 1. Runs 1 and 3 read it as a narrative and gave 4. **The rule fixed `e03` completely but made `g18` less stable**, because *"is this narrative fiction?"* is itself a judgement call, and the rule does not say what to do with something that half-qualifies. It also does not constrain *consistency of application* — a run that invokes the rule should apply it to all five dimensions, and run 2 only applied it to one.

This is a real trade-off, not a bug to be papered over: making the judge stricter about off-topic input necessarily adds a decision boundary, and decision boundaries are where variance lives. The net effect is still an improvement (see *Effect of the prompt change*), but a future revision should say explicitly that the rule is all-or-nothing per item.

## Check 2 — Agreement with human labels

Model score = mean of the 3 consistency runs, so check 1's variance is already averaged in.

| Dimension | Exact match | Within ±1 | MAE | Spearman ρ | Model mean | Human mean |
|---|---|---|---|---|---|---|
| persona | 0.57 | 0.90 | 0.49 | 0.86 | 2.76 | 3.00 |
| coherence | 0.60 | 0.97 | 0.47 | 0.90 | 3.05 | 3.33 |
| pacing | 0.57 | 0.97 | 0.48 | 0.91 | 3.07 | 3.10 |
| dialogue | 0.70 | 0.97 | 0.37 | 0.89 | 2.56 | 2.77 |
| structure | 0.73 | 1.00 | 0.29 | 0.93 | 2.91 | 2.80 |
| **overall (mean of 5)** | — | — | **0.26** | **0.93** | | |

**Ranking agreement is high (ρ 0.86–0.93); exact-score agreement is not (57–73%).** The judge orders texts the way I do. It does not reliably land on the same integer — fine for "is V2 better than V1", not fine for "this text is a 4".

**A consistent slight harshness.** The model mean sits below the human mean on four of five dimensions (−0.24 persona, −0.28 coherence, −0.21 dialogue, −0.03 pacing), and above on structure (+0.11). The gap is small but it is in the same direction each time, which makes it systematic rather than noise.

### Where they disagree by 2+ points (3 cases)

All three are the judge saying **1** where I said **3** — the judge at its harshest. They are not equally defensible.

**`g09` — dialogue: judge 1, me 3. The judge is right and my label is wrong.**
The text is event-driven with indirect speech only ("物业说…", "老板说…") and no quoted lines. My own new rule says an absent dimension scores 1. The judge cited exactly that and gave 1 in all three runs. My 3 was written before the rule existed and contradicts it. **The label should be 1.**

**`g06` and `g20` — persona: judge 1, me 3. The score is arguable; the judge's stated reason is false.**
`g06` has a named protagonist (苏婷) who enters, works, and fetches water. `g20` has a named protagonist (顾言) who investigates his father's death, then gives up. Yet the judge's comments say:

> "The input is a descriptive scene without identifiable characters" (`g06`)

> "The text lacks identifiable characters with distinct traits" (`g20`)

Both statements are factually wrong — a named character who acts is exactly an identifiable character. The score of 1 comes from the *absence of characterisation* (nothing distinguishes these people from anyone else), which is a reasonable reading of anchor 1 — but the judge reached it by asserting something untrue about the text rather than by saying "there is a character, and they have no traits". **A score can be right while its justification is wrong, and that distinction matters when you are reading the comment to decide what to fix.**

`g06` and `g20` are also where my labels are softest: both texts have a protagonist with essentially *zero* distinguishing traits, and the rubric's anchors 1 and 2 both describe traits that exist and are then violated. Neither anchor covers "no traits at all". A generous 3 is defensible; so is 1. I am leaving both labels at 3 so the numbers stay reproducible, but I would not defend 3 against a reviewer.

### Sensitivity: if all three labels were made rule-consistent

Setting `g06.persona`, `g20.persona` and `g09.dialogue` to 1 — i.e. conceding all three to the judge:

| Dimension | MAE | ρ | Exact |
|---|---|---|---|
| persona | 0.49 → **0.36** | 0.86 → **0.92** | 0.57 → 0.63 |
| dialogue | 0.37 → **0.30** | 0.89 → **0.92** | 0.70 → 0.73 |
| overall | 0.26 → **0.24** | 0.93 → **0.96** | — |

Three label decisions out of 150 cells move overall ρ by 0.03. That is the honest error bar on this table: with thirty items and one annotator, the top-line numbers are soft at roughly this scale. It is a reason to read the *per-case* findings rather than treating ρ as precise.

### Edge-case behaviour

| Case | What was tested | Result |
|---|---|---|
| `e01` empty | Does it invent an evaluation? | All 1s, all 3 runs. Comments say the text is empty. ✅ |
| `e02` garbled | Does it find meaning in noise? | All 1s, all 3 runs. ✅ |
| `e03` off-topic (air-purifier manual) | Does it notice it's not a script? | All 1s, all 3 runs. ✅ **Fixed by the new rule** — previously 4.33 coherence / 3.33 pacing / 3.33 structure |
| `e04` persona collapse | Does persona catch a mid-text personality break? | Persona **1** (all runs), coherence **1** (all runs). ✅ Isolated to the right dimensions |
| `e05` overlong (2.5k chars, repeated filler) | Does a good opening bias the whole score? | Pacing **1** (all runs), coherence 2. ✅ Not fooled by the opening |
| `e06` truncated mid-sentence | Does structure drop vs. the intact sibling? | Structure **2.0** vs `g07`'s **3.67**, identical across all runs. ✅ The largest drop of any dimension |

`e06` is a strict prefix of `g07` — the same text with the last clause cut off mid-word. Dropping the ending moves structure by −1.67 (human expectation: −2) and pacing by −1.33, while persona, coherence and dialogue each move by less than −1. The dimension that should collapse is the one that does, and it does so with zero run-to-run variance. That is the tool doing precisely what it claims.

## Check 3 — Position bias (A/B order swap)

Setup: 10 pairs of a clearly-better and a clearly-worse text (human overall gap 1.6–3.0). Each pair judged twice, once with the better text as A and once as B. Plus 4 controls where A and B are the identical text.

| | Result |
|---|---|
| Identical-text controls | **0 / 24** non-tie judgements — the judge never invented a preference between a text and itself |
| Pairs that *flipped* with order | **0 / 10** — it never said "A is better" then "B is better" for the same two texts |
| Pairs consistent across both orders | **6 / 10** |
| Pairs correct in both orders | **6 / 10** |
| Slot picks across all 120 dimension-level judgements | **A = 60, B = 36**, tie = 24 |

**There is no "second position wins" bias. What there is: when the better text is in slot B, the judge sometimes refuses to choose.** Every one of the four inconsistent pairs committed to "better" in the forward order and returned an unbroken all-dimension **tie** in the reversed order:

| Pair | Human gap | Forward | Reversed |
|---|---|---|---|
| `g05` vs `g04` | 2.6 | better | **tie (all dims)** |
| `g19` vs `g08` | 2.4 | better | **tie (all dims)** |
| `g21` vs `g02` | 2.2 | better | **tie (all dims)** |
| `g22` vs `g06` | 1.6 | better | **tie (all dims)** |

The asymmetry is about *confidence*, not *preference*: the judge commits when the good text comes first and hedges when it comes second. The ties are also suspiciously total — all six dimensions collapsing to tie at once looks more like the model declining the task than like six independent judgements landing on "equal".

**Gap size does not explain it.** It is tempting to say "closer pairs hedge more", but the data does not support that cleanly: `g03`/`g20` (gap 1.8) committed in both orders, while `g21`/`g02` (gap 2.2) tied, and `g11`/`g23` (gap 2.4) committed while `g19`/`g08` (gap 2.4) tied. Ten pairs is too few to separate "gap size" from "which specific texts these are". What can be said is directional: **all four hedges are in the reversed order and none are in the forward order**, which is a real asymmetry and not something thirty judgements would produce by chance.

**What this means for the tool:** the compare page does **not** use pairwise prompting. Each version is scored independently, N times, and the aggregates are compared — which sidesteps this entirely. The pairwise prompt exists in `prompts.ts` only so this check can be re-run.

---

## Defects found and fixed during this run

These are the reason the report exists alongside the app. Both produced output that looked fine.

### 1. Response truncation silently dropped items

`max_tokens` was **2048**. A verdict is five dimensions each carrying a comment plus up to three verbatim quotes, and quotes are copied in the source language — so a Chinese item costs far more tokens than its character count suggests. Per-item token usage landed at **1800–2200**, right on the ceiling.

On goldset `g17` the provider hit the limit mid-JSON on *every* run (`finish_reason: "length"`, ~2040 completion tokens), returning a half-written object. Downstream, this surfaced as a generic parse error and was counted as a failed run — so `g17` contributed **null** scores to every aggregate while the report still looked plausible.

Fixed in commit `47f16ca`:
- `JUDGE_MAX_TOKENS = 8192`, defined once in `judge.ts` and shared by the app and `validation/` so they cannot drift apart.
- `parseJudgeOutput` distinguishes **truncation** from **malformation**, using `finish_reason` plus a brace/string balance scan for relays that omit it. The route handler no longer retries truncation (deterministic for a given input and budget, so the retry only doubled the visitor's wait).
- `validation/probe-raw.mjs` dumps `finish_reason`/usage/response tail for one item. `spot.mjs` only reports *that* parsing failed; this reports *why*, which is how the truncation was pinned down.

### 2. Null scores poisoned the aggregates

Even after truncation was possible to detect, `consistency.mjs` and `agreement.mjs` would happily compute over `null`: `Math.abs(null - 5)` is `5`, so a missing score was being counted as a five-point disagreement, dragging MAE up and corrupting every SD. One item with three failed runs was enough to push `highest_variance_dimension` to the wrong answer.

Fixed in the same commit: both scripts now **fail fast** and name the offending item rather than producing a report that is quietly wrong. A partial result is never silently averaged.

> **Note on the intermediate run.** While the truncation was still present, this report showed overall ρ 0.79 and MAE 0.45 — worse than the pre-prompt-change baseline. That comparison was an artefact: five of the eight recorded "disagreements" were `g17`'s nulls. With the pipeline fixed, the real figures are ρ 0.93 / MAE 0.26. **The lesson is the ordering: fix the measurement instrument before using it to judge a change.**

### Effect of the prompt change

The prompt changed (commit `eb8a113`) to add the absent-dimension and non-narrative rules. Comparing like for like, clean against clean:

| | Before (`2a1a7b5`) | After (`eb8a113`) |
|---|---|---|
| Overall MAE | 0.34 | **0.26** |
| Overall ρ | 0.90 | **0.93** |
| Fully stable items | 7 / 30 | **8 / 30** |
| 2+ point disagreements | 4 | **3** |
| `e03` (off-topic) coherence | 4.33 | **1.00** |

The rules fixed the failure they targeted — `e03` went from 4.33 to 1.0 on coherence — and improved every top-line number, at the cost of the `g18` instability described above. Net positive, with a known price.

**Still open:** my own labels for `g09` (dialogue), `g06` and `g20` (persona) contradict the rule I wrote. I have not edited them, so the table above stays reproducible. Rectifying them would improve the numbers, which is exactly why I have not done it quietly.

## What this does not tell you

- **One judge model.** Everything here is `gemini-2.5-flash`. A different model will have different variance and different blind spots. The scripts take `JUDGE_MODEL` from env; nothing else changes.
- **One annotator who also wrote the rubric.** See the note at the top, and the sensitivity table above for how far three label decisions move the headline figures.
- **30 items, short Chinese narrative, mostly under 300 chars** (except `e05`, at 2552). Longer texts and other genres are untested. Chinese-language items are the more demanding case for a token budget.
- **Ties in check 3 may be a `json_object` artefact** — the relay ignores `json_schema`, and "tie" is the safest string for a model that is unsure. A free-text pairwise prompt might commit more often. Not tested.
- **Single run of each check.** These are point estimates. Re-running would move them.

## Reproduce

```bash
cp .env.example .env     # fill in LLM_BASE_URL, LLM_API_KEY, JUDGE_MODEL
npm run validate         # ~110 judge calls, 3–5 minutes on a fast relay
```

Outputs overwrite `results/*.json`. Diff them against the committed versions to see how a different model or prompt compares.

While iterating on the prompt, do not re-run the full suite every time:

```bash
node validation/spot.mjs e03 g18      # 3 runs on specific items, scores only
node validation/probe-raw.mjs g17 5   # raw finish_reason/usage, for parse failures
```
