#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(uname -s)" != "Darwin" ]]; then echo "Run this script on macOS / 请在 Mac 上运行此脚本"; exit 1; fi
if ! command -v node >/dev/null || ! command -v python3 >/dev/null; then
  echo "Install Node.js 22+ and Python 3.12 first / 请先安装 Node.js 22+ 和 Python 3.12"
  exit 1
fi
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
npm ci --no-audit --no-fund
npm test
npm run dist:mac
open release
