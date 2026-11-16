# CR-GC-920: A-SPICE-Darstellung der Anforderungs- und Teststufen

**Status:** 🟠 Open — Diskussion mit dem Autor vor der Umsetzung
**Typ:** aus Item ITEM-2026-1322 (idea)
**Erstellt:** 2026-11-12
**Item:** bok/items/ITEM-2026-1322.json (Lane: code)
**Folge-CR:** CR-GC-921 (RTM) nutzt die Zuordnung aus diesem CR.

---

**Bezug:** Analyse des Fachgespraechs vom 2026-11-10 (Gespraechspartner aus der Automobil-Systementwicklung;
Begriffe und Ebenen ohne Normbezug waren der Hauptgrund fuer 40 Minuten Missverstaendnis).
Normtext: Automotive SPICE PAM 4.0 (VDA QMC, 2023-12).

## Befund

Automotive SPICE erzeugt Anforderungen (Arbeitsprodukt 17-00) nur in SYS.1, SYS.2, SWE.1 und HWE.1.
Architektur (SYS.3, SWE.2) und Feinentwurf (SWE.3) sind keine Anforderungsebenen. Die Teststufen
verbinden je eine linke mit einer rechten Seite des V.

| Anforderung (links) | Quelle im Modell | Pruefung (rechts) |
|---|---|---|
| SYS.1 Stakeholder-Anforderung | ausserhalb des Graphen: Item, CR-Text, importiertes Dokument | VAL.1 Validierung |
| SYS.2 Systemanforderung | REQ unter SYS oder UC | SYS.5 Systemverifikation |
| — (SYS.3 Architektur) | FCHAIN, MOD der obersten Ebene als Erfueller | SYS.4 Integrationsverifikation |
| SWE.1 / HWE.1 abgeleitete Anforderung | REQ unter einer REQ, erfuellt von FUNC oder MOD | SWE.6 / HWE.4, darunter SWE.5 Komponente, SWE.4 Unit |

Heute weichen zwei Stellen davon ab:

- **Testuebersicht** (`docs/views/testconcept.md`, CR-GC-762): stimmt mit der rechten Seite ueberein.
- **RTM** (`docs/views/rtm.md`, CR-GC-317/318): nennt eine UC-Anforderung „funktional (SWE.1)"
  (richtig: SYS.2, der UC gliedert sie nur), fuehrt „Architektur (SYS.3 · SWE.2)" und
  „Entwurf (SWE.3)" als Anforderungsebenen und haelt MOD und FUNC auf einer Ebene, die Tests aber
  auf zwei Stufen.

Die Zuordnung steht zweimal im Code: `levelsOfTest` und `reqLevels` in `src/projections/helpers.ts`,
die Bezeichnungen in `src/projections/incose.ts`.

## Zur Diskussion (Entscheidung des Autors noetig)

1. **Ins Artefakt aufnehmen?** „Das Systemmodell in Bildern" (claude.ai) erklaert die Elemente ohne
   Normbezug. Eine V-Darstellung dort traegt die Zuordnung zu den Leuten, die das Modell lesen, nicht nur
   zu Pruefern. Dagegen: das Artefakt ist eine Erklaerung, keine Sicht aus dem Modell, und
   veraltet, wenn sich die Zuordnung aendert.
2. **Wo im Repo?** Als Kopf der Testuebersicht, als Kopf der RTM (CR-GC-921), oder als eigene Sicht.
   Eine eigene Sicht waere die fuenfzehnte.
3. **SYS.1 zeigen?** Die Zeile hat keinen Traeger im Graphen. Mit Verweis auf die Quelle
   (Item, CR, `import-doc`) oder weglassen.
4. **HWE zeigen?** Kein Modell der Familie modelliert heute Hardware als eigene Ebene; sirail hat
   Hardware-Module. Spalte immer zeigen oder nur, wenn ein MOD Hardware ist.

## Zielbild (nach der Diskussion festzulegen)

- **Eine** Zuordnungstabelle im Code (Anforderungsebene, Traeger im Modell, Teststufe), aus der
  Testuebersicht und RTM ihre Bezeichnungen lesen. Die zweite Stelle entfaellt.
- Die V-Darstellung an dem Ort, den der Autor waehlt, aus dem Modell erzeugt, mit Zahlen je Zeile.

## Akzeptanz

- [ ] Entscheidungen 1 bis 4 hier festgehalten.
- [ ] Eine Zuordnungstabelle im Code; `levelsOfTest` und die RTM lesen sie; ein Test prueft, dass
      keine Bezeichnung ausserhalb der Tabelle steht.
- [ ] Testuebersicht unveraendert in den Zahlen, Bezeichnungen aus der Tabelle.
- [ ] Wenn gewaehlt: Artefakt um die V-Darstellung ergaenzt, Normquelle genannt.

## Umfang (vorlaeufig)

`src/projections/helpers.ts`, `src/projections/incose.ts`, `tests/exporter.test.ts` oder
`tests/views.auditor.test.ts`, `docs/views/testconcept.md`; je nach Entscheidung das Artefakt.
