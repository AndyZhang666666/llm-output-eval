import type { DimensionId, ScoredDimensionId } from "./types";

/**
 * The six dimensions and their 1-5 behavioural anchors.
 *
 * Why anchors instead of "1 = bad, 5 = good": a judge model given only a label
 * drifts toward the middle (3-4) and its scores stop being comparable across
 * texts. Describing what a 2 *looks like* versus what a 4 *looks like* is the
 * single biggest lever on score stability we found while building this.
 *
 * Why five scored dimensions plus one flag, not ten dimensions: every extra
 * dimension costs judge tokens, adds variance, and — more importantly — makes
 * the result harder for a human to act on. Five covers the failure modes that
 * actually came up in script review (character drift, plot holes, dead air,
 * stilted lines, unresolved endings). Safety is categorical because "3/5 safe"
 * means nothing; the only useful output is "does a human need to look at this".
 */
export interface DimensionDef {
  id: DimensionId;
  /** Short label for charts. */
  label: string;
  labelZh: string;
  /** One-line definition shown in the UI. */
  definition: string;
  /** What the judge should be looking at. */
  lens: string;
  /** Behavioural anchors, index 0 = score 1 ... index 4 = score 5. */
  anchors: [string, string, string, string, string];
}

export const SCORED_DIMENSIONS: readonly ScoredDimensionId[] = [
  "persona",
  "coherence",
  "pacing",
  "dialogue",
  "structure",
] as const;

export const DIMENSIONS: Record<DimensionId, DimensionDef> = {
  persona: {
    id: "persona",
    label: "Persona",
    labelZh: "人设一致性",
    definition:
      "Characters speak and act in line with the traits the text has already established for them.",
    lens: "Look for moments where a character breaks role, or where personality flips without an in-story reason.",
    anchors: [
      "Characters are interchangeable or contradict themselves within a few lines; no stable traits can be identified.",
      "Traits are stated but frequently violated; at least one major character behaves inconsistently with no motivation given.",
      "Traits mostly hold, with one or two noticeable slips that a reader would flag as 'out of character'.",
      "Consistent throughout; minor wobbles are plausibly explained by the situation.",
      "Every line is recognisably that character's; reactions under pressure reveal rather than contradict established traits.",
    ],
  },
  coherence: {
    id: "coherence",
    label: "Coherence",
    labelZh: "剧情连贯性",
    definition:
      "Events follow from one another; nothing happens without setup or contradicts what came before.",
    lens: "Look for unmotivated turns, timeline or fact contradictions, and things that happen only because the plot needs them.",
    anchors: [
      "Events are disconnected or contradictory; the reader cannot reconstruct a causal chain.",
      "Several unexplained jumps or contradictions; key turns arrive without setup.",
      "Mostly follows, with one clear plot hole or convenience the reader has to forgive.",
      "Causal chain is clear; any convenience is minor and does not affect the outcome.",
      "Every turn is earned by prior setup; re-reading reveals foreshadowing rather than gaps.",
    ],
  },
  pacing: {
    id: "pacing",
    label: "Pacing",
    labelZh: "节奏与钩子密度",
    definition:
      "How much of the text moves the story forward or creates a reason to keep reading, per unit of length.",
    lens: "Look for long stretches with no new information, and whether each beat either advances the plot or plants a hook.",
    anchors: [
      "Mostly filler; the story could be told in a fraction of the length with nothing lost.",
      "Large dead stretches; hooks are rare and weak.",
      "Adequate movement, but at least one section drags or repeats information.",
      "Steady forward motion; almost every paragraph earns its place.",
      "Tight throughout; hooks land at a regular cadence and dead air is essentially absent.",
    ],
  },
  dialogue: {
    id: "dialogue",
    label: "Dialogue",
    labelZh: "对白自然度",
    definition:
      "Whether lines sound like something a person would actually say in that moment.",
    lens: "Look for bookish or announcer-like phrasing, and for 'functional' lines that exist only to deliver exposition.",
    anchors: [
      "Lines read as narration in quotation marks; characters explain things they both already know.",
      "Frequent stilted or expository lines; voice does not vary between speakers.",
      "Generally natural, with a few lines that are clearly there to move information.",
      "Natural and distinct per speaker; exposition is disguised well.",
      "Lines carry subtext; what is *not* said does as much work as what is.",
    ],
  },
  structure: {
    id: "structure",
    label: "Structure",
    labelZh: "结构完整性",
    definition:
      "The piece has a beginning, development, and an ending that actually closes.",
    lens: "Look for endings that stop rather than conclude, and setups that are never paid off.",
    anchors: [
      "No discernible arc; the text stops mid-thought or never establishes what it is about.",
      "Has a start but no real ending, or a major setup is abandoned.",
      "Complete arc with a rushed or slightly unsatisfying resolution.",
      "Clear arc; ending resolves the main line and most secondary threads.",
      "Ending recontextualises the beginning; every planted element is paid off.",
    ],
  },
  safety: {
    id: "safety",
    label: "Safety",
    labelZh: "安全与合规",
    definition:
      "Whether the text contains content that needs a human to review before publication.",
    lens: "Categorise, don't grade. Output the category and whether human review is needed.",
    // Safety has no 1-5 anchors on purpose; these are placeholders so the type
    // stays uniform and the UI can still render a definition row.
    anchors: ["—", "—", "—", "—", "—"],
  },
};

/** Ordered list for rendering (scored first, safety last). */
export const DIMENSION_ORDER: readonly DimensionId[] = [
  ...SCORED_DIMENSIONS,
  "safety",
];

/** Scores at or below this value land on the Bad Case page. */
export const BAD_CASE_THRESHOLD = 2;
