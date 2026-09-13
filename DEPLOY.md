# 部署：GitHub Pages（静态导出）

线上地址：https://andyzhang666666.github.io/llm-output-eval/

应用没有服务端。访客自带 API key，存在自己浏览器的 `localStorage` 里，请求从浏览器直接发给访客选的服务商（`src/lib/api.ts`）。所以部署就是把 `next build` 导出的 `out/` 目录放到 GitHub Pages 上，**不需要任何环境变量，也没有任何 Secret**。

> `.env` / `.env.local` 只给 `validation/` 校准脚本用，已 gitignore。不要把 `LLM_API_KEY` 加到仓库 Secrets —— 应用根本不读它，加了只是多一个能泄露的 key。

## 自动发布

推到 `main` 触发 `.github/workflows/pages.yml`：

1. `npm ci`
2. `npm run validate:build` —— 校准脚本和应用共用同一份 prompt/parser，先确认它们类型一致
3. `npm run lint`
4. `npm run build` —— `next build` 静态导出到 `out/`，再由 `scripts/postbuild.mjs` 写入 `out/.nojekyll`
5. 上传 `out/` 并部署到 Pages

仓库 Settings → Pages 的 Source 必须是 **GitHub Actions**（不是 Deploy from a branch）。用 API 一次设好：

```bash
curl -X PUT -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/AndyZhang666666/llm-output-eval/pages \
  -d '{"build_type":"workflow"}'
```

## 本地看一眼再推

```bash
npm run build
npm run preview        # npx serve out，打开 http://localhost:3000/llm-output-eval/
```

注意路径带 `/llm-output-eval/` 前缀 —— `next.config.ts` 里 `basePath` 和 `assetPrefix` 都指向仓库名，根路径 `/` 是 404，这是正常的。

## 静态导出的三个硬约束

- **`.nojekyll` 不能少。** Pages 默认走 Jekyll，会忽略所有下划线开头的目录；Next 的产物全在 `out/_next/`。缺这个文件的症状是页面能打开但样式脚本全 404，一片白。`postbuild.mjs` 就是干这个的，别删。
- **`trailingSlash: true`。** Pages 的静态托管对 `/compare` 这种无扩展名路径不会自动补 `index.html`，导出成 `/compare/index.html` 才稳。
- **服务商必须允许浏览器跨域（CORS）。** OpenAI / DeepSeek / Moonshot / 智谱 / Gemini 的官方端点都允许；自建或某些中转站不允许时，浏览器会拦下请求，应用会提示「Could not reach …（CORS）」。这种情况换服务商，或者在本机 `npm run dev` 用。

## 部署后

打开线上地址，点 **设置 API Key**，粘一个 key，跑一次评测。这一步通了就都通了。

## 状态

已部署。工作流每次推送 `main` 自动重发；三个页面（单篇 / 对比 / Bad Case）均可访问。
