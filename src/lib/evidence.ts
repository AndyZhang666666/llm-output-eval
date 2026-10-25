const PUNCT: Record<string, string> = {
  "“": '"',
  "”": '"',
  "„": '"',
  "‟": '"',
  "‘": "'",
  "’": "'",
  "‚": "'",
  "‛": "'",
  "，": ",",
  "。": ".",
  "！": "!",
  "？": "?",
  "：": ":",
  "；": ";",
  "（": "(",
  "）": ")",
  "【": "[",
  "】": "]",
  "《": "<",
  "》": ">",
  "—": "-",
  "–": "-",
  "…": "...",
};
function normalized(text: string) {
  let value = "",
    offset = 0;
  const starts: number[] = [],
    ends: number[] = [];
  for (const ch of text) {
    const v = (PUNCT[ch] ?? ch).toLowerCase();
    if (!/\s/.test(ch)) {
      for (let i = 0; i < v.length; i++) {
        value += v[i];
        starts.push(offset);
        ends.push(offset + ch.length);
      }
    }
    offset += ch.length;
  }
  return { value, starts, ends };
}
export function locateEvidence(
  source: string,
  quote: string,
): {
  start: number;
  end: number;
  matches: number;
  method: "exact" | "normalized";
} | null {
  const q = normalized(quote).value;
  if (q.length < 4) return null;
  const s = normalized(source),
    at = s.value.indexOf(q);
  if (at < 0) return null;
  let matches = 0,
    cursor = 0;
  while ((cursor = s.value.indexOf(q, cursor)) !== -1) {
    matches++;
    cursor += q.length;
  }
  const start = s.starts[at],
    end = s.ends[at + q.length - 1];
  return {
    start,
    end,
    matches,
    method: source.slice(start, end) === quote ? "exact" : "normalized",
  };
}
