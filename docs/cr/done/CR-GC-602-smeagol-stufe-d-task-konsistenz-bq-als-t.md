# CR-GC-602: Smeagol Stufe (d) Task-Konsistenz + BQ als Teil von author-req: RULE_CLAUSE nur an Kern-Regeln, jeder Task-Skill existiert, jeder Eintrittspunkt ist Kern- und Gate-Regel, Abnahme je Task nur an eigenen Regeln; author-req traegt BQ-02/06-Schreibregel vorbeugend, Task anforderungsqualitaet faehrt mit se:author-req

**Status:** ✅ Done (2026-09-22)
**Typ:** aus Item ITEM-2026-455 (idea)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-455.json (Lane: graph)

---

## Umsetzung (2026-09-22)

**Smeagol Stufe (d) — Task-Konsistenz** (`tests/skill-rule-ids.test.ts`): RULE_CLAUSE nur an
Kern-Regeln (haette die FM-01-Klausel aus CR-GC-598 sofort gefangen); jeder Task hat einen
ausgelieferten Skill; jeder Eintrittspunkt ist Kern-Regel im Gate-Katalog und nicht info; Abnahme je
Task nur an eigenen Regeln, im Kern nur an Eintrittspunkten.

**BQ als Teil von `author-req`** (Entscheidung 2026-09-22, "nur wenn es nicht zu mehr Komplexitaet
fuehrt"): kein Kern-Fokus — Golden 150 BQ-Funde bei 80 REQs, Rewind 167 bei 89, das waere eine
Schleife. Stattdessen vorbeugend als Schreibregel im Skill (vereinbarte Form, messbarer Teil, wer/was/
unter welcher Bedingung — ohne Regel-IDs) und der Task `anforderungsqualitaet` faehrt mit
`se:author-req` fuer das Aufraeumen. Kein neuer Skill. **Kongruenz:** benannte Ausnahme.
