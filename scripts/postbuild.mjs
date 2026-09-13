// Post-build step. Does exactly one thing: writes an empty out/.nojekyll.
//
// GitHub Pages runs Jekyll over static files by default, and Jekyll ignores
// every directory whose name starts with an underscore. Next.js puts all its
// assets under out/_next/. Without this file the deployed page loads, but every
// stylesheet and script 404s — a blank white board that looks like a broken build.
//
// It lives here rather than only in the CI workflow so that a local
// `npm run build` + `npx serve out` sees the same rule as production.

import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const out = resolve(dirname(fileURLToPath(import.meta.url)), "..", "out");
if (!existsSync(out)) mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, ".nojekyll"), "");
console.log("postbuild: wrote out/.nojekyll");
