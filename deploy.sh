#!/usr/bin/env bash
# Deploy TradeBrowser (static site, no build step) to $TRADEBROWSERDEPLOY.
# Syncs src/ (minus node_modules/CLI bits), adds index.html -> trade_browser.html.
# Usage: ./deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$ROOT/src"

if [[ -z "${TRADEBROWSERDEPLOY:-}" && -f "${HOME}/.festival.env" ]]; then
  # shellcheck disable=SC1091
  source "${HOME}/.festival.env"
fi

if [[ -z "${TRADEBROWSERDEPLOY:-}" ]]; then
  echo "TRADEBROWSERDEPLOY is not set (expected in ~/.festival.env)." >&2
  exit 1
fi
if [[ ! -d "$TRADEBROWSERDEPLOY" ]]; then
  echo "Deploy target does not exist: $TRADEBROWSERDEPLOY" >&2
  exit 1
fi
if [[ ! -f "$SRC/trade_browser.html" ]]; then
  echo "Missing $SRC/trade_browser.html" >&2
  exit 1
fi

echo "Deploying src/ → $TRADEBROWSERDEPLOY"
rsync -a --delete --no-perms --no-owner --no-group --info=stats2 \
  --exclude node_modules/ --exclude 'package*.json' \
  --exclude 'trade_browser_cli.js' --exclude 'trade_browser.sh' \
  --exclude index.html \
  "$SRC/" "$TRADEBROWSERDEPLOY/"
cp "$SRC/trade_browser.html" "$TRADEBROWSERDEPLOY/index.html"

echo "Done."
