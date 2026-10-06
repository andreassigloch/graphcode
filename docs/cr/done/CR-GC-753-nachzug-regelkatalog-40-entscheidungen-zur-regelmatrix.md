# CR-GC-753: Nachzug Regelkatalog 40 (CR-SM-396) — die neun Entscheidungen zur Regelmatrix

**Status:** ✅ Done (2026-10-06)
**Auslöser:** CR-SM-396 in sigloch-modules (contracts 11.0.0 unveröffentlicht, `RULES_VERSION` 40.0.0)

## Was sich im Katalog geändert hat

| Entscheidung des Autors (2026-10-06) | Wirkung |
|---|---|
| „Schema hat einen Test" (R-32) gilt für alle Schemas | feuert schon im Entwurf, hält TRR |
| „Datenfluss hat ein Schema" (R-34) entfällt | 79 → 78 Regeln, 69 → 68 scorende |
| Ein offener Auftrag zählt nur als Bauauftrag, wenn daraus Code entsteht | ein CR mit `relation [label: decides]` eröffnet den Bau nicht |
| R-17 verlangt mindestens einen Anwendungsfall | der Kaltstart `seed:uc` folgt ohne Codeänderung |
| Hinweise halten keine Marke; abgenommener AF-05 hält „Bau" | nur im Client |
| RC-07 gilt immer (Stufe 10) | meldet schon im Entwurf |
| AF-01 hinter den Anforderungen (Stufe 3) | der Schritt nennt UC-01 vor AF-01 |

## Nachzug in graphcode

- `tests/readiness.completeness.test.ts`: die lückenlose Spezifikation trägt einen Vertragstest je Schema; neu: Schema ohne
  Test hält TRR, ein Entscheidungs-Auftrag eröffnet den Bau nicht.
- `tests/generate.stufen.test.ts`: die Referenz `frontier` trägt nur Entscheidungs-Aufträge — keine Bindungsfenster; mit
  einem Bauauftrag stehen sie nach allem, was vor dem Bau liegt.
- `tests/claims.conformance.test.ts` und zwei Artikel: 69 → 68 engine rules.
- `tests/fixtures/steering-graphs.ts`: toter Zweig `R-34` gelöscht.
- `src/loop/generate.ts`, `src/kernel/measure/focus-set.ts`: Kommentare (R-17, R-32).
- `docs/views/regel-matrix.{md,csv}` neu erzeugt.

Keine Verhaltensänderung im Quelltext: Stufe, Rolle, Marke und Fälligkeit liest graphcode aus dem Katalog.

## Abnahme

- Die drei betroffenen Testdateien grün, `verify:full CR-GC-753`.
- An beiden Rig-Referenzen: SRR, PDR, CDR erreicht; TRR hält R-32 (je 2 Schemas ohne Vertragstest).
