# CR-GC-926: Systemmodell in Bildern: Zahlen aus dem Katalog ohne Version, 80 statt 81 Regeln

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1338 (finding)
**Erstellt:** 2026-11-13
**Item:** bok/items/ITEM-2026-1338.json (Lane: graph)

---

## Befund

Das Artefakt `docs/project/systemmodell-in-bildern.html` nennt Zahlen aus `@sigloch/contracts/se` als festen Text, ohne Version.

- „80 Regeln" und „Alle 80" (Abschnitt Regeln und Stufen). Der Katalog `ALL_RULE_DEFS` hat 81 (contracts 12.12.0, `RULES_VERSION` 50.0.0).
- Stimmt heute: 12 Bausteinarten, 6 Verbindungsarten mit 32 erlaubten Paaren, 12 Stufen, 5 Marken, 3 Regeln „immer", je Stufe 1 bis 12 Regeln, Stufe 1 mit 4 Regeln.
- Kein Test hält Seite und Katalog zusammen.

## Root Cause

Die Seite schreibt Zahlen des Katalogs ab, ohne Stand und ohne Prüfung gegen die Quelle.

## Zielbild

1. Die Seite nennt ihren Stand: Ontologie, Metamodell und Regelkatalog mit Version.
2. Jede Zahl aus dem Katalog trägt eine Marke `data-katalog`, die ein Test liest.
3. Ein Test vergleicht Stand, Zahlen, Bausteinarten, Verbindungsarten und ihre Paare mit `@sigloch/contracts/se`. Er wird rot, sobald der Katalog sich ändert und die Seite nicht mitzieht.
4. „80" wird 81; das Artefakt wird neu veröffentlicht.

## Abnahmekriterien

1. Der Test ist grün gegen contracts 12.12.0.
2. Mit „80" statt 81 auf der Seite ist der Test rot (Gegenprobe), ebenso mit einer falschen Version.
3. Die veröffentlichte Fassung ist gleich der lokalen Datei.

## Umfang

3 Dateien: das Artefakt, `tests/systemmodell-in-bildern.katalog.test.ts`, `scripts/model-test-set.mjs` (Test in die Modell-Spur, weil nur `docs/` ihn rot machen kann). Kein Modellknoten: Die Seite hat keinen, wie 906–908.

---

## Umfang laut `graph_impact`

Kein Modellknoten betroffen: Die Seite und ihr Test liegen außerhalb des Modells.

---

## Ergebnis (2026-11-13)

- Stand-Zeile unter dem Beispiel: Ontologie 11.1.0 · Metamodell 6.0.0 · Regelkatalog 50.0.0, aus `@sigloch/contracts`.
- 15 Marken `data-katalog` an den Zahlen der Seite: Regeln (81, zweimal), Stufen, Marken, Regeln „immer", je Stufe min/max, Stufe 1, Bausteinarten (dreimal plus Einleitung), Verbindungsarten (Einleitung und Überschrift), drei Versionen.
- Test `tests/systemmodell-in-bildern.katalog.test.ts`, 5 Fälle: Versionen, Zahlen, Stufenleiste mit Marken, Bausteinarten gegen `ElementType`, Verbindungsarten und alle 32 erlaubten Paare gegen `TRACE_PATTERNS`. In der Modell-Spur.
- Artefakt neu veröffentlicht (Version 15).

Abnahme:
1. ✓ Test grün gegen contracts 12.12.0; type-check grün; `verify:model` grün (54 Dateien).
2. ✓ Gegenproben, je ein Fall rot: „80" statt 81, Regelversion 49.0.0, Paar SYS→MOD entfernt, Paar TEST→MOD ergänzt, Marke PDR hinter Stufe 8.
3. ✓ Veröffentlichte Fassung aus derselben Datei wie der Commit.

Nicht geprüft: Zahlen der Paketstation (9 Anforderungen, 6 Funktionen) und „Zehn Bausteinarten" der Landkarte; sie stammen nicht aus dem Katalog.

`verify:full CR-GC-926`: 1781 von 1782 grün. Rot war nur `tests/perf.advisory-roundtrip.spike.test.ts` (Wachstumsfaktor 3,42, Schranke < 3). Er liegt außerhalb der Auswahl und zählt als Schlupf. Allein zweimal gefahren: Faktor 3,12 (rot) und 2,56 (grün). Der CR ändert keinen Quellcode. Bekannt als ITEM-2026-1175: Die Messung aus 3 Runden schwankt um die Schranke.
