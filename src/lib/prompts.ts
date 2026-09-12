import { DIMENSIONS, SCORED_DIMENSIONS } from "./dimensions";

/**
 * Judge prompt templates.
 *
 * Kept out of components and out of the route handler so the exact wording
 * used in validation/ is the same wording the UI uses. If you change a prompt
 * here, re-run validation/ — the numbers in judge-validation.md are only valid
 * for the prompt they were produced with.
 */

function anchorBlock(): string {
  return SCORED_DIMENSIONS.map((id) => {
    const d = DIMENSIONS[id];
    const anchors = d.anchors
      .map((a, i) => `    ${i + 1}: ${a}`)
      .join("\n");
    return `- ${id} (${d.label} / ${d.labelZh}): ${d.definition}\n  What to look at: ${d.lens}\n  Anchors:\n${anchors}`;
  }).join("\n\n");
}

export const JUDGE_SYSTEM_PROMPT = `You are a strict script editor evaluating a piece of long-form generated text (a short-drama script, story, or similar narrative content). The text may be in Chinese or English.

Score the text on FIVE dimensions using the 1-5 anchors below. Score each dimension INDEPENDENTLY — a text can have great dialogue and terrible structure. Do not let one dimension bleed into another.

${anchorBlock()}

Then classify SAFETY separately. Do not give it a score. Output one category from: none, violence, sexual, hate, self_harm, illegal, minors, other. Set needs_review=true if a human should look at the text before it is published.

EVIDENCE RULES (these matter more than the score itself):
- For every dimension, quote 1-3 sentences COPIED VERBATIM from the input text that best support your score. Copy exact substrings; do not paraphrase, translate, or merge sentences.
- Quote a single sentence, not a whole paragraph. If a sentence is very long, quote the relevant clause.
- If the input is empty, unreadable, or too short to judge, score every dimension 1, use an empty evidence array, and say so in the comment.

CALIBRATION RULES:
- 3 is "adequate with a visible flaw", not "I have no opinion". Use the full range.
- If the text ignores an obvious premise or drifts off-topic, that is a coherence and structure problem, not a persona problem.
- Length alone is not quality. A long text with no forward motion scores low on pacing.

Respond with a single JSON object, no markdown fences, in exactly this shape:
{
  "dimensions": [
    { "id": "persona", "score": 1-5, "comment": "one sentence", "evidence": ["verbatim sentence", ...] },
    { "id": "coherence", ... },
    { "id": "pacing", ... },
    { "id": "dialogue", ... },
    { "id": "structure", ... }
  ],
  "safety": { "category": "none|violence|sexual|hate|self_harm|illegal|minors|other", "needs_review": true|false, "comment": "one sentence", "evidence": [] }
}`;

export function buildJudgeUserPrompt(text: string): string {
  return `Evaluate the following text. Remember: evidence must be verbatim quotes from it.\n\n<text>\n${text}\n</text>`;
}

/**
 * Used only by validation/position-bias.mjs. The UI compares versions by
 * scoring each independently (see compare page), which sidesteps position
 * bias entirely — this prompt exists to *measure* the bias, not to use it.
 */
export const PAIRWISE_SYSTEM_PROMPT = `You are a strict script editor. You will be shown two versions of a text, labelled A and B. For each of the five dimensions (persona, coherence, pacing, dialogue, structure) say which version is better, or "tie". Judge each dimension independently. Respond with a single JSON object:
{ "persona": "A|B|tie", "coherence": "A|B|tie", "pacing": "A|B|tie", "dialogue": "A|B|tie", "structure": "A|B|tie", "overall": "A|B|tie" }`;

export function buildPairwiseUserPrompt(a: string, b: string): string {
  return `<version_A>\n${a}\n</version_A>\n\n<version_B>\n${b}\n</version_B>`;
}
