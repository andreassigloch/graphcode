#!/usr/bin/env bash
# Kontrollierte Wiederholung: devstral pull MIT ARM_C_EFFORT=low.
# Isoliert die eine Asymmetrie gegen armC-pull-devstral (dort kein reasoning_effort-Feld).
# Landet er wieder ~101 El, war das Feld nicht die Ursache -> Streuung.
# Landet er bei ~19-28, erklärt das Feld den Unterschied - und wirft ein Licht auf alle Vorarme.
set -u
cd "$(dirname "$0")/../.."
~/.lmstudio/bin/lms unload --all >/dev/null 2>&1
~/.lmstudio/bin/lms load mistralai/devstral-small-2-2512 --context-length 16384 >/dev/null 2>&1 \
  && echo "devstral geladen $(date +%H:%M)" || { echo "LOAD FEHLGESCHLAGEN"; exit 1; }
LMSTUDIO=http://localhost:1234 ARM_C_MODEL=mistralai/devstral-small-2-2512 \
ARM_C_ROUNDS=12 ARM_C_N=3 ARM_C_MAX_TOKENS=8192 ARM_C_TIMEOUT=900000 \
ARM_C_EFFORT=low ARM_C_TAG=armC-pull-devstral-low \
  node rig/minimal-whitebox/run-armC-pull.mjs > rig/minimal-whitebox/results/armC-pull-devstral-low.stdout.log 2>&1
echo "exit=$? · $(date +%H:%M)"
