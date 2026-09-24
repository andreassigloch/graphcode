# CR-GC-659: Preflight-Meldung zu FUNC satisfy REQ nennt die kinds nicht — Widerspruch statt Reparaturhinweis

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-561 (bug)
**Erstellt:** 2026-09-24
**Item:** bok/items/ITEM-2026-561.json (Lane: code)

---

## Befund

gcrun-80..82 (nach CR-GC-657): 34 Batches im Preflight geblockt mit „Illegales Trace-Paar: FUNC
satisfy REQ — auch die Gegenrichtung ist nicht legal"; der fixHint listete `satisfy→REQ` als LEGALE
Kante von FUNC. Die Ursache — das `where`-Praedikat auf `REQ.kinds` (contracts 9.x) — nannte die
Meldung nicht. Der Preflight rechnet richtig; nur seine Rueckmeldung war typ-, nicht kinds-genau.

## Umsetzung

`kindsBefund` im Preflight: scheitert ein Paar nur am `where`-Praedikat, nennt die Meldung die
erlaubten und die tatsaechlichen kinds, der fixHint beide Reparaturwege — kinds setzen (Patch-Form)
oder den Partner, der mit den vorhandenen kinds legal waere. Alles aus `TRACE_PATTERNS`. Ist schon
das Typpaar illegal, bleibt die bisherige Meldung. Die Meldung steht auch in der Rig-Trace
(„preflight blocked: …") — die Ursache ist damit kuenftig ohne Nachrechnen lesbar.

Gemessen gemeinsam mit CR-GC-658 (andere Zaehler: 658 wirkt auf R-18 FLOW/SCHEMA und STRUCT, 659 auf
die Preflight-Blocks `FUNC satisfy REQ`).

## Dateien (3)

`src/loop/preflight.ts`, `tests/executor.preflight.test.ts`, diese Datei.

## Akzeptanzkriterien

- [x] kinds passen nicht / fehlen / Typpaar illegal — 3 Faelle; die ersten beiden rot auf dem alten Stand.
- [ ] Rig (gcrun, N=3) gegen gcrun-80..82: Preflight-Blocks `FUNC satisfy REQ` deutlich weniger,
      Readiness nicht schlechter.
