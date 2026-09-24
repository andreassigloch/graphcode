# CR-GC-657: REQ-Beispiele ohne kinds — FUNC satisfy REQ wird illegal (auch das SYSTEM-Beispiel selbst)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-559 (bug)
**Erstellt:** 2026-09-24
**Item:** bok/items/ITEM-2026-559.json (Lane: code)

---

## Befund

contracts `TRACE_PATTERNS`: `FUNC satisfy REQ` nur fuer REQ-`kinds` aus {functional, precondition,
postcondition}; `MOD`/`SYS satisfy REQ` nur fuer {non-functional, risk, mitigation}; `FCHAIN`
ohne Einschraenkung. Das Format-E-Beispiel im Executor-SYSTEM (CR-GC-650/654) zeigte eine
Latenz-REQ **ohne** kinds und `FUNC -satisfy->` darauf — selbst ein illegales Paar. Der Skill
`author-req` legte REQs ebenfalls ohne kinds an. Im Rig geblockt (Preflight, `FUNC satisfy REQ`,
je drei Laeufe): 8 (vor 649) → 15 (650, 654) → 24 (655).

## Umsetzung

- SYSTEM: Beispiel-REQ mit `@kinds ["functional"]`, legale Beispielkante, ein Satz zur kinds-Regel.
- `author-req`: `@kinds` im Beispiel und die Zuordnung kinds → Erfueller.
- RD-01-Klausel: nennt die kinds-Regel und den Patch (`~ REQ-x|Text` + `@kinds [...]`).

## Dateien (6)

`src/loop/executor-prompt.ts`, `src/loop/generate.ts`, `.claude/commands/se/author-req.md`,
`tests/executor.test.ts`, `tests/executor.round-injection-suggest-skill.test.ts`, diese Datei.

## Akzeptanzkriterien

- [x] Das GANZE SYSTEM-Beispiel (Knoten-Batch, dann reiner Kanten-Batch) geht am echten Store
      durchs Gate — rot auf dem alten Beispiel.
- [x] Der kinds-Patch der RD-01-Klausel macht eine REQ ohne kinds fuer FUNC erfuellbar (am Store).
- [x] Der injizierte author-req-Ausschnitt traegt `@kinds`.
- [x] Rig — Kernziel erreicht (REQs mit kinds 0/33 → 29/30), Blocks nicht gesunken (Ursache: CR-GC-659).

## Rig-Messung (2026-09-24, `results-runde19-gcrun-657.json`, gcrun-80..82)

| Mittel je Lauf | 655 | 657 |
|---|---:|---:|
| neu angelegte REQs mit `kinds` (3 Laeufe) | 0 von 33 | **29 von 30** |
| Readiness req / uc | .70 / .66 | **.80 / .79** |
| Elemente | 45 | 41 (42/48/32) |
| Gate-Ablehnungen | 13,3 | 13,3 |
| `FUNC satisfy REQ` im Preflight geblockt (3 Laeufe) | 24 | **34** |

**Kernziel erreicht:** das Modell setzt `kinds` — die REQ-Readiness steigt um 10 Punkte, die
UC-Readiness um 13.

**Nicht erreicht:** die Blocks steigen. Die meisten geblockten REQs existieren im Endstand nicht —
der ganze Batch ging nie ans Gate. Der Preflight selbst rechnet richtig (eine neue REQ mit `kinds`
im selben Batch geht durch, nachgeprueft). Die Ursache liegt in seiner Rueckmeldung: „Illegales
Trace-Paar: FUNC satisfy REQ — auch die Gegenrichtung ist nicht legal", und der fixHint darunter
listet `satisfy→REQ` als LEGALE Kante von FUNC. Kein Wort zu `kinds` — das Modell kann den Batch so
nicht reparieren. Weiter in CR-GC-659.

