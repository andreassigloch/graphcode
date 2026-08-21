# CR-GC-328 — Lauf-Stempel und Evidenzpfad am TEST (die geparkte Hälfte von CR-GC-327)

**Status:** draft — zurückgestuft 2026-08-21: §2.1 (Stempel am Knoten vs. aus dem Trail) und §2.2 („was ist veraltet") sind unentschieden, ohne sie ist der CR per eigener Ansage nicht implementierbar. §2.3 ist upstream beantwortet: `evidence` ist ein Feld im `TestRefSchema` (contracts), von graphcode noch nicht genutzt.
**Ziel:** graphcode 0.13.x
**Ontologie:** v4.0.0 — **Änderung nötig** (siehe §3; contracts-CR ist Vorbedingung)
**Bezug:** [CR-GC-327](../done/CR-GC-327-pruefreport-testresult-rueckweg.md) (Rückweg, done),
CR-SM-227/CR-GC-300 (Freshness-Stempel als Muster), CR-GC-311 (`graph_timetravel`)

---

## 1. Was CR-GC-327 offen gelassen hat

CR-GC-327 hat den Rückweg gebaut: `graph_test_ingest` schreibt `testResult` über das Gate,
`graph_test_report` gibt je REQ Kante **und** Ergebnis heraus, die VCRM trennt beides. Zwei
Anforderungen desselben CR sind bewusst **nicht** umgesetzt worden, weil beide ein neues
Ontologie-Feld brauchen und CR-GC-327 sich ausdrücklich verbietet, so etwas nebenbei einzuführen:

| offen | warum es nicht nebenbei geht |
|---|---|
| **Lauf-Stempel** (Zeitpunkt + `graphVersion` des Laufs) am TEST | neues Feld am TEST → contracts-Version-Bump + Familie-Review |
| **Evidenzpfad** (Screenshot, Messprotokoll) am TEST | dito |

**Der Stempel ist heute nicht ersatzlos weg.** Entscheidung 2026-08-12: ein neuer Lauf
**überschreibt**; der frühere Stand steht in der Historie (Audit-Trail / `graph_timetravel`,
CR-GC-311), inklusive der `graphVersion`, gegen die der Ingest lief. Was damit **nicht** geht: die
Frage „ist DIESES Ergebnis veraltet?" pro Knoten in einer Antwort zu beantworten, ohne den Trail zu
durchsuchen. Genau das ist der Grund für diesen CR — und der Grund, ihn getrennt zu entscheiden:
ein Stempel am Knoten ist Datenhaltung, die Historie ist Datenhaltung, und beides parallel wäre ein
zweiter Wahrheitsort.

---

## 2. Zu entscheiden (nicht zu implementieren, bevor entschieden ist)

1. **Stempel am Knoten oder abgeleitet aus dem Trail?** Am Knoten = eine Abfrage, aber ein zweiter
   Ort derselben Wahrheit. Aus dem Trail = eine Wahrheit, aber eine Suche über die Commands je
   TEST. Ohne diese Entscheidung ist jede Implementierung eine Vorwegnahme.
2. **Was ist „veraltet"?** `graphVersion` beim Lauf < aktuelle `graphVersion` ist zu scharf — jede
   unbeteiligte Mutation entwertete dann jedes Ergebnis. Brauchbar wäre „der verifizierte REQ oder
   sein realisierender FUNC hat sich seit dem Lauf bewegt", und das ist eine Impact-Frage, keine
   Zählerfrage.
3. **Evidenz: ein Feld oder ein Element?** Ein Pfad-String am TEST ist billig und trägt keine
   Semantik (kein Typ, keine Prüfung, ob die Datei existiert). Ein eigenes Element wäre
   ontologisch sauber und ein Meta-Modell-Eingriff.

---

## 3. Vorbedingung

Ein contracts-CR in `sigloch-modules` (Muster: `AnalysisFreshnessStampSchema`, CR-SM-227) —
additiv, minor. Er wird erst geschrieben, wenn §2 entschieden ist; sonst zementiert die
Schema-Form eine Entscheidung, die noch offen ist.

---

## 4. Akzeptanzkriterien (aus CR-GC-327 übernommen)

- [ ] Ein Ergebnis, das gegen einen älteren Stand gelaufen ist, ist als veraltet erkennbar —
      nach der in §2.2 festgelegten Definition, nicht nach „Zähler ist gewachsen".
- [ ] Ein TEST kann seinen Nachweis (Screenshot, Messprotokoll) tragen, und der Prüfreport gibt
      ihn heraus.
- [ ] `npm run build` + volle Suite grün.

@author andreas@siglochconsulting
