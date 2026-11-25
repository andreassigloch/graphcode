# CR-GC-921: RTM — Ebene eindeutig aus der Herkunft, Erfueller als Spalte

**Status:** 🟠 Open — startet nach CR-GC-918 und CR-GC-920
**Typ:** aus Item ITEM-2026-1323 (idea)
**Erstellt:** 2026-11-12
**Item:** bok/items/ITEM-2026-1323.json (Lane: code)

---

**Bezug:** Analyse des Fachgespraechs vom 2026-11-10 („Traceability versteht man nicht mehr");
`SPIKE-GC-ein-erfueller-je-req-RESULTS` (graphanalyze/docs/spikes).
Entscheidung des Autors 2026-11-12: die Ebene einer Anforderung muss eindeutig sein.

## Befund

`reqLevels` (`src/projections/helpers.ts`) leitet die Ebene aus zwei verschiedenen Kanten ab:
`compose` sagt, woher die Anforderung kommt; `satisfy` sagt, wer sie erfuellt. Fast jede REQ hat beide,
also zwei Ebenen. Gezaehlt in `docs/views/rtm.md` am 2026-11-12: 26 von 202 REQ stehen auf einer Ebene,
176 auf zwei bis vier, 43 zugleich auf „System" und „Entwurf". Dieselbe REQ erscheint dann in
mehreren Abschnitten, und die RTM zeigt nicht, wo eine Anforderung zu Hause ist.

Die `satisfy`-Kante kam mit CR-GC-318 dazu, weil `compose` allein 68 REQ als „ohne Ebene" meldete.
Nach CR-GC-918 hat jede REQ genau einen Erfueller; als Spalte ist er eindeutig.

## Zielbild

1. **Ebene nur aus `compose`**, transitiv ueber REQ: SYS oder UC ergibt SYS.2, eine REQ unter einer
   REQ ist abgeleitet (SWE.1 / HWE.1). Die Bezeichnungen kommen aus der Zuordnungstabelle von
   CR-GC-920. Der `satisfy`-Zweig in `reqLevels` entfaellt.
2. **Spalte „erfuellt von"** mit dem einen Erfueller und seiner Ebene im Funktions- oder Modulbaum.
3. **Kopftabelle**: je Ebene Zahl der REQ, davon mit TEST, davon bestanden, und die gepaarte Teststufe.
4. **REQ ohne Herkunft** (kein `compose` von SYS, UC oder REQ) stehen in einem eigenen Abschnitt mit
   Zahl, statt still zu fehlen. Im Modell vom 2026-11-12: 8 REQ.

## Akzeptanz

- [ ] Jede REQ erscheint in genau einem Abschnitt der RTM (Test am erzeugten Markdown).
- [ ] Die Zahlen der Kopftabelle stimmen mit den Abschnitten ueberein (Test).
- [ ] Keine REQ mit zwei Ebenen; REQ ohne Herkunft im eigenen Abschnitt.
- [ ] `reqLevels` liest kein `satisfy` mehr; alle Aufrufer per grep umgestellt.
- [ ] `npm run verify:code` gruen, `rtm.md` neu erzeugt.

## Umfang

`src/projections/helpers.ts`, `src/projections/incose.ts`, `tests/exporter.test.ts` oder
`tests/views.auditor.test.ts`, `docs/views/rtm.md`.
