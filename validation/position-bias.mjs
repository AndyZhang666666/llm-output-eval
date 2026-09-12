/**
 * Check 3 — Position bias.
 *
 * Show the judge two texts as A/B, ask which is better per dimension, then
 * swap the order and ask again. If the preference follows the *position*
 * rather than the *text*, the judge is position-biased.
 *
 * Pairs are built from the goldset: each pair has a clearly better and a
 * clearly worse item by human overall score (gap >= 1.5), so a consistent
 * judge should pick the better one regardless of slot. We also include the
 * same text twice (A == B) as a control — any non-tie there is pure bias.
 *
 * Output: results/position-bias.json
 */
import { loadGoldset, pairwise, pool, saveResult, SCORED_DIMENSIONS, mean, r2, MODEL } from "./_shared.mjs";

const gold = loadGoldset().filter((g) => !g.edge_case);
const overall = (g) => mean(SCORED_DIMENSIONS.map((d) => g.human[d]));

// Build ~12 contrasting pairs deterministically: sort by human overall,
// pair top-half with bottom-half.
const sorted = gold.slice().sort((a, b) => overall(b) - overall(a));
const pairs = [];
for (let i = 0; i < 12 && i < Math.floor(sorted.length / 2); i++) {
  const better = sorted[i];
  const worse = sorted[sorted.length - 1 - i];
  if (overall(better) - overall(worse) >= 1.5) pairs.push({ better, worse });
}
// Controls: identical text in both slots.
const controls = sorted.slice(0, 4).map((g) => ({ same: g }));

console.log(`position-bias: ${pairs.length} contrasting pairs × 2 orders + ${controls.length} identical-text controls, model=${MODEL}`);

const pairResults = await pool(pairs, 3, async ({ better, worse }) => {
  const fwd = await pairwise(better.text, worse.text); // better = A
  const rev = await pairwise(worse.text, better.text); // better = B
  const dims = {};
  for (const d of [...SCORED_DIMENSIONS, "overall"]) {
    const pickFwd = fwd[d] === "A" ? "better" : fwd[d] === "B" ? "worse" : "tie";
    // Guard the reversed read on `rev`, not `fwd` — a missing dimension in the
    // reversed call would otherwise be scored off the forward call's answer.
    const pickRev = rev[d] === undefined ? "tie" : rev[d] === "B" ? "better" : rev[d] === "A" ? "worse" : "tie";
    dims[d] = {
      forward: pickFwd,
      reversed: pickRev,
      consistent: pickFwd === pickRev,
      // "Flipped" = the judge switched its pick when we switched the order.
      flipped: pickFwd !== "tie" && pickRev !== "tie" && pickFwd !== pickRev,
      correct_both: pickFwd === "better" && pickRev === "better",
    };
  }
  console.log(
    `  ${better.id} vs ${worse.id}: overall fwd=${dims.overall.forward} rev=${dims.overall.reversed}${dims.overall.flipped ? "  <-- FLIPPED" : ""}`,
  );
  return { better: better.id, worse: worse.id, human_gap: r2(overall(better) - overall(worse)), dims, raw: { fwd, rev } };
});

const controlResults = await pool(controls, 3, async ({ same }) => {
  const res = await pairwise(same.text, same.text);
  const nonTie = Object.entries(res).filter(([, v]) => v !== "tie");
  console.log(`  control ${same.id}: ${nonTie.length === 0 ? "all tie" : nonTie.map(([k, v]) => `${k}=${v}`).join(" ")}`);
  return { id: same.id, raw: res, non_tie_count: nonTie.length, prefers: nonTie.length ? mean(nonTie.map(([, v]) => (v === "A" ? -1 : 1))) : 0 };
});

// Summaries.
const summary = {};
for (const d of [...SCORED_DIMENSIONS, "overall"]) {
  const xs = pairResults.map((p) => p.dims[d]);
  summary[d] = {
    consistent_rate: r2(xs.filter((x) => x.consistent).length / xs.length),
    flipped: xs.filter((x) => x.flipped).length,
    correct_both_rate: r2(xs.filter((x) => x.correct_both).length / xs.length),
  };
}
// Slot preference: across all non-tie picks, how often did the judge pick slot A vs slot B?
let slotA = 0, slotB = 0;
for (const p of pairResults) {
  for (const side of ["fwd", "rev"]) {
    for (const d of [...SCORED_DIMENSIONS, "overall"]) {
      const v = p.raw[side][d];
      if (v === "A") slotA++;
      else if (v === "B") slotB++;
    }
  }
}
const controlNonTie = controlResults.reduce((a, c) => a + c.non_tie_count, 0);

console.log("\nsummary:");
for (const d of [...SCORED_DIMENSIONS, "overall"]) console.log(`  ${d.padEnd(10)}`, summary[d]);
console.log(`slot picks across all judgements: A=${slotA} B=${slotB}`);
console.log(`identical-text controls: ${controlNonTie} non-tie judgements out of ${controls.length * 6}`);

saveResult("position-bias.json", {
  model: MODEL,
  at: new Date().toISOString(),
  pairs: pairResults.length,
  summary,
  slot_picks: { A: slotA, B: slotB },
  controls: { count: controls.length, non_tie_judgements: controlNonTie, items: controlResults },
  items: pairResults,
});
