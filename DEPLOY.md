# Deploying to Vercel

The app has no server-side secrets. Visitors bring their own API key, which is
stored in their browser and forwarded through `/api/evaluate`. So deployment is
a plain Next.js deploy with **no environment variables required**.

> `.env` / `.env.local` are only used by the `validation/` scripts and are
> gitignored. Do not add `LLM_API_KEY` to Vercel — the app never reads it, and
> doing so would only create a key to leak.

## Option A — Vercel dashboard (no CLI)

1. Push this repo to GitHub.
2. Go to https://vercel.com/new, import the repo.
3. Framework preset: **Next.js** (auto-detected). Leave build settings default.
4. Environment variables: **none**.
5. Deploy. The URL will be `https://<project>.vercel.app`.

## Option B — Vercel CLI

```bash
npm i -g vercel
vercel login            # needs the account owner's browser
vercel                  # first deploy, answers: link to new project, defaults
vercel --prod           # production deploy
```

## After deploying

- Open the URL, click **设置 API Key**, paste any OpenAI-compatible key, run one
  evaluation. If it works there, it works.
- Route handler timeout: the free tier caps serverless functions at 10 s by
  default; `route.ts` declares `maxDuration = 120`, which the Hobby plan honours
  up to 60 s and Pro up to 300 s. A 3-run compare with a slow provider can
  exceed 10 s, so if you see 504s on Hobby, reduce runs to 1 or upgrade.
- Add the URL to the README's "How to run it" section.

## If every evaluation returns 502 with an empty body

Check whether `HTTP_PROXY` / `HTTPS_PROXY` are exported in the shell that
started the server. Next.js's server-side `fetch` honours those variables, so
behind a proxy that cannot reach the model endpoint the route handler's own
call fails before it can return a JSON error, and you get a bare 502 with
nothing in the log. Plain `node` `fetch` ignores the variables, which is why
the `validation/` scripts can succeed while the app fails — a confusing split
when you are debugging.

Confirm it by sending the same request straight through the proxy:

```bash
curl -x "$HTTP_PROXY" "$LLM_BASE_URL/models" -o /dev/null -w '%{http_code}\n'
```

Then start the server without them:

```bash
env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy npm run dev
```

On Vercel there is nothing to configure — no proxy variables are set by default.

## Status

Not yet deployed — the Vercel account belongs to the repo owner and requires an
interactive login. Local run is verified end to end: production build passes
(`npx next build`), all three pages return 200, and a real evaluation through
`/api/evaluate` returns 3 complete runs with evidence sentences.
