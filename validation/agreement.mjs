/**
 * Check 2 — Agreement with human labels.
 *
 * Uses the mean of the 3 consistency runs as "the model's score" (a single
 * run would mix in the variance already measured by check 1). Reports, per
 * dimension: exact-match rate, within-±1 rate, mean absolute error, and
 * Spearman rank correlation. Then lists the items where the model and the
 * human disagree by 2+ points so the report can show what those look like.
 *
 * Requires results/consistency.json. Output: results/agreement.json
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { here, loadGoldset, saveResult, SCORED_DIMENSIONS, mean, r2 } from "./_shared.mjs";

const cons = JSON.parse(readFileSync(join(here, "results/consistency.json"), "utf8"));
const gold = Object.fromEntries(loadGoldset().map((g) => [g.id, g]));

function spearman(x, y) {
  const rank = (a) => {
    const sorted = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(a.length);
    for (let i = 0; i < sorted.length; ) {
      let j = i;
      while (j + 1 < sorted.length && sorted[j + 1][0] === sorted[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[sorted[k][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(x), ry = rank(y);
  const mx = mean(rx), my = mean(ry);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < x.length; i++) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}

// Guard: an item whose runs all failed carries `mean: null`. Left alone it
// would be counted as a real score — `Math.abs(null - 5)` is 5, so it would
// land in the 2+ disagreement list and drag MAE up, and Spearman would rank
// null as a value. The report would still look plausible. Stop instead.
const missing = [];
for (const it of cons.items) {
  for (const d of SCORED_DIMENSIONS) {
    if (typeof it.dims[d]?.mean !== "number") missing.push(`${it.id}.${d}`);
  }
}
if (missing.length) {
  throw new Error(
    `consistency.json has no model score for: ${missing.join(", ")}. ` +
      `Fix the failing items and re-run check 1 — agreement cannot be computed on partial data.`,
  );
}

const perDim = {};
const disagreements = [];
for (const d of SCORED_DIMENSIONS) {
  const pairs = cons.items.map((it) => ({
    id: it.id,
    edge_case: it.edge_case,
    model: it.dims[d].mean,
    human: gold[it.id].human[d],
  }));
  const errs = pairs.map((p) => Math.abs(p.model - p.human));
  perDim[d] = {
    exact: r2(pairs.filter((p) => Math.round(p.model) === p.human).length / pairs.length),
    within_1: r2(errs.filter((e) => e <= 1).length / pairs.length),
    mae: r2(mean(errs)),
    spearman: r2(spearman(pairs.map((p) => p.model), pairs.map((p) => p.human))),
    model_mean: r2(mean(pairs.map((p) => p.model))),
    human_mean: r2(mean(pairs.map((p) => p.human))),
  };
  for (const p of pairs) {
    if (Math.abs(p.model - p.human) >= 2) {
      disagreements.push({ ...p, dimension: d, delta: r2(p.model - p.human), note: gold[p.id].note });
    }
  }
}

// Overall (mean of 5) agreement.
const overallPairs = cons.items.map((it) => ({
  model: mean(SCORED_DIMENSIONS.map((d) => it.dims[d].mean)),
  human: mean(SCORED_DIMENSIONS.map((d) => gold[it.id].human[d])),
}));
const overall = {
  mae: r2(mean(overallPairs.map((p) => Math.abs(p.model - p.human)))),
  spearman: r2(spearman(overallPairs.map((p) => p.model), overallPairs.map((p) => p.human))),
};

// Edge-case behaviour: did the judge give the "expected" low scores?
const edge = cons.items
  .filter((it) => it.edge_case)
  .map((it) => ({
    id: it.id,
    edge_case: it.edge_case,
    model: Object.fromEntries(SCORED_DIMENSIONS.map((d) => [d, it.dims[d].mean])),
    human: gold[it.id].human,
  }));

console.log("per-dimension agreement (model = mean of 3 runs):");
for (const d of SCORED_DIMENSIONS) console.log(`  ${d.padEnd(10)}`, perDim[d]);
console.log("overall:", overall);
console.log(`\n${disagreements.length} dimension-level disagreements of 2+ points:`);
for (const x of disagreements.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)))
  console.log(`  ${x.id} ${x.dimension.padEnd(10)} model=${x.model} human=${x.human} (${x.delta > 0 ? "+" : ""}${x.delta})`);
console.log("\nedge cases:");
for (const e of edge) console.log(`  ${e.id} ${e.edge_case.padEnd(16)}`, e.model);

saveResult("agreement.json", { model: cons.model, at: new Date().toISOString(), per_dimension: perDim, overall, disagreements, edge_cases: edge });
