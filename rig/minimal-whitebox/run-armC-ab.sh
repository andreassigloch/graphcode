#!/usr/bin/env bash
# Arm C als A/B auf EINEM Modell (das residente): gleicher Prompt, gleiche Runden,
# gleiches N — einzige Variable ist die Injektion.
set -u
cd "$(dirname "$0")/../.."
export LMSTUDIO=${LMSTUDIO:-http://localhost:1234}
export ARM_C_MODEL=${ARM_C_MODEL:-qwen3.8-27b-mlx@4bit}
export ARM_C_ROUNDS=${ARM_C_ROUNDS:-12}
export ARM_C_N=${ARM_C_N:-1}
export ARM_C_EFFORT=${ARM_C_EFFORT:-low}
export ARM_C_TIMEOUT=${ARM_C_TIMEOUT:-900000}
for mode in full whitebox off; do
  echo "=== Arm C · $mode · $(date +%H:%M) ==="
  ARM_C_MODE=$mode ARM_C_TAG="armC-$mode" node rig/minimal-whitebox/run-armC.mjs > "rig/minimal-whitebox/results/armC-$mode.stdout.log" 2>&1
  echo "exit=$? · $(date +%H:%M)"
done
