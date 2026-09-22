# CR-GC-594: Abnahme-Politik: acceptedFindings zaehlt nur fuer Regeln, die im Modell nicht erfuellbar sind (Code, Testlauf, Auftraggeber-Entscheidung: FM-03, AF-*, MS-01/03, CL-01, Praesenz R-19/20/26/27/32); Architekturregeln sind heute von niemandem abnehmbar (Entscheidung 2026-09-22); Guide/Skill/Prompt nennen die Klasse

**Status:** ✅ Done (2026-09-22)
**Typ:** aus Item ITEM-2026-445 (idea)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-445.json (Lane: graph)

---

## 1 Entscheidung (2026-09-22, Auftraggeber)

Das Attribut `acceptedFindings` (CR-SM-349) war bewusst noch nicht eingefuehrt, um den einfachen
Ausweg aus der Architekturarbeit zu verschliessen. Jetzt gilt der Mittelweg:
- **abnehmbar** ist nur, was im Modell nicht erfuellbar ist: Testlauf (FM-03), Code und Bindung
  (R-19, R-20, R-26, R-32, CR-R01), im schlanken Scope optionale Artefakte (AF-01..05),
  Auftraggeber-Entscheidung (MS-01, CL-01);
- **Architekturregeln** sind heute von niemandem abnehmbar, auch nicht vom Menschen. Das
  Freischalten fuer den Menschen ist ein eigener, spaeterer Zug.

## 2 Umsetzung

- `decisions.ts`: `ABNEHMBARE_REGELN` als Daten, Registersatz `acceptance` daraus abgeleitet.
- `generate.ts`: die Fokusmenge laesst eine Abnahme nur fuer diese Klasse gelten; an einer
  Architekturregel wird sie ignoriert, und der Prompt sagt es ("Die Abnahme von X zaehlt nicht").
  Steht der Fokus auf einer abnehmbaren Regel, nennt der Prompt die Abnahme — zum Zeitpunkt der
  Entscheidung, nicht nur im Skill.
- `graph_authoring_guide`: `acceptedFindings` an jedem Typ, `enumValues` = die abnehmbare Klasse.
- `se:generate`: Registersatz woertlich plus "nenne jede Abnahme in der Schlussmeldung".

## 3 Folge fuer das Golden

Mit Abnahmen an AF-05, FM-03, MS-01 bleibt es **nicht** done: BW-02 und RD-05 sind Architektur.
Das ist die ehrliche Aussage ueber den Handlauf; der Eigenschaftstest haelt sie fest.

## 4 Tests

`generate.statemachine.test.ts` (abnehmbare verschwinden, Architektur bleibt, ignorierte Abnahme
im Prompt, Hinweis bei abnehmbarem Fokus), `decision-texts.test.ts` (Skill woertlich, Guide an jedem
Typ mit der Klasse, keine Steuer-/Strukturregel abnehmbar). **Kongruenz:** benannte Ausnahme.
