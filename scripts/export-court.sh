#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export BADMINTON_PROJECT_ROOT="$ROOT"
BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
"$BLENDER" -b -P "$ROOT/blender/build_court.py"
echo "Done. Asset at: $ROOT/public/assets/court.glb"
ls -la "$ROOT/public/assets/court.glb"
