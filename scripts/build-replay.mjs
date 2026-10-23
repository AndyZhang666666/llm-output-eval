// Mechanical projection of committed public validation artifacts. No model calls.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const gold = readFileSync('validation/goldset.jsonl', 'utf8').trim().split('\n').map(JSON.parse);
const report = JSON.parse(readFileSync('validation/results/consistency.json', 'utf8'));
const ids = ['e06', 'g07', 'g02', 'g04', 'g06', 'g01'];
const labels = ['病历悬念 · 截断稿', '病历悬念 · 完整稿', '对白太像说明书', '转折缺少铺垫', '动作很多，剧情没前进', '押金争执 · 完整闭环'];
const items = ids.map((id, index) => {
  const sample = gold.find(x => x.id === id);
  const item = report.items.find(x => x.id === id);
  assert.ok(sample && item && item.runs.length === 3);
  const runs = item.runs.map(r => ({ ...r, meta: { ...r.meta, sample: true } }));
  for (const r of runs) assert.equal(r.overall, Math.round(r.dimensions.reduce((s, d) => s + d.score, 0) / 5 * 100) / 100);
  return { id, label: labels[index], text: sample.text, note: sample.note, human: sample.human, runs };
});
assert.ok(items[1].text.startsWith(items[0].text));
mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/replay.json', JSON.stringify({
  source: 'validation/results/consistency.json', goldSource: 'validation/goldset.jsonl',
  model: report.model, recordedAt: report.at, items,
}, null, 2) + '\n');
console.log('PASS: 6 historical samples / 18 recorded runs; no invented scores or new API calls');
