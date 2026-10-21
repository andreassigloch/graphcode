# CR-GC-824: Optimierungs-Skill fuer die oberste Modulebene: Fragen zu Linienstaerke, Fremdkoerper je Modul, Ein-/Ausgangscluster, Gegenprobe im FUNC-Baum

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-985 (idea)
**Erstellt:** 2026-10-21
**Item:** bok/items/ITEM-2026-985.json (Lane: code)

---

## Befund (Sitzung 2026-10-21)

Die Prüfung der obersten Modulebene lief als Fragenfolge im Chat: Linienstärke, Fremdkörper,
Kopplung der Akteure, zu kurze Ketten, Funktionen ohne Ein- oder Ausgang, Flüsse mit vielen
Abnehmern. Sie fand drei Modellfehler (CR-GC-823) und einen Umzug (ITEM-2026-984). Der Auftraggeber
will die Fragen als Skill, zunächst als Entwurf.

## Umsetzung

- `.claude/commands/se-modulebene.md`, Version 0 (Entwurf): acht Schritte. Ausgangsstand, Linienstärke
  je Modulpaar (`CR-01`), Fremdkörper, Kopplung der Akteure, zu kurze Ketten, Funktion ohne Ein-/Ausgang,
  Flüsse mit vielen Abnehmern, Ergebnis. Modellfehler zuerst und getrennt; Vorschläge in der festen Form
  von `se:optimize` (Quelle a). Rechnet nichts, wendet nichts an.
- `tests/skill-modulebene-felder.test.ts`: jede genannte Regel steht im Katalog, jedes aufgerufene Werkzeug in
  der Registry des Hosts, jedes Feld in `ModuleMetrics`/`ChainMetrics`; ein erfundener Name fällt auf.
- Entwurf wird nicht ausgeliefert: `shippedSkillFiles()` lässt Skills mit `version: 0` aus. Sie laufen in
  diesem Repo und gehen mit Version 1 an die Familie. Anlass: der Entwurf schob `GRAPHCODE.md` über die Grenze
  von 6 000 Zeichen (`tests/vorspann.test.ts`). `tests/cli.scaffold.test.ts` führte eine eigene Kopie der
  Auflistung; sie liest jetzt `shippedSkillFiles()`.
- `scripts/model-test-set.mjs`: der neue Test steht mit Grund unter EXCLUDED.
- Modell: `FUNC-se-modulebene` (agent-surface, Urteilsarbeit, FCHAIN-skill-report — er liest und schreibt nicht),
  `FLOW-anleitung-se-modulebene`, `REQ-modulebene-reads-and-separates` mit `TEST-modulebene-reads-and-separates`.

## Bewusst offen

- Version 0: noch an keinem fremden Repo gelaufen. Der erste echte Lauf entscheidet über Version 1.
- `MOD-agent-surface` hat jetzt 31 Funktionen auf einer Ebene (`RD-04`, vorher 30).
