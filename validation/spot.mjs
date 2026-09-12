import { loadGoldset, judge, scoreOf, SCORED_DIMENSIONS } from "./_shared.mjs";
const gold = loadGoldset();
const ids = process.argv.slice(2);
for (const id of ids) {
  const item = gold.find((g) => g.id === id);
  const runs = [];
  for (let i = 0; i < 3; i++) runs.push(await judge(item.text));
  console.log(id, SCORED_DIMENSIONS.map((d) => `${d.slice(0, 4)}=${runs.map((r) => scoreOf(r, d)).join("/")}`).join(" "));
}
