#!/usr/bin/env bash
set -euo pipefail
# Pin the exact audited development commit, never follow the moving branch at startup.
CHARTS_COMMIT="bd7ee2d06bd0e94f571f5fee3a2811eae2fb7d40"
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
