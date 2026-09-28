# CR-GC-715: Nutzer-Simulator: EIN Testtreiber fuer alle Ketten (A, D2, spaeter D1) im Automode — simuliert den Nutzer, Ziel autonom spec ready + code ready

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-645 (idea)
**Erstellt:** 2026-09-28
**Item:** bok/items/ITEM-2026-645.json (Lane: code)

---

## Befund

Das Rig treibt jede Kette mit eigenem Arm (`opus5`: `claude -p`; `gcrun`: `graphcode run`), und
optimiert wurde seit 2026-09-24 fast nur der Arm `gcrun` — Kette C, ohne Client. Die Zielketten
(Entscheid 2026-09-28) laufen aber immer über einen Client: A (Claude), D2 (lokaler Client + Executor),
später D1.

## Ziel

**EIN** Testtreiber für alle Ketten im Automode, der den **Nutzer simuliert**, wo nötig und möglich:
- startet den Client headless (`claude -p` bzw. `opencode run`) mit dem Initial-Prompt des Korpus;
- beantwortet Rückfragen aus einer Antwortdatei des Korpus (Auftraggeber-Wissen, z. B. die offenen
  Punkte); was dort nicht steht, beantwortet er mit „offen, bitte als offen führen" — nie erfunden;
- treibt weiter („weiter", Phasenwechsel), bis **spec ready + code ready** oder das Budget endet;
- schreibt dieselben Artefakte je Lauf (Audit, Stream/Log, Graph, Code, Tests), damit `report.mjs`,
  `zuege.mjs`, `verlauf.mjs` und das Blindurteil für jede Kette gleich rechnen.

Königsdisziplin: autonom spec ready + code ready. Die Kette ist die Messachse, der Treiber konstant.

## Umfang

`rig/` (neuer Treiber, Korpus-Antwortdatei, Anbindung an `run.mjs`), Ablösung der Arme `opus5`/`gcrun`
durch Ketten A/D2 — kein paralleler Pfad; Kette C bleibt nur, solange D2 fehlt (CR-GC-714).

## Akzeptanz

- Kette A und D2 auf demselben Korpus (AgentDiary und sigllm) mit demselben Treiber, je Kette eine
  Zeile in `docs/messung/verlauf.md`; Fragen und Antworten des Simulators im Lauf protokolliert.
