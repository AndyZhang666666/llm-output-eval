/**
 * Check 1 — Consistency.
 *
 * Same text, same prompt, temperature 0, three runs. How much do the scores
 * move? Reports per-dimension spread across the whole goldset and picks out
 * the dimension with the highest variance.
 *
 * Output: results/consistency.json
 */
import { loadGoldset, judge, pool, scoreOf, saveResult, SCORED_DIMENSIONS, mean, sd, r2, MODEL } from "./_shared.mjs";

const RUNS = 3;
const gold = loadGoldset();
console.log(`consistency: ${gold.length} items × ${RUNS} runs, model=${MODEL}`);

const per = await pool(gold, 3, async (item) => {
  const runs = [];
  const failures = [];
  for (let i = 0; i < RUNS; i++) {
    try {
      runs.push(await judge(item.text));
    } catch (e) {
      failures.push(e);
      const kind = e?.name === "JudgeTruncatedError" ? "TRUNCATED" : "failed";
      console.error(`  ${item.id} run ${i + 1} ${kind}: ${e.message}`);
    }
  }
  // A partial item would silently poison every aggregate below (null means,
  // NaN SDs) and the report would look plausible. Refuse to continue instead.
  if (runs.length < RUNS) {
    const truncated = failures.filter((e) => e?.name === "JudgeTruncatedError").length;
    throw new Error(
      `${item.id}: only ${runs.length}/${RUNS} runs succeeded ` +
        `(${truncated} truncated by the response budget, ${failures.length - truncated} other). ` +
        `Re-run once the cause is fixed.`,
    );
  }
  const dims = {};
  for (const d of SCORED_DIMENSIONS) {
    const s = runs.map((r) => scoreOf(r, d));
    dims[d] = { runs: s, mean: r2(mean(s)), range: Math.max(...s) - Math.min(...s), sd: r2(sd(s)) };
  }
  const line = SCORED_DIMENSIONS.map((d) => `${d.slice(0, 4)}=${dims[d].runs.join("/")}`).join(" ");
  console.log(`  ${item.id.padEnd(4)} ${line}`);
  return { id: item.id, edge_case: item.edge_case, dims, runs };
});

// Aggregate per dimension.
const summary = {};
for (const d of SCORED_DIMENSIONS) {
  const ranges = per.map((p) => p.dims[d].range);
  const sds = per.map((p) => p.dims[d].sd);
  summary[d] = {
    mean_range: r2(mean(ranges)),
    mean_sd: r2(mean(sds)),
    items_with_any_change: ranges.filter((x) => x > 0).length,
    items_with_range_ge_2: ranges.filter((x) => x >= 2).length,
    max_range: Math.max(...ranges),
  };
}
const worst = SCORED_DIMENSIONS.slice().sort((a, b) => summary[b].mean_sd - summary[a].mean_sd)[0];
const stableItems = per.filter((p) => SCORED_DIMENSIONS.every((d) => p.dims[d].range === 0)).length;

console.log("\nper-dimension:");
for (const d of SCORED_DIMENSIONS) console.log(`  ${d.padEnd(10)}`, summary[d]);
console.log(`\nfully stable items (all 5 dims identical across ${RUNS} runs): ${stableItems}/${gold.length}`);
console.log(`highest-variance dimension: ${worst}`);

saveResult("consistency.json", {
  model: MODEL,
  runs: RUNS,
  at: new Date().toISOString(),
  summary,
  highest_variance_dimension: worst,
  fully_stable_items: stableItems,
  items: per,
});
