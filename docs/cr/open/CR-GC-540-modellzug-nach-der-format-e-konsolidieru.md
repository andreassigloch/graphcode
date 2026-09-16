# CR-GC-540: Modellzug nach der Format-E-Konsolidierung: SCHEMA-format-e und FUNC-encode neu binden (Lane graph, nach der Integration)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-191 (finding)
**Erstellt:** 2026-09-16
**Item:** bok/items/ITEM-2026-191.json (Lane: graph)

---

ENTSCHEIDUNG Auftraggeber 2026-09-16 ('so wie es am sichersten ist'): der Modellzug aus ITEM-2026-183 wird aus CR-SM-332/CR-GC-536 HERAUSGELOEST und laeuft als eigenes Item mit Lane graph im Haupt-Arbeitsbaum, unmittelbar nach der Integration der beiden CRs.

ROOT CAUSE der Trennung: Kuzu ist Single-Writer, ein Prozess haelt den Store exklusiv (belegt in ITEM-2026-136: pid 89706 hielt .graphcode/kuzu, ein zweites host wurde abgewiesen). Eine code-Lane bekommt einen frischen Arbeitsbaum OHNE Store. Ein Modellzug in der code-Lane hat deshalb zwei moegliche Ausgaenge, beide schlecht: er scheitert am fehlenden Store, oder er laeuft gegen den Stand des Haupt-Arbeitsbaums, waehrend der Code der Lane noch nicht integriert ist - das Modell zeigte dann auf eine Datei, die im Hauptzweig noch existiert oder schon nicht mehr. Die Trennung macht die Reihenfolge explizit: erst landet der Code, dann zieht das Modell nach.

UMFANG DES ZUGES:
1. sigloch-modules: SCHEMA-format-e traegt realRef auf contracts/src/se/format-e-parser.ts. PRAEZISIERT nach der Umsetzung von CR-SM-331 am 2026-09-16: die Datei wurde NICHT geloescht - sie traegt weiter extractFormatE und die Attribut-Hydration, der Parser ist raus. Die Referenz loest also auf und ein Existenz-Pruefer meldet gruen, waehrend der Knoten etwas beschreibt, das dort nicht mehr steht. Neu auf den ueberlebenden Codec binden (graph-api-core/src/format-e-codec.ts).
2. graphcode: FUNC-encode und FUNC-decode (beide realRef src/projections/codec.ts) neu beurteilen - encode delegiert nach CR-GC-536 nur noch, die Frage ist, ob der Knoten die Funktion noch traegt oder in eine Delegation zusammenfaellt.
3. sigloch-modules modelliert Format-E heute mit NULL Knoten. Genau deshalb konnte keine Regel die Duplikation sehen, obwohl REQ-formatE-parity woertlich 'single codec, no fork' verlangt und von vier TESTs verifiziert wird. Ob dieser Zug die Luecke schliesst (MOD/FUNC fuer den Codec anlegen) oder nur die Bindung repariert, ist Teil der Entscheidung vor dem CR.

VORBEDINGUNG: CR-SM-331, CR-SM-332 und CR-GC-536 sind integriert. Vorher nicht starten - die Bindung waere sonst auf einen Stand gerichtet, den es im Hauptzweig noch nicht gibt.

ABNAHME: graph_readiness meldet fuer beide Repos kein RC-Defizit aus dieser Ecke; SCHEMA-format-e.realRef loest auf eine existierende Datei auf; die Bindungsquote ist im CR ausgewiesen, nicht nur das Urteil.

RETARGET 2026-09-16, gemessen statt vermutet: SCHEMA-format-e liegt NICHT im sigloch-modules-Modell, sondern im GRAPHCODE-Modell (dessen realRef auf einen sigloch-modules-Pfad zeigt — eine Bindung, die im eigenen Repo nie aufloesen kann). Das sigloch-modules-Modell hat 67 Elemente und KEIN einziges, dessen id oder name 'format' enthaelt. Punkt 1 und 2 des Umfangs sind damit beide graphcode-Arbeit; Punkt 3 (Format-E in sigloch-modules ueberhaupt modellieren) ist neue Architekturarbeit, kein Bindungsfix — er wird als eigenes Item gefuehrt (ITEM-2026-204), nicht hier mitgenommen.
