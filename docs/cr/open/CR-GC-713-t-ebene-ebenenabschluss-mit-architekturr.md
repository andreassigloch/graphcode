# CR-GC-713: T-EBENE: Ebenenabschluss mit Architekturreview (Breite, Geschwister-Dubletten, Rand, Modul je Kind) und ebenenbeschraenkter Fokus

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-643 (idea)
**Erstellt:** 2026-09-28
**Item:** bok/items/ITEM-2026-643.json (Lane: code)

---

## Befund

Siehe Konzept, Abschnitt „Ebenenzyklus" (2026-09-28): ohne Ebenengrenze beantwortet das Modell
Inhaltsbefunde mit Architektur (10/12 MOD-Neuanlagen unter Inhalts-Fokus), füllt schmale Ebenen mit
Kopien auf (gcrun-342: 7 Klone), und der Treiber springt mit Fundfenstern über den ganzen Graphen.

## Ziel

**T-EBENE** nach dem Inhalt jeder Ebene: Breite (RD-04/05), Geschwister-Dubletten (T-KONS),
Geschwisterflüsse (IO-01/R-31/FC-04), Rand (RD-02, BW-02/R-04), Modul je Kind (bleibt im MOD des
Ankers oder eigenes MOD mit technischer Randbedingung). Zustand je Ebene (offen / abgeschlossen /
offen mit Grund); Rücksprung prüft den Rand des Elternteils. Die Ähnlichkeitsprüfung beim Anlegen
(Preflight) gilt für jeden Typ, nicht nur REQ/UC — 26 von 47 Dublettenpaaren lagen in verschiedenen Zweigen.

Hängt an CR-GC-711/712. Randbedingungen als Attribute am MOD sind Contracts-Sache (eigener CR, Familie).

## Akzeptanz

- S2-Runde, Zeile in `verlauf.md`: MOD nur unter T-EBENE entstanden; Dubletten unter Geschwistern 0;
  Gate-Durchgang der Modulzüge gegen 36 % (Pareto, `zuege.mjs`).
