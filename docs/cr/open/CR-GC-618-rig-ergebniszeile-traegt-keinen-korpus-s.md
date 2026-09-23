# CR-GC-618: Das Greenfield-Rig stempelt seinen Korpus, und ein Timeout wirft die Arbeit nicht weg

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-488 (finding); schliesst ITEM-2026-479 und ITEM-2026-485
**Erstellt:** 2026-09-23
**Item:** bok/items/ITEM-2026-488.json (Lane: code)

---

## Befund

`rig/README.md` stellt die Regel auf: *„Ohne Stempel keine Zahl."* Genau das Rig, das die
teuersten Zahlen produziert, hält sie nicht ein. Die Ergebniszeile trägt

```
arm, model, executor, run, exportError, elements, traces, structure,
readiness, spec, code, gate_rejections, tokens, moduleAudit, briefCoverage
```

— und kein einziges Feld nennt **welchen Korpus** der Lauf gefahren hat. Der Korpus steckt in
sieben Umgebungsvariablen (`PROMPT_FILE`, `GOLDEN`, `MATERIAL`, `SEED_*`, `MATERIAL_HINT`), die
`rig/sigllm-spezifikation/lauf*.env` per `source` setzt. Vergisst man das `source`, fährt das Rig
klaglos den in `run.mjs` eingebauten graphcode-Webapp-Korpus. Zwei Ergebnisdateien aus
verschiedenen Korpora sehen danach identisch aus.

Das ist am 2026-09-22 passiert: ein Lauf über den Webapp-Korpus wurde gegen die Grundlinien
`opus5-14/15` verglichen, die auf sigllm-Prosa liefen. Der Fehler war nicht zu sehen — er stand
nirgends.

Zwei Folgefehler derselben Wurzel:

- **`GOLDEN` hat einen Default**, und der zeigt auf `sigloch-modules.graph.json` — einen
  **lebenden** Repo-Graphen. `rig/README.md` verbietet das ausdrücklich („Ein Benchmark, dessen
  Eingabe weiterläuft, misst nichts"), und der Graph ist für den Webapp-Korpus ausserdem
  kategoriefremd und veraltet (ITEM-2026-485: `se-optimizer`/`se-steering` gibt es seit CR-SM-248
  nicht mehr).
- **`RUN_TIMEOUT_S` steht auf 1200**, die gemessene Grundlinie eines Frontier-Spezifikationslaufs
  liegt bei 2235 s. Die Korpus-env-Dateien setzen 3600, der Default nicht. Und der Abbruch wirft
  weg, was schon da ist: `authorViaClaude` wirft bei `status !== 0`, `main()` fängt und schreibt
  eine Fehlerzeile — `captureArtifacts` läuft nie. Am 2026-09-22 fielen so 182 bereits autorierte
  Elemente und 327 Kanten aus einem bezahlten Lauf (ITEM-2026-479).

Der Exit-Code des Executors sagt, **wie** ein Lauf geendet ist. Ob etwas autoriert wurde, sagt
der Store auf Platte. Das Rig verwechselt beides.

## Zielbild

1. **Jede Ergebniszeile trägt einen `stempel`**: Korpus-Name, Prompt-Datei mit sha256, Golden mit
   sha256 und Umfang, Seed-uid, Material, Zeitgrenze, Code-Stand. Zwei Läufe, die sich
   unterscheiden, unterscheiden sich dann sichtbar.
2. **`GOLDEN` hat keinen Default mehr.** Ohne Golden entfällt der Abgleich und sagt das (`null`
   mit Begründung) — statt still gegen einen mitlaufenden Fremdgraphen zu rechnen.
3. **Ein Abbruch verwirft nichts.** `authorVia*` wirft nicht mehr bei `status !== 0`; der Lauf
   erfasst die Artefakte und die Zeile trägt `ende: { art, signal|status }`. Ein Lauf ohne
   Autorierung meldet dann ehrlich 0 Elemente, statt zu fehlen.
4. **Die Zeitgrenze folgt der Messung**, nicht einer runden Zahl: Default 3600 s.

## Akzeptanzkriterien

- [ ] `stempel` steht in jeder Ergebniszeile, auch in einer Abbruchzeile
- [ ] Ohne `GOLDEN` läuft das Rig, und `moduleAudit` ist `null` **mit Grund**, nicht 0
- [ ] Ein Lauf, der in die Zeitgrenze läuft, liefert trotzdem `elements`/`readiness` aus dem Store
- [ ] Reine Funktionen (`korpusStempel`, `laufEnde`) mit Tests, kein Netz
- [ ] `report.mjs` zeigt den Stempel und weigert sich, Zeilen verschiedener Korpora zu mitteln

## Umfang

`rig/greenfield-systemtest/run.mjs`, `metrics.mjs`, `report.mjs`, `rig/README.md`,
`tests/systemtest-rig.test.ts`.
