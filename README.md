English | [简体中文](README.zh-CN.md)

# Stubline buyer site

A small React buyer site for Stubline API **1.1.0** (backend release `v1.1.0`). It lists events and paged seats, signs a buyer in with authorization code and PKCE, reserves a seat, reopens a buyer-owned order from its URL, pays a demo amount, and links to the ticket PDF.

`openapi/stubline.yaml` is copied byte for byte from backend release `v1.1.0`. Run `pnpm generate:api` after a contract update and `pnpm check:api` to check the committed generated client.

## Try the browser demo

Run `VITE_DEMO=1 pnpm dev` and open the Vite URL. The banner marks simulated data. You can browse events and seats, sign in as a demo buyer, reserve, pay and download a sample ticket without starting the backend. Demo sign-in issues only a local placeholder token; regular builds use PKCE and the development issuer. Build the standalone demo with `VITE_DEMO=1 pnpm build`.

## Run against the backend

Use Node 26.12.1 and pnpm 10.20.0. Start from a sibling `stubline-backend` checkout at tag `v1.1.0`:

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

The OAuth redirect URI must match exactly. The issuer allows `http://localhost:8088` as a web origin for the token exchange; the API uses `STUBLINE_CORS_ORIGINS` for browser requests. The local public CA is `../stubline-backend/certs/dev/public-ca.crt`. Trust it in the browser before signing in. The issuer's development form asks for a buyer subject such as `buyer-a`.

```sh
cd ../stubline-web
pnpm install --frozen-lockfile
pnpm dev --port 8088
```

For the container instead of Vite, run `docker compose -p stubline-web up --build -d --wait` from this repository. Open `http://localhost:8088`; `curl -fsS http://localhost:8088/health` returns `ok`. The image generates `config.json` at startup from `STUBLINE_API_ORIGIN` and `STUBLINE_TOKEN_ISSUER_ORIGIN`. CSP allows those HTTPS origins only. The development token issuer is accessed directly by the browser over HTTPS with its configured CORS origin.

## Authentication and payment

The auth interface isolates the development issuer from the site. It generates a new verifier and state for each sign-in, sends an `S256` challenge to `/authorize`, checks state on `/callback`, and exchanges the single-use code at `/token`. The access token stays in memory. The verifier, state and return URL live only in `sessionStorage` until the callback; the code is removed from the URL. A production identity provider can replace the development implementation through the same interface.

The order ID appears in the URL so a buyer can reopen the order after a reload and sign-in. Payment uses one generated `Idempotency-Key` per attempt and reuses it on retry, including across a reload in the same browser session. The API does not expose the order's payment status or a server-side price. The amount is marked as a demo value; when an order is reopened without a saved attempt, the site does not start a new payment because an earlier result cannot be determined. The buyer can still request its ticket.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:api
pnpm exec playwright install chromium
pnpm test:e2e
```

Playwright runs on demand against a fresh backend at `v1.1.0`. It verifies the event list, seat paging, PKCE sign-in, buyer order reopening, one charge across a payment replay, PDF retrieval, and axe checks on buyer-site states. CI runs lint, types, unit tests, build, generated-client check, a CycloneDX SBOM, and an image scan on pull requests. The end-to-end job runs only through `workflow_dispatch`.

## About this repository

Elsworne, Stubline and the team are fictional. The code and documents in this repository were written with the help of AI tools; every recorded output comes from actually running them.
