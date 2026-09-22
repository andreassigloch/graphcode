# CR-GC-592: Offene Fragen im Headless-Lauf: AskUserQuestion laeuft in claude -p ins Leere (3 von 5 Laeufen) — GRAPHCODE.md/se:generate sollen offene Punkte als Annahme ins Modell legen statt zu fragen, wenn niemand antwortet

**Status:** ✅ Umgesetzt
**Typ:** aus Item ITEM-2026-442 (idea)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-442.json (Lane: graph)

---

## 1 Befund

In 3 von 5 Claude-Code-Laeufen rief der Agent `AskUserQuestion` (z.B. „Ueber welchen Kanal willst
du benachrichtigt werden?“) — im Headless-Lauf (`claude -p`) antwortet niemand. Der Auftrag nennt
seine offenen Punkte ausdruecklich („Was ich noch nicht weiss“); gute Laeufe legten sie als offene
Grenze ins Modell (ACTOR `Ergebnissenke`, „Kanal noch offen“; Antwortzeit als konfigurierter
Zielwert). Das ist das gewollte Verhalten, nicht das Fragen.

## 2 Zielbild

`GRAPHCODE.md` (Scaffold) und `se:generate` sagen: eine offene Entscheidung des Auftraggebers
wird als **Annahme** ins Modell gelegt (Assumption Review / REQ mit offenem Zielwert / ACTOR mit
offenem Kanal) und in der Schlussmeldung genannt; gefragt wird nur, wenn ein Mensch antworten
kann. Wortlaut ueber das Register aus CR-GC-587.

## 3 Umfang

Scaffold-`GRAPHCODE.md`-Template, `.claude/commands/se/generate.md`, ein Texttest, dieser CR.

## 4 Kriterien

1. Gemessen wird mit dem Standardbericht (`report.mjs`, Abschnitte CR-GC-585 „Steuerung“ und CR-GC-586 „Auto gegen Hand“), Claude-Code-Arm, sigllm-Prosa-Korpus, n ≥ 2. Spalte „Rueckfragen“ = 0; die offenen Punkte des Auftrags stehen als Annahmen im Graphen.

## 5 Ergebnis (2026-09-22)

Register-Eintrag `openQuestions` (CR-GC-587), eingesetzt in `se:generate` (Schritt 1) und als
Abschnitt "When the brief leaves something open" in `GRAPHCODE.md` (`guardrailsContent`).
Abnahme in `tests/decision-texts.test.ts`. Kriterium 1 (Rueckfragen = 0 im Lauf) faellt mit dem
Phase-1-Lauf. **Kongruenz:** benannte Ausnahme.
