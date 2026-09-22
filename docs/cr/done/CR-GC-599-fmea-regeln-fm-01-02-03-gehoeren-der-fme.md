# CR-GC-599: FMEA-Regeln (FM-01/02/03) gehoeren der FMEA, nicht der Generierungsschleife: S/O/D am REQ setzt ausschliesslich se-fmea (Entscheidung 2026-09-22). Schleife sieht nur AF-04 (FMEA fehlt); FM-01-Klausel aus CR-598 zurueck, FM-03 aus der abnehmbaren Klasse

**Status:** ✅ Done (2026-09-22)
**Typ:** aus Item ITEM-2026-451 (idea)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-451.json (Lane: graph)

---

## Entscheidung (2026-09-22, Auftraggeber)

S/O/D am REQ setzt ausschliesslich die FMEA (`se-fmea`). Der Generierungs-Agent darf sie nicht
setzen. Damit gehoeren FM-01/02/03 nicht in die Generierungsschleife.

## Umsetzung

- `focus-set.ts`: `ARTEFAKT_EIGENE_REGELN` = {FM-01, FM-02, FM-03}, nie im Fokus. Eintrittspunkt
  bleibt AF-04 ("FMEA fehlt", abnehmbar im schlanken Scope).
- FM-03 aus `ABNEHMBARE_REGELN` (nicht mehr im Fokus, also nichts abzunehmen).
- Die FM-01-Regel-Klausel aus CR-GC-598 ist zurueckgenommen — sie forderte den Agenten genau zu dem
  auf, was er nicht darf. Der zweite Rewind mit ihr wurde vor dem Ende gestoppt.
- `se:generate`: "FMEA-Bewertungen setzt nur se-fmea"; Liste der abnehmbaren Regeln nachgezogen.
- Golden-Test: offene Liste jetzt {AF-05, BW-02, MS-01, RD-05}.

**Prinzip fuer spaeter:** Detailregeln eines Analyse-Artefakts gehoeren dem Skill, der es erstellt;
die Schleife sieht nur die AF-Regel. Kandidat derselben Klasse: CL-01 (ConOps-Vollstaendigkeit).
**Kongruenz:** benannte Ausnahme.
