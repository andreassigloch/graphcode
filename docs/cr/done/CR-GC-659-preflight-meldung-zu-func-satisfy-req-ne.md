# CR-GC-659: Preflight-Meldung zu FUNC satisfy REQ nennt die kinds nicht — Widerspruch statt Reparaturhinweis

**Status:** ✅ Done (2026-09-24)
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
- [x] Rig — Blocks `FUNC satisfy REQ` 34 → 8, Readiness req .80 → .89.

## Rig-Messung (2026-09-24, `results-runde19-gcrun-658-659.json`, gcrun-100..102, gemeinsam mit CR-GC-658)

| Mittel je Lauf | 657 | 658 + 659 |
|---|---:|---:|
| Gate-Ablehnungen | 13,3 | **3,0** |
| R-18 „FLOW ohne SCHEMA" (Gate, 3 Laeufe) | 66 | **6** |
| `FUNC satisfy REQ` im Preflight geblockt (3 Laeufe) | 34 | **8** |
| STRUCT (3 Laeufe) | 14 | 5 |
| Readiness req / uc / ver | .80 / .79 / .85 | **.89 / .85 / .86** |
| Elemente | 41 | 44 (39/55/39) |
| neue Kanten | 43 | 59 |
| Tokens ein / Laufzeit | 307k / 374 s | 218k / 231 s |

Beide Zaehler, auf die die CRs zielen, fallen um drei Viertel und mehr; die Readiness erreicht den
besten Stand der Messreihe. **Nebenbefund:** Neu-Deklarationen wieder 15 je Lauf, 26 von 45 davon
ueberschreiben Text oder Namen — teils mit dem Beispieltext des Vorbilds („Nimmt die Anfrage
entgegen."). Weiter in CR-GC-660 (im Code, nicht im Prompt).
