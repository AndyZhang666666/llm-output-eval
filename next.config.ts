import type { NextConfig } from "next";

// Static export for GitHub Pages. There is no server: the judge call runs in
// the visitor's browser (src/lib/api.ts), so nothing here needs Node at runtime.
// basePath must equal the repository name or every asset 404s on Pages.
const repo = "llm-output-eval";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  basePath: `/${repo}`,
  assetPrefix: `/${repo}/`,
  trailingSlash: true,
};

export default nextConfig;
