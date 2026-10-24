#!/usr/bin/env bash
# Repeatable setup; .env is deliberately left untouched.
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
export PIP_CACHE_DIR="${PIP_CACHE_DIR:-$repo_root/.cache/pip}"
export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-$repo_root/.cache/npm}"
python3 -m venv "$repo_root/.venv"
"$repo_root/.venv/bin/python" -m pip install -r "$repo_root/backend/requirements.lock"
npm --prefix "$repo_root/frontend" ci
npm --prefix "$repo_root/frontend" run build
