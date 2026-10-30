[English](README.md) | 简体中文

# Stubline 买家网站

这是对接 Stubline API **1.1.0** 的简洁 React 网站（后端 release `v1.1.0`）。网站列出活动和分页座位，使用 authorization code 与 PKCE 登录，预订座位，通过 URL 重新打开买家自己的订单，支付演示金额并下载 PDF 门票。

`openapi/stubline.yaml` 逐字节复制自后端 release `v1.1.0`。更新契约后运行 `pnpm generate:api`，用 `pnpm check:api` 检查已提交的生成客户端。

## 试用浏览器演示

在线演示包含在 `v1.1.0` 版本中。

打开[在线演示](https://codexary.github.io/stubline-web/)，或运行 `VITE_DEMO=1 pnpm dev` 并打开 Vite 地址。横幅标明使用模拟数据。无需启动后端，即可浏览活动与座位、以演示买家身份登录、预订、支付并下载示例门票。演示登录只签发本地占位 token；普通构建继续使用 PKCE 和开发 issuer。运行 `VITE_DEMO=1 VITE_BASE_PATH=/stubline-web/ pnpm build` 可构建独立演示网站。Pages 工作流仅在推送 `v*` tag 或手动触发时发布。

## 对接后端

使用 Node 26.12.1 和 pnpm 10.20.0。在相邻的 `stubline-backend` 仓库切换到 tag `v1.1.0` 后运行：

```sh
cd ../stubline-backend
cp .env.example .env
./scripts/dev-ca.sh
STUBLINE_OAUTH_CLIENT_ID=stubline-web \
STUBLINE_OAUTH_REDIRECT_URIS=http://localhost:8088/callback \
STUBLINE_OAUTH_WEB_ORIGINS=http://localhost:8088 \
STUBLINE_CORS_ORIGINS=http://localhost:8088 \
docker compose -p stubline up --build -d --wait
```

OAuth redirect URI 必须完全匹配。令牌服务允许 `http://localhost:8088` 作为 token exchange 的 web origin；API 用 `STUBLINE_CORS_ORIGINS` 允许浏览器请求。本地公共 CA 位于 `../stubline-backend/certs/dev/public-ca.crt`。登录前请在浏览器中信任该证书。开发登录表单要求输入买家标识，例如 `buyer-a`。

```sh
cd ../stubline-web
pnpm install --frozen-lockfile
pnpm dev --port 8088
```

若使用容器而非 Vite，在本仓库运行 `docker compose -p stubline-web up --build -d --wait`。打开 `http://localhost:8088`；`curl -fsS http://localhost:8088/health` 返回 `ok`。镜像启动时根据 `STUBLINE_API_ORIGIN` 和 `STUBLINE_TOKEN_ISSUER_ORIGIN` 生成 `config.json`。CSP 仅允许这两个 HTTPS 来源。浏览器直接通过 HTTPS 访问开发令牌服务，后者按配置允许 CORS。

## 身份验证与支付

Auth 接口将开发令牌服务与网站隔离。每次登录都会生成新的 verifier 和 state，向 `/authorize` 发送 `S256` challenge，在 `/callback` 核对 state，并向 `/token` 交换一次性 code。access token 只保存在内存中。verifier、state 和返回 URL 仅在回调之前存于 `sessionStorage`；回调后从 URL 清除 code。生产身份提供者可通过同一接口替换开发实现。

订单 ID 写在 URL 中，买家重新加载页面并登录后可以打开订单。每次支付尝试生成一个 `Idempotency-Key`，重试时沿用；同一浏览器会话重新加载后也会沿用。API 不提供订单支付状态或服务端价格，所以金额明确标为演示值。若重新打开订单时没有保存的支付尝试，网站不会发起新的支付，因为无法确认此前结果；买家仍可请求门票。

## 检查

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:api
pnpm exec playwright install chromium
pnpm test:e2e
```

Playwright 仅按需对 `v1.1.0` 的全新后端运行，验证活动列表、座位分页、PKCE 登录、买家订单重新打开、同一密钥重放支付只产生一笔 charge、PDF 获取，以及买家网站各状态的 axe 检查。CI 在 pull request 上运行 lint、类型检查、单元测试、构建、生成客户端检查、CycloneDX SBOM 和镜像扫描。端到端任务只通过 `workflow_dispatch` 运行。

## About this repository

Elsworne、Stubline 和团队成员均为虚构。本仓库的代码与文档借助 AI 工具编写，记录的输出都来自实际运行。
