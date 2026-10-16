#!/bin/bash
set -euo pipefail
update_dir="$(cd "$(dirname "$0")" && pwd)"
update_target="${1:-$HOME/Desktop/rtl-atlas}"
if [[ "$(uname -s)" != "Darwin" ]]; then echo "Please run on Mac / 请在 Mac 上运行"; exit 1; fi
python3 "$update_dir/payload/rtl-atlas/scripts/update_project.py" "$update_dir/payload/rtl-atlas" "$update_target"
bash "$update_target/Start-Mac.command"
