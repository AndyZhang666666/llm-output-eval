# 部署到 Vercel

应用没有服务端密钥。访客自带 API key，存在自己浏览器里，通过 `/api/evaluate` 转发。所以部署就是一次普通的 Next.js 部署，**不需要任何环境变量**。

> `.env` / `.env.local` 只给 `validation/` 脚本用，已 gitignore。不要把 `LLM_API_KEY` 加到 Vercel —— 应用根本不读它，加了只是多一个能泄露的 key。

## 方式 A —— Vercel 控制台（不用 CLI）

1. 把仓库推到 GitHub。
2. 打开 https://vercel.com/new，导入仓库。
3. Framework preset 选 **Next.js**（会自动识别），构建配置保持默认。
4. 环境变量：**不填**。
5. Deploy。地址是 `https://<project>.vercel.app`。

## 方式 B —— Vercel CLI

```bash
npm i -g vercel
vercel login            # 需要账号所有者在浏览器里登录
vercel                  # 首次部署，一路默认：新建项目
vercel --prod           # 生产部署
```

## 部署后

- 打开地址，点 **设置 API Key**，粘任何兼容 OpenAI 协议的 key，跑一次评测。这一步通了就都通了。
- 函数超时：免费层 serverless 函数默认 10 秒上限；`route.ts` 声明了 `maxDuration = 120`，Hobby 计划最多认 60 秒、Pro 最多 300 秒。3 连跑的对比配上慢服务商可能超过 10 秒，Hobby 上看到 504 就把连跑次数降到 1，或者升级。
- 把地址补进 README 的「怎么用」一节。

## 如果每次评测都返回 502、body 为空

检查启动服务的那个 shell 有没有导出 `HTTP_PROXY` / `HTTPS_PROXY`。Next.js 服务端的 `fetch` 会遵循这两个变量，代理连不到模型端点时，路由处理器自己的请求会在返回 JSON 错误之前就挂掉，你拿到的就是一个空 502，日志里什么都没有。而 Node 原生 `fetch` 不认这些变量 —— 所以 `validation/` 脚本能跑通、应用却挂着，排查时这个分裂很迷惑人。

用同一个请求直接过代理确认一下：

```bash
curl -x "$HTTP_PROXY" "$LLM_BASE_URL/models" -o /dev/null -w '%{http_code}\n'
```

然后不带这些变量启动：

```bash
env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy npm run dev
```

Vercel 上不用管 —— 默认没有代理变量。

## 状态

尚未部署 —— Vercel 账号属于仓库所有者，需要交互式登录。本地已端到端验证：生产构建通过（`npx next build`），三个页面全部返回 200，通过 `/api/evaluate` 跑一次真实评测能拿到 3 次完整运行和证据句。
