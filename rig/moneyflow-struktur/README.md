# rig/moneyflow-struktur

moneyflow durch das **echte Gate** strukturieren, statt weiter `docs/graph/*.graph.json` zu lesen.

## Warum

Jede Messung der Session 2026-09-05 lief an der committeten Datei — am Gate vorbei. Das ist
unsicher (keine Validierung, kein atomarer Rollback, kein Audit) und misst eine Datei statt eines
Systems. Genau dieser Pfad hat auch den Fehler aus CR-SM-284 produziert: die flache SSOT wurde
ungehoben in den Evaluator gereicht, 317 Phantom-Befunde an graphcode.

Hier läuft derselbe Code wie in Produktion: Disk-Kuzu, `GraphCodeHarness`, `bindToolsToHarness`.
`graph_mutate` ist dasselbe `harness.mutate()`, das der MCP-Server ruft — mit Verdict, `tier`,
`fitAdvisory`, OCC und Rollback bei `error`.

## Isolation

Der Store liegt in einem `mkdtemp`-Verzeichnis und wird nach dem Lauf gelöscht. **Das echte
moneyflow-Repo wird nur gelesen.**

## Warum das Rig die neuen Regeln sieht

`graphcode/node_modules/@sigloch/contracts` ist ein Symlink auf die Arbeitskopie in
sigloch-modules. Der lokale Build führt `RULES_VERSION` 12.0.0 mit BW-02, dem RD-04-Wurzelwald
(CR-SM-282) und dem CR-SM-284-Guard. Der per `npx` gebundene MCP-Server
(`@sigloch/graphcode@0.19.1`) kennt sie **nicht** — wer die neuen Regeln am lebenden Gate sehen
will, muss durch dieses Rig.

## Lauf

    node rig/moneyflow-struktur/driver.mjs            # Baseline messen
    node rig/moneyflow-struktur/driver.mjs --propose  # + einen Zug als dryRun durchs Gate

## Baseline (2026-09-05, graphVersion 0)

| Kennzahl | Wert |
|---|--:|
| Elemente | 1229 |
| FUNC-Wurzeln im compose-Wald | **306** |
| MOD-Wurzeln | 155 |
| Container mit Kindern | 105 |
| breitester Container | 11 |

**RD-04 feuert am lebenden Gate:** `SYS-moneyflow has 306 root FUNC children on one level (>11)`.
Das ist der Befund, den CR-SM-282 gebaut hat — hier erstmals aus dem Gate statt aus einem Skript.

BW-02: 0 Befunde. Konsistent: moneyflow hat keine einzige zerlegte FUNC, also keine Whitebox.
Sein Problem ist die fehlende Ebene, nicht ein zu breiter Rand.

Größte Regelgruppen: R-05/R-19 je 425 (Abnahmen ohne Bindung) · R-02/R-20/R-30 je 306 (die
Wurzel-FUNCs: keine REQ, keine Kette) · R-31 256 · ND-01 **16 error** (Near-Duplicate-FUNCs).

## Was der `--propose`-Lauf zeigt

Eine Probe-FUNC ohne Anschluss wird vom Gate mit `tier: suggest` und sechs neuen Warnungen
quittiert — darunter `RD-04 … 307 root FUNC children`, also die Verschlechterung, die der Zug
verursacht. **Das ist keine Strukturierung, sondern der Nachweis, dass der Schreibpfad steht.**

## Offen

Die eigentliche Strukturierung (306 Wurzeln → Ebenen) braucht Urteil darüber, *was moneyflow
tut* — das ist Domänenwissen, keine Regelableitung. Die 155 MODs aus dem Code-Import gruppieren
die FUNCs bereits; sie als FUNC-Ebene zu spiegeln verschöbe die Breite nur von 306 auf 155 und
verfehlt `se:top-level` („max 5 je Ebene") genauso.
