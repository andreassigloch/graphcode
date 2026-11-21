# CR-GC-983: RC-04 in loop und projections: Erzeuger parsen Schritt und Lauf-Urteil

**Typ:** aus Item ITEM-2026-1541 (finding)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1541.json (Lane: code)

---

## Befund

Folge von CR-GC-982 (dort die Klassifikationstabelle aller 23 SCHEMA). Klasse (a) in loop und projections:

- `generationStep` (`src/loop/generate.ts:505`) ist die Antwort von `graph_generate` und die Grenze zum Agenten (Kommentar am Schema); sie wurde nie gegen `GenerationStep` geprüft.
- `laufUrteil` (`src/projections/test-schlupf.ts:225`) gibt das Urteil an `scripts/verify-code.mjs` und `scripts/verify-full.mjs`; `LaufUrteilSchema` wurde nie geparst. Der Eingang `VitestLaufSchema` wird dort schon geparst.

## Änderung

Beide Erzeuger parsen ihr Ergebnis und geben das Original zurück (FAQ erzeuger-parst-vertrag). Kein Parse im Leser: ein zweiter Prüfort wäre ein zweiter Pfad.

## Entscheidungen

keine.

## Umfang laut `graph_impact`

`FUNC-generation-step`, `FUNC-lauf-urteil` und ihre SCHEMA. Aufrufer ändern sich nicht (Signatur gleich).

## Nachweis rot-zuerst

- `generationStep` mit Schwelle `NaN`: vorher lief der Schritt durch (Test rot), nachher wirft der Erzeuger (grün). Gültige Schwelle: Schritt unverändert.
- `laufUrteil` mit einer Abbildung `relativ`, die keine Texte liefert: vorher lief das Urteil mit Zahlen als rote Dateien durch (rot), nachher wirft der Erzeuger (grün). Gültige Abbildung: Urteil unverändert.
- Perf: je ein Parse eines kleinen Objekts je Aufruf; `tests/perf.*` im Lauf grün.

## Abschluss

RC-04 23 → 17 (nach CR-GC-982: 19; generation-step und lauf-urteil aus der Liste). `verify:code`: 76 Dateien, 778 Tests grün. Der Volllauf je CR entfällt: nach CR-GC-982 meldet `verify:full` zehn CODE-CR ohne Schlupf.
