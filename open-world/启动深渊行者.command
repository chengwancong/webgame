#!/bin/zsh
set -e
cd -- "$(dirname "$0")"
if [[ ! -d node_modules ]]; then pnpm install; fi
if [[ ! -f apps/web/public/art/manifest.json ]]; then python3 tools/build_assets.py; fi
(sleep 3; open 'http://127.0.0.1:8612/') &
node tools/dev.mjs
