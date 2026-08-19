#!/usr/bin/env bash
# Arm `pull` (keine Injektion + Präzisions-Trias im Angebot) auf BEIDEN Modellen.
# Sequenziell, weil LM Studio genau ein Modell resident hält.
set -u
cd "$(dirname "$0")/../.."
export LMSTUDIO=${LMSTUDIO:-http://localhost:1234}
export ARM_C_ROUNDS=12 ARM_C_N=3 ARM_C_MAX_TOKENS=8192 ARM_C_TIMEOUT=900000
R=rig/minimal-whitebox/results

run() {  # $1 = Modell-ID, $2 = Tag
  echo "=== pull · $2 · $(date +%H:%M) ==="
  ARM_C_MODEL="$1" ARM_C_TAG="armC-pull-$2" \
    node rig/minimal-whitebox/run-armC-pull.mjs > "$R/armC-pull-$2.stdout.log" 2>&1
  echo "exit=$? · $(date +%H:%M)"
}

run "mistralai/devstral-small-2-2512" devstral
echo "--- Modellwechsel auf qwen3.6-35b-a3b ---"
~/.lmstudio/bin/lms unload --all >/dev/null 2>&1
~/.lmstudio/bin/lms load qwen3.6-35b-a3b-mlx --context-length 16384 >/dev/null 2>&1 && echo "geladen" || echo "LOAD FEHLGESCHLAGEN"
run "qwen3.6-35b-a3b-mlx" qwen36
echo "=== pull-Kette fertig $(date +%H:%M) ==="
