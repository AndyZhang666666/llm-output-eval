/**
 * Diagnostic: print the raw response metadata for one goldset item.
 *
 * `spot.mjs` parses the judge output, so when parsing fails it only tells you
 * *that* the response was bad, not *why*. This one bypasses the parser and
 * shows finish_reason / usage / the tail of the content, which is how you tell
 * a truncated completion from a malformed one.
 *
 * Usage: node validation/probe-raw.mjs g17 [runs]
 */
import { loadGoldset, BASE_URL, API_KEY, MODEL, JUDGE_MAX_TOKENS } from "./_shared.mjs";
import { JUDGE_SYSTEM_PROMPT, buildJudgeUserPrompt } from "./_shared.mjs";

const [id, runsArg] = process.argv.slice(2);
const runs = Number(runsArg ?? 1);
const item = loadGoldset().find((g) => g.id === id);
if (!item) {
  console.error(`no goldset item with id=${id}`);
  process.exit(1);
}

for (let i = 0; i < runs; i++) {
  const r = await fetch(`${BASE_URL.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      max_tokens: JUDGE_MAX_TOKENS,
      messages: [
        { role: "system", content: JUDGE_SYSTEM_PROMPT },
        { role: "user", content: buildJudgeUserPrompt(item.text) },
      ],
    }),
  });
  const d = await r.json();
  const ch = d.choices?.[0];
  const content = ch?.message?.content ?? "";
  console.log(
    `run ${i + 1}: http=${r.status} finish=${ch?.finish_reason} len=${content.length} ` +
      `completion_tokens=${d.usage?.completion_tokens} json_parses=${(() => { try { JSON.parse(content); return true; } catch { return false; } })()}`,
  );
  console.log(`  tail: ${JSON.stringify(content.slice(-120))}`);
}
