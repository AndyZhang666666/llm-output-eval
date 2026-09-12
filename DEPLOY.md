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

## Status

Not yet deployed — the Vercel account belongs to the repo owner and requires an
interactive login. Local run is verified (`npm run dev`, `npm run build`).
