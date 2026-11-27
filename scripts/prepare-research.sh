#!/usr/bin/env bash
set -euo pipefail
# Pin the exact audited development commit, never follow the moving branch at startup.
CHARTS_COMMIT="e5454233fbc4aabc8b66b3de59c5e65f31a3346f"
REPO_URL="https://github.com/parentjustin45-collab/Cryptojuju-charts.git"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$ROOT/vendor/cryptojuju-charts"

if [ ! -d "$TARGET/.git" ]; then
  mkdir -p "$TARGET"
  git -C "$TARGET" init -q
  git -C "$TARGET" remote add origin "$REPO_URL"
fi
git -C "$TARGET" fetch --depth 1 --no-tags origin "$CHARTS_COMMIT"
ACTUAL="$(git -C "$TARGET" rev-parse FETCH_HEAD)"
if [ "$ACTUAL" != "$CHARTS_COMMIT" ]; then
  echo "Unexpected CryptoJuju research source revision" >&2
  exit 1
fi
git -C "$TARGET" -c advice.detachedHead=false checkout -q --force --detach FETCH_HEAD
npm install --prefix "$TARGET/backtest/agents/render" --no-audit --no-fund
echo "CJ research source pinned: $ACTUAL"

node --check "$TARGET/backtest/agents/render/historical-final-audit.mjs"


node --check "$TARGET/backtest/agents/hourly-bitunix-recovery.mjs"
node --check "$TARGET/backtest/agents/run-bitunix-data-pilot.mjs"

node --check "$TARGET/backtest/agents/render/historical-pivot-research.mjs"

node --check "$TARGET/backtest/agents/render/historical-state-research.mjs"

node --check "$TARGET/backtest/agents/render/historical-single-change-research.mjs"

node --check "$TARGET/backtest/agents/render/historical-targeted-research.mjs"

node --check "$TARGET/backtest/agents/render/historical-targeted-v3-research.mjs"

node --check "$TARGET/backtest/agents/render/prospective-validation-runner.mjs"

node --check "$TARGET/backtest/agents/render/older-history-worker.mjs"
node --check "$TARGET/backtest/agents/render/autonomous-experiment-worker.mjs"

node --check "$TARGET/backtest/agents/render/binance-library.mjs"

node --check "$TARGET/backtest/agents/render/streaming-audit.mjs"

node --check "$TARGET/backtest/agents/render/streaming-frozen-audit.mjs"

node --check "$TARGET/backtest/agents/render/adaptive-research.mjs"

node --check "$TARGET/backtest/agents/render/llm-research.mjs"

node --test "$TARGET/backtest/agents/render/llm-research.test.mjs"

node --check "$TARGET/backtest/agents/render/level5-vector-diagnostic.mjs"
node --test "$TARGET/backtest/agents/render/level5-vector-diagnostic.test.mjs"

node --check "$TARGET/backtest/agents/render/level5-rule-contract.mjs"
node --test "$TARGET/backtest/agents/render/level5-rule-contract.test.mjs"
