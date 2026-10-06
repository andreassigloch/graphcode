# CR-GC-754: Nachzug Regelkatalog 41 (CR-SM-397) — Analysen hinterlassen keinen Bauauftrag

**Status:** ✅ Done (2026-10-06)
**Auslöser:** CR-SM-397 in sigloch-modules (`RULES_VERSION` 41.0.0, unveröffentlicht)

## Entscheidung des Autors (2026-10-06)

Analysen schreiben Anforderungen mit Test; den Bauauftrag schneidet später der Bauplan (`se-plan`). Nur der
Variantenvergleich legt einen Auftrag an — als Träger der Entscheidung (`decides`), und der eröffnet den Bau nicht.
Der Abgleich der Modulgrenzen (RC-05) gilt immer, wie RC-07.

## Im Katalog

- IR-01 liest `analysisFreshness.assumption-review.reqRefs` und meldet eine Id, die keine REQ ist. `crRefs` hat am
  Annahmen-Review keinen Leser mehr; am Variantenvergleich bleibt es (TR-01).
- RC-05 liegt auf Stufe 10 und ist damit ohne eröffneten Bau fällig.

## Nachzug in graphcode

- `src/loop/task-artifact.ts`: die Einheit des Annahmen-Reviews ist eine REQ mit verifizierendem TEST (bisher: ein CR);
  der Stempel-Zug schreibt `reqRefs` (bisher `crRefs`).
- `src/loop/task-clause.ts`: das Vorbild des Annahmen-Reviews im Executor ist REQ + TEST + verify, ausdrücklich ohne CR.
- `src/projections/help-content.ts`: Hilfetext.
- Skill `se-irr` (Version 2): Schritt 3 zeigt die ganze Liste — auch die Annahmen mit geringem Risiko — und fragt,
  welche Anforderungen werden (Autor, 2026-10-06); die gewählten schreibt er als REQ mit TEST, Schritt 4 nennt sie
  unter `reqRefs`. Ohne Antwort schreibt er die tragenden.
- Skill `se-fmea` (Version 4): die Schritte „CR-FMEA-NNN anlegen" und „schließen" entfallen.
- `tests/generate.task.test.ts`, `tests/task-analysen.test.ts`; `docs/views/regel-matrix.{md,csv}` neu erzeugt.

## Nicht geändert

- Die Einheit der Fehleranalyse verlangt weiter einen Erfüller (satisfy) an der Risiko-Anforderung: Zur Zeit der
  Fehleranalyse gibt es die Wirkketten und Module schon, die das Risiko tragen.
- Altmodelle mit `crRefs` am Annahmen-Review laden weiter; der Eintrag ist ungelesen (vier Graphen im Bestand).
- Die Skilltexte in sigloch-modules (dort liegen fremde Änderungen im Baum).

## Abnahme

`verify:full CR-GC-754`: rot nur die zwei Link-Modus-Dateien (`distribution`, `lockfile-sync`), die bis zum Publish rot bleiben.
