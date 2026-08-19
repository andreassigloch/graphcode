#!/usr/bin/env bash
# Zweites Kettenglied, korrigiert: ARM_C_EFFORT=low wie in allen Baseline-Armen.
# Wartet, bis der devstral-pull-Prozess beendet ist, dann Modellwechsel + Lauf.
set -u
cd "$(dirname "$0")/../.."
while pgrep -f "run-armC-pull.mjs" >/dev/null; do sleep 60; done
echo "--- devstral-pull fertig, Modellwechsel $(date +%H:%M) ---"
~/.lmstudio/bin/lms unload --all >/dev/null 2>&1
~/.lmstudio/bin/lms load qwen3.6-35b-a3b-mlx --context-length 16384 >/dev/null 2>&1 && echo "qwen geladen" || { echo "LOAD FEHLGESCHLAGEN"; exit 1; }
echo "=== pull · qwen36 · $(date +%H:%M) ==="
LMSTUDIO=http://localhost:1234 ARM_C_MODEL=qwen3.6-35b-a3b-mlx \
ARM_C_ROUNDS=12 ARM_C_N=3 ARM_C_MAX_TOKENS=8192 ARM_C_TIMEOUT=900000 \
ARM_C_EFFORT=low ARM_C_TAG=armC-pull-qwen36 \
  node rig/minimal-whitebox/run-armC-pull.mjs > rig/minimal-whitebox/results/armC-pull-qwen36.stdout.log 2>&1
echo "exit=$? · $(date +%H:%M)"
