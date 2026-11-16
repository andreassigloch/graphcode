# SPIKE-GC: Ein Erfüller je Anforderung

**Status:** Abgeschlossen 2026-11-12 — Ergebnis: [`SPIKE-GC-ein-erfueller-je-req-RESULTS.md`](SPIKE-GC-ein-erfueller-je-req-RESULTS.md)
**Batches:** [`SPIKE-GC-ein-erfueller-je-req.fe`](SPIKE-GC-ein-erfueller-je-req.fe)
**Anlass:** Analyse des Fachgesprächs vom 2026-11-10 (Anforderung und Lösung getrennt halten), A-SPICE-Abgleich der RTM.

## 1. Frage

Die Aussage des Autors: Eine Anforderung hat genau einen Erfüller. Kann keine einzelne Funktion sie
erfüllen, erfüllt sie das nächsthöhere Element, etwa die Wirkkette, aber immer genau eines. Sonst gibt
es keinen eindeutigen Prüfgegenstand.

Zu prüfen:

1. Lässt sich jede REQ mit mehreren Erfüllern im graphcode-Modell auf genau einen Erfüller bringen,
   ohne die Grammatik zu ändern (keine funktionale REQ an einer FCHAIN)?
2. Wo das Zerlegen nicht passt: ist die REQ dann eine NFR oder eine Mischung?
3. Sind die betroffenen REQ nach `se:author-req` v4 (EARS, Subjekt = Erfüller, Zahl mit Einheit,
   Mischung trennen, Text verspricht nur, was der Test prüft) gute Anforderungen?

## 2. Literatur

Die Aussage ist gestützt, wenn man sie über Subjekt und Prüfgegenstand liest:

- INCOSE GtWR v4, C2 „Appropriate": Absicht und Detailgrad passen zur Ebene des Elements, das die
  Anforderung beschreibt; eine Anforderung hat ein Subjekt.
- NASA SE Handbook: eine Anforderung wird mindestens einem Element der nächsten Ebene zugeordnet,
  über abgeleitete Kind-Anforderungen; jede Kind-Anforderung hat wieder ein Subjekt.
- Automotive SPICE PAM 4.0: SYS.4 prüft das Zusammenspiel integrierter Elemente, SYS.5 das System.
  Was nur im Zusammenspiel entsteht, hat den Verbund als Prüfgegenstand.
- SysML `satisfy` erlaubt mehrere Erfüller; die Notation legt dafür keine Regel fest.

## 3. Vorgehen

- Modellkopie aus `HEAD:docs/graph/graphcode.graph.json` (7e46c55b) in einem Wegwerf-Verzeichnis,
  eigener Store; die Arbeitskopie des Repos war durch eine parallele Sitzung belegt.
- Alle Züge über die Werkzeugschicht (`bindToolsToHarness`, `graph_mutate`), erst Trockenlauf,
  dann angewandt, danach `graph_export` und `rules_evaluate` über das ganze Modell.
- BQ-Regeln direkt aus `@sigloch/contracts/se` (`evaluateBQRules`), weil sie nur als Aufgabe
  `anforderungsqualitaet` laufen.
- Jede der 40 REQ von Hand gelesen und eingeordnet.
