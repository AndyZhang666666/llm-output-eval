# Judge validation report

**Judge:** `gemini-2.5-flash`, temperature 0, `response_format: json_object`, via an OpenAI-compatible relay
**Prompt:** `src/lib/prompts.ts` at commit `2a1a7b5` (any change to the prompt invalidates these numbers)
**Goldset:** `goldset.jsonl`, 30 items, 6 edge cases (20%)
**Run date:** 2026-09-12
**Raw data:** `results/consistency.json`, `results/agreement.json`, `results/position-bias.json` — every number below is copied from those files, nothing is rounded by hand.

> **Human scores are the author's own judgement, single annotator, not a team.**
> "Agreement with humans" here means "agreement with one person who also wrote the rubric". That inflates agreement relative to an independent annotator. The numbers are useful for spotting *where* the judge diverges, less so as an absolute quality claim.

---

## Check 1 — Consistency (same text, 3 runs)

Question: at temperature 0, how much do scores move between runs of the identical prompt?

| Dimension | Mean SD | Items with any change | Items with range ≥ 2 | Max range |
|---|---|---|---|---|
| persona | 0.13 | 7 / 30 | 1 | 2 |
| coherence | 0.17 | 10 / 30 | 1 | 2 |
| **pacing** | **0.22** | **13 / 30** | 1 | 2 |
| dialogue | 0.19 | 10 / 30 | 2 | 2 |
| structure | 0.14 | 8 / 30 | 1 | 2 |

Fully stable items (all five dimensions identical across 3 runs): **7 / 30**.

**Temperature 0 is not deterministic.** 23 of 30 items moved on at least one dimension. Most movement is ±1; six item-dimension pairs moved by 2.

**Pacing is the highest-variance dimension.** The rubric asks "how much of the text earns its place", which is a judgement about *proportion* and has no hard anchor in the text — nothing to point at the way a contradiction (coherence) or an out-of-character line (persona) can be pointed at. The judge's evidence for pacing is also the weakest: it tends to quote the *good* sentences rather than the dead stretches.

**The range-2 cases are mostly one specific failure: how to score a dimension that is absent.**

- `g13` dialogue **1 / 3 / 1** — a text with no dialogue. Two runs said "no dialogue, score 1"; one run said "no dialogue" and gave 3. Same observation, different score.
- `e05` dialogue **1 / 1 / 3** — same thing.
- `g18` persona **1 / 3 / 1** — a first-person diary with no characterisation. Two runs scored it as a failure, one as "minimal but not wrong".

The rubric does not say what to do when a dimension does not apply, so the judge alternates between "absent = failed" and "absent = neutral". This is a prompt gap, not model noise, and it is fixable (see *What this changes*).

The other range-2 case is more interesting:

- `g22` coherence **3 / 4 / 2**, structure **5 / 5 / 3** — run 3 found a real geographic contradiction (daughter flies Shanghai→Beijing, mother's note says "I went to Shanghai to find you" — which is where the daughter *left from*, so the mother would have found her had she been there). The other two runs did not notice. **I did not notice it either when I scored it 4.** The judge is inconsistent here because the flaw is subtle, and the run that caught it was right.

## Check 2 — Agreement with human labels

Model score = mean of the 3 consistency runs (so check 1's variance is already averaged in).

| Dimension | Exact match | Within ±1 | MAE | Spearman ρ | Model mean | Human mean |
|---|---|---|---|---|---|---|
| persona | 0.70 | 1.00 | 0.36 | 0.92 | 3.02 | 3.00 |
| coherence | 0.70 | 0.93 | 0.34 | 0.83 | 3.41 | 3.33 |
| pacing | 0.47 | 0.90 | 0.58 | 0.86 | 3.28 | 3.10 |
| dialogue | 0.53 | 1.00 | 0.42 | 0.90 | 2.81 | 2.77 |
| structure | 0.57 | 0.93 | 0.49 | 0.85 | 3.11 | 2.80 |
| **overall (mean of 5)** | — | — | **0.34** | **0.90** | | |

**Ranking agreement is high (ρ 0.83–0.92); exact-score agreement is not (47–70%).** The judge orders texts the way I do. It does not land on the same integer as often — which is fine for "is V2 better than V1" and not fine for "this text is a 4".

**No systematic lean.** Model means sit within 0.3 of human means on every dimension. The one exception is structure (+0.31): the judge is slightly more generous to endings than I am, which shows up in the edge cases below.

### Where they disagree by 2+ points (4 cases, all on 2 items)

**`e03` — off-topic (an air-purifier manual)**
Human: coherence 2, pacing 1, structure 1. Model: **4.33, 3.33, 3.33**.
The judge scored it *as a manual*: internally consistent, no filler, has a beginning and end. I scored it *as a script*: it isn't one. Persona and dialogue both got 1 from the judge, so it did notice something was off — but the prompt never says "if this is not narrative text, everything fails", so three dimensions were graded on the text's own terms. **This is the most important gap found.** A tool that gives an instruction manual a 4.33 on coherence will mislead anyone who pastes the wrong thing.

**`g04` — melodrama with unmotivated turns**
Human pacing 3, model **1**. The judge treated "everything happens with no setup" as a pacing failure (nothing earns its place) as well as a coherence failure. I only docked coherence. Reasonable disagreement; arguably the judge's read is more consistent with the rubric than mine was.

### Edge-case behaviour

| Case | What was tested | Result |
|---|---|---|
| `e01` empty | Does it invent an evaluation? | All 1s, all 3 runs. Comments say the text is empty. ✅ |
| `e02` garbled | Does it find meaning in noise? | All 1s, all 3 runs. ✅ |
| `e03` off-topic | Does it notice it's not a script? | Partially — see above. ❌ |
| `e04` persona collapse | Does the persona dimension catch a mid-text personality break? | Persona **1** (all 3 runs). Other dims 2–3. ✅ Exactly the intended signal. |
| `e05` overlong (2.5k chars, 14× repeated filler) | Does the good opening bias the whole score? | Pacing **1** (all runs), persona 3.33, coherence 2.33. ✅ Not fooled by the opening. |
| `e06` truncated mid-sentence | Does structure drop vs. the intact `g07`? | Structure **2.33** vs g07's **4.0**. Pacing/dialogue stayed close. ✅ Isolated to the right dimension. |

## Check 3 — Position bias (A/B order swap)

Setup: 10 pairs of a clearly-better and a clearly-worse text (human overall gap ≥ 1.6). Each pair judged twice, once with the better text as A, once as B. Plus 4 controls where A and B are the identical text.

| | Result |
|---|---|
| Identical-text controls | **0 / 24** non-tie judgements. The judge never invented a preference between a text and itself. |
| Pairs where the pick *flipped* with order | **0 / 10** — it never said "A is better" then "B is better" for the same two texts. |
| Pairs judged consistently in both orders | **6 / 10** |
| Pairs correct in both orders | **5 / 10** |
| Slot picks across all 120 dimension-level judgements | **A = 54, B = 30**, tie = 36 |

**There is no "second position wins" bias. There is something else: when the better text is in slot B, the judge often refuses to choose.**

Of the 10 pairs, 5 got a full "A better" verdict when the better text was A, then a full "tie" when the better text was moved to B (`g05/g04`, `g19/g08`, `g03/g20`, `g22/g06`, and `g21/g02` tied both ways). Never once did it tie with better-as-A and then pick with better-as-B.

So the asymmetry is not *preference* for a slot, it is *confidence*: the judge commits when the good text comes first and hedges when it comes second. Gap size explains most of it — all three pairs with the largest human gap (3.0) committed in both orders, and the three pairs with the smallest gaps (1.6–2.2) all collapsed to tie in at least one order — but not all of it: `g05/g04` (gap 2.6) tied in reverse while two 2.4-gap pairs did not. Ten pairs is too few to say more than "closer pairs hedge more, and hedging only happens when the better text is second".

**What this means for the tool:** the compare page does **not** use pairwise prompting. Each version is scored independently, N times, and the aggregates are compared. That sidesteps this entirely. The pairwise prompt exists in `prompts.ts` only so this check can be re-run.

---

## What this changes

Things the validation run directly caused or will cause:

1. **Prompt gap — absent dimensions.** Add an explicit rule: "if the text has no dialogue, dialogue = 1; if it has no identifiable characters, persona = 1". This should remove most of the range-2 variance in check 1. Not yet applied, because changing the prompt means re-running everything above.
2. **Prompt gap — non-narrative input.** Add: "if the input is not narrative fiction (a manual, an essay, a list), score every dimension 1 and say so". Fixes `e03`. Same caveat.
3. **My own label was wrong on `g22`.** The judge found a contradiction I missed. Human label for coherence should be 3, not 4. Left as-is in `goldset.jsonl` so the numbers above stay reproducible; noted here.
4. **Pacing should be read with a wider error bar than the others.** The compare page already shows min–max ranges per dimension; the README says which dimension to trust least.

## What this does not tell you

- **One judge model.** Everything here is gemini-2.5-flash. A different model will have different variance and different blind spots. The scripts take `JUDGE_MODEL` from env; nothing else changes.
- **One annotator who also wrote the rubric.** See the note at the top.
- **30 items, all short-drama-style Chinese narrative under 300 chars (except `e05`).** Longer texts and other genres are untested.
- **Ties in check 3 might be a `json_object` artefact** — the relay ignores `json_schema`, and "tie" is the safest string for a model that is unsure. A free-text pairwise prompt might commit more often. Not tested.

## Reproduce

```bash
cp .env.example .env     # fill in LLM_BASE_URL, LLM_API_KEY, JUDGE_MODEL
npm run validate         # ~110 judge calls, 3–5 minutes on a fast relay
```

Outputs overwrite `results/*.json`. Diff them against the committed versions to see how a different model or prompt compares.
