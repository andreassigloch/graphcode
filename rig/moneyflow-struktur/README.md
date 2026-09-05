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

## Der Schnitt (bestätigt 2026-09-05)

moneyflow **hatte** ein vollständiges SE-Modell — 1 SYS, 7 ACTOR, 13 UC, 8 FCHAINs, dokumentiert in
`docs/project/architecture-graph.md` (Stand 2026-03-18). **Der Code-Reseed hat es überschrieben:**
`se:import-code` erzeugt FUNC/MOD/FLOW/SCHEMA und ersetzt den ganzen Graphen. Deshalb steht in
`docs/views/conops.md` „0 ACTOR, 0 UC" neben einer Doku mit 13 UCs. CR-SM-271s „eine fehlende Ebene
im Ganzen" ist keine Lücke, sondern ein Verlust.

Der Schnitt fällt aus README, den 13 dokumentierten UCs und den Modul-Präfixen —
Reihenfolge = Wirkkette:

| Block | Module |
|---|--:|
| Zahlen beschaffen (crawlers · import · transformers) | 34 |
| Kreislauf halten (core · schemas) | 20 |
| Fragen und simulieren (simulation · llm · mcp) | 15 |
| Sichtbar machen (frontend · api) | 70 |
| Betreiben (auth · ops · billing · content) | 15 |

`mod_cli_ts` mit 4 FUNCs bleibt unzugeordnet und wird gemeldet, nicht stillschweigend verteilt.

## Lauf 1 — der Strukturierungs-Zug, gemessen

    node rig/moneyflow-struktur/driver.mjs --structure --apply

466 Kommandos (10 Knoten, 456 compose-Kanten), **ein Batch, `tier: suggest`, `success: true`**.

| | vorher | nachher |
|---|--:|--:|
| FUNC-Wurzeln | 306 | **9** |
| MOD-Wurzeln | 155 | **6** |
| RD-04 | 1 (an SYS) | **10** (an den Blöcken) |
| BW-02 | 0 | **3** |

**Der Befund ist nicht verschwunden — er ist eine Ebene tiefer gewandert, dorthin wo er
beantwortbar ist.** Genau die Eigenschaft, die CR-SM-281 §2.6 für das rekursive Verfahren
vorhergesagt hat: der Degenerat hat nirgends hin, wo er sich verstecken könnte.

Die zehn neuen RD-04 sind jetzt lokale, benennbare Fragen:

    FUNC-mf-zeigen       100 sub-FUNC     MOD-mf-zeigen      70 sub-MOD
    FUNC-mf-beschaffen    76 sub-FUNC     MOD-mf-beschaffen  34 sub-MOD
    FUNC-mf-betreiben     57 sub-FUNC     MOD-mf-kreislauf   20 sub-MOD
    FUNC-mf-kreislauf     37 sub-FUNC     MOD-mf-betreiben   15 sub-MOD
    FUNC-mf-simulieren    32 sub-FUNC     MOD-mf-simulieren  15 sub-MOD

Und **BW-02 feuert erstmals auf moneyflow** — die Blöcke sind jetzt Whiteboxes, ihr Rand ist
messbar:

    FUNC-mf-zeigen      23 Verträge am Whitebox-Rand
    FUNC-mf-betreiben   16
    FUNC-mf-simulieren   7

## Offen

- **Zweite Ebene je Block.** „Sichtbar machen" trägt 100 FUNCs und 23 Randverträge — der Block ist
  in Wahrheit zwei (Darstellung / HTTP-Rand). Das war beim Schnitt schon benannt.
- **UC/ACTOR/FCHAIN zurückholen** aus `docs/project/architecture-graph.md`, sobald die Blöcke stehen.
- **`mod_cli_ts`** einordnen.
