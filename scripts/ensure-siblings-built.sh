#!/bin/bash
# CR-GC-205 Item 2 — integration guard: graphcode imports its file:-linked sibling
# packages' DIST (not src). Editing a sibling's src and forgetting to rebuild its
# dist makes `npm test` run against STALE dist — a silent false-green. This script
# (graphcode `pretest`) rebuilds each co-developed sibling whose src is newer than
# its dist, so tests always integrate the current sibling source; a type-broken
# sibling fails the build here and BLOCKS the test run (verify-before-integrate).
#
# Staleness-guarded so an unchanged tree stays fast (no rebuild when dist is fresh).
set -e
root="$(cd "$(dirname "$0")/.." && pwd)"
siblings=(
  "../sigloch-modules/packages/contracts"
  "../sigloch-modules/packages/graph-api-core"
)
for rel in "${siblings[@]}"; do
  pkg="$root/$rel"
  [ -d "$pkg/src" ] || continue
  # Rebuild if dist is missing OR any src file is newer than the dist marker.
  marker="$pkg/dist/index.js"
  if [ ! -f "$marker" ] || [ -n "$(find "$pkg/src" -name '*.ts' -newer "$marker" -print -quit 2>/dev/null)" ]; then
    echo "[ensure-siblings-built] $(basename "$pkg"): src changed → rebuilding dist"
    npm --prefix "$pkg" run build
  fi
done
