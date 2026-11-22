# CryptoJuju API + Render Research (DEV only)

**Status:** integration staged, no deployment. The paid Render service continues to run main using node server.js; this repository branch is dev/render-ai-agents.
Never merge or deploy this branch without a separately verified compatibility gate. No real trades and no API tokens.

## Why two repositories?
- This repository (cryptojuju-api) owns the public Bitunix proxy.
- Cryptojuju-charts, branch dev/ai-agents-phase1, owns the specialist
  research algorithms, the scheduler and isolated tests.
- scripts/prepare-research.sh fetches and verifies the exact 40-character
  research commit ID, **not** the latest moving branch, without a token.
  The checkout is excluded by .gitignore.

## Testing / reproducing in DEV
Requires Git, Bash, Node >=22, and npm:
1. npm install --no-audit --no-fund
2. npm run prepare:research
3. npm run test:agents-staging
4. node vendor/cryptojuju-charts/backtest/agents/render/integration-smoke.mjs
5. CJ_AGENT_RUNTIME_ENABLED=0 PORT=10000 npm run start:agents-staging

The action .github/workflows/render-research-staging.yml runs these checks,
including an actual HTTP check of server-render-ai.mjs with agents **OFF**.

## Proposed Render settings when ready (NOT applied)
Existing paid web service cryptojuju-api, region Ohio, 0.5 CPU/512 MB:
- Repo: parentjustin45-collab/cryptojuju-api
- Branch: dev/render-ai-agents (requires verified non-production cutover)
- Build command:
  npm install --no-audit --no-fund && bash scripts/prepare-research.sh
- Start command:
  node server-render-ai.mjs
- Environment:
  CJ_AGENT_RUNTIME_ENABLED=0 for API-only verification,
  then CJ_AGENT_RUNTIME_ENABLED=1 **only after** DATABASE_URL is installed.
- DATABASE_URL: Set **in the Render dashboard** from the existing database's
  *internal* PostgreSQL connection URL, not from GitHub or chat. Keep the database
  IP allowlist closed. Do not expose secret values in logs or repositories.

The production API contract is preserved by the imported integration code:
GET /, GET /api/bitunix/proxy. New monitoring endpoints
GET /healthz and GET /api/agents/status intentionally disclose neither
DB credentials nor research results. No trading endpoints are added.

## Gate before real activation
1. CI tests and HTTP safety checks success, including exact source revision.
2. Confirm the Render service can access the DB internally, and initialize
   cj_agent_runs and cj_agent_insights tables.
3. Start one real Bitunix data window first, verify double-read closed candles,
   SHA-256, idempotence and logs; validate CPU/memory within resource limits.
4. Run Vector, Momentum, SPEED, Cipher in separate slots, block bad data.
5. Add true LLM-supported research only after API budget and prompt/data review.
6. No modification of main, no paid extra service, no trading or deployment
   to production without explicit human review.

**Important:** Since the only paid web service is the public API, switching its
branch to this DEV branch would affect a live resource. This document is a
deployment recipe, **not** authorization to perform a live cutover. A separate
staging service might have extra billing; do not create one automatically.
