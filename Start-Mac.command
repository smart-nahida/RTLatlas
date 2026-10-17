#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ "$(uname -s)" != "Darwin" ]]; then echo "Please run on macOS / 请在 Mac 上运行"; exit 1; fi
if ! command -v node >/dev/null || ! command -v python3 >/dev/null; then
  echo "Requires Node.js 22.12+ and Python 3 / 需要 Node.js 22.12+ 和 Python 3"
  read -r -p "Press Enter to close / 回车关闭" _answer
  exit 1
fi
if [[ ! -d .venv ]]; then python3 -m venv .venv; fi
source .venv/bin/activate
if ! python -c 'import pyslang, yaml; assert pyslang.__version__ == "11.0.0"' 2>/dev/null; then
  python -m pip install -r backend/requirements.txt
fi
if [[ ! -f node_modules/.bin/vite ]]; then npm ci --no-audit --no-fund; fi
# Retry a previously interrupted runtime download without reinstalling dependencies.
if ! node node_modules/electron/install.js; then
  echo "Electron download did not finish. Run this launcher again to retry. / Electron 下载未完成，重新运行即可重试。"
  exit 1
fi
echo "Starting RTL Atlas / 正在启动 RTL Atlas…"
npm run desktop
