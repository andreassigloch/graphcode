# CR-GC-462 — `UC-loop-closure`: der Code war da, das Modell kannte ihn nicht

**Status:** open
**Angelegt:** 2026-09-02

## Root Cause

`UC-loop-closure` („Schwellen und Prompts am Trail kalibrieren") war der **einzige `error`** im
Graphen und feuerte fünf Regeln: `UC-02` (von keinem ACTOR erreichbar, error), `UC-03`/`FC-02`
(keine Wirkkette), `UC-05`/`UC-06` (keine Pre-/Postcondition).

Die Ursache war keine Modellierungsschlamperei am Use Case, sondern eine **Lücke zwischen Code und
Modell**: `src/surface/audit.ts` existiert, ist ausführlich dokumentiert und durch vier Testdateien
gedeckt — aber **kein einziger FUNC bildete ihn ab.** Der Dateikommentar sagt wörtlich:

> `audit_stats` answers **"which rule blocks whom, how often"** in aggregate

Das ist Wort für Wort der Satz des Use Case. Die Wirkkette konnte nicht existieren, weil ihre
Glieder nicht modelliert waren — und ohne Kette kein Weg vom ACTOR zum UC.

Beide REQs (`REQ-prompt-provenance`, `REQ-rule-calibration`) waren längst von `MOD-kernel` erfüllt
und von echten Tests verifiziert. Es fehlte allein die **Verhaltensebene**.

## Was angelegt wurde

| Element | Bindung |
|---|---|
| `FUNC-audit-trail` | `src/surface/audit.ts#projectAuditEntries` — „was ist passiert", je Satz |
| `FUNC-audit-stats` | `src/surface/audit.ts#aggregateAuditEntries` — „welche Regel blockt wen wie oft" |
| `SCHEMA-audit-stats` | `src/surface/audit.ts#AuditStats` |
| `SCHEMA-audit-record` | `concept: true` — bewusst ohne Liefervertrag, s. u. |
| `FLOW-audit-record` | was das Gate aufzeichnet |
| `FLOW-audit-report` | was der Betreiber liest → `ACTOR-owner`, `FUNC-se-retro` |
| `FCHAIN-loop-closure` | `mutate` → `audit-trail` / `audit-stats` → `se-retro` |

`SCHEMA-audit-record` ist absichtlich concept-only: CR-GC-319 hat entschieden **WRITING is not
DELIVERING** — der Rohsatz bleibt vollständig auf Platte als Replay-Quelle und Lernkorpus, geliefert
wird ausschließlich die Projektion. Ein exportierter Typ dafür wäre die Einladung, ihn zu liefern.

## Zwei Dinge, die das Gate richtig gemacht hat

**R-18 hat den ersten Versuch geblockt** — `FUNC -satisfy-> REQ` auf beide REQs. Das schien
zunächst falsch, weil der Graph 122 solcher Kanten trägt. `TRACE_PATTERNS` trägt seit CR-SM-266 B
ein `where`: das Pattern gilt nur für **behavioural kinds**, und beide REQs sind `non-functional`.
Die `FCHAIN` behält bewusst alle Kinds — *„sie IST die Wirkkette, an ihr hängen IO-01 und R-21, sie
ist also nie die Abkürzung."* Das Gate hatte recht, der Batch war falsch.

**Nachschärfbar:** die Meldung lautet flach *„FUNC → REQ is not a valid satisfy pattern"* und
erwähnt das `where`-Prädikat nicht. Wer 122 solche Kanten im Graphen sieht, sucht daraufhin einen
Grammatik-Bruch statt eines Kind-Mismatches. Ein Zusatz wie „…not for a REQ of structural kinds
(`non-functional`/`risk`/`mitigation`)" hätte den Umweg gespart.

## Ergebnis

**Null Errors im Graphen** — erstmals. `UC-02`, `UC-03`, `FC-02` sind weg.

Offen und bewusst nicht in diesem CR:
- `UC-05`/`UC-06` (info): keine Pre-/Postcondition-REQ. Jede neue REQ zieht nach der
  REQ-mit-Test-Invariante einen TEST nach sich; das ist ein eigener Schnitt.
- `R-02` (warning) auf beiden neuen FUNCs: sie erfüllen kein REQ direkt — korrekt, denn die
  REQs sind strukturell und werden von `MOD-kernel` und der neuen FCHAIN getragen.
- `RC-04` (warning) auf `SCHEMA-audit-stats`: `AuditStats` ist ein TypeScript-`interface`, kein
  Zod-Vertrag, also gibt es kein `.parse()`. Dieselbe Lage bei `SCHEMA-phase-readiness` und
  `SCHEMA-steering-snapshot` — **drei gebundene Schemata, die nur zur Übersetzungszeit geprüft
  werden.** Eigener Befund, eigener CR.

## Zweiter Teil: die Story steht jetzt im Modell

Der `SYS`-Knoten — die Wurzel von allem — lautete vollständig:

> „Headless Claude-Code-Sidecar-Governance-Harness: Store + Apply-Gate + Hooks + Learning-Emission,
> eine Instanz pro Repo. Carve-Out aus aimprove."

161 Zeichen, kein Wort über Nutzen — **und „Claude-Code-Sidecar" widerspricht der Agent-Agnostik,
die CR-GC-455 als verriegelte Zusage durchgesetzt hat.** Genau der Fund, den die `se:top-level`-Skill
im zweiten Durchgang erwartet: *„a contradiction — the story says one thing, the graph says another."*

Ersetzt durch die drei Merkmale (Grounding · Führung adaptiv · Optimierung strukturell und
inhaltlich), die Freiwilligkeit ausdrücklich, und die Agent-Agnostik als Aussage statt als
Widerspruch. Damit liest der nächste `se:top-level`-Lauf die Story **aus dem Graphen**.

**Ein Fallstrick dabei, gemessen statt geraten:** die erste Fassung nutzte Zeilenumbrüche zur
Gliederung. Der Format-E-Codec ist zeilenbasiert (`+ uid|beschreibung`), und der Export zeigte die
rohen Umbrüche mitten im Satz — ein Decoder liest ab Zeile 2 Müll. Ausschlaggebend war nicht die
Theorie, sondern die Zählung: **663 von 664 Knoten haben keinen Umbruch**, meiner wäre der einzige
gewesen. Neu gefasst mit `||` als Absatzmarke. Dieselbe Klasse wie das Arrow-Verbot in
Beschreibungen (`-wort->` bricht denselben Codec).

Die Langform der Story gehört in `docs/articles/`, aber erst nach den restlichen Korrekturrunden —
die Skill rechnet mit drei bis fünf, bisher waren es zwei.

## Acceptance

- [x] `rules_evaluate`: 0 errors
- [x] `UC-loop-closure` von `ACTOR-owner` erreichbar, mit Wirkkette
- [x] beide neuen FUNC tragen einen auflösenden `realRef`
- [x] Suite ohne neue Rote gegenüber der HEAD-Baseline (10 Dateien / 16 Tests)
- [x] `SYS`-Beschreibung trägt die drei Merkmale, nennt keinen benannten Agenten, kein Zeilenumbruch
