# CR-GC-536: Format-E: eine Beschreibung mit Zeilenumbruch erzeugt still PHANTOM-KNOTEN (die mehreren SYS) - Prio 1 unterbinden

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-183 (bug)
**Erstellt:** 2026-09-16
**Item:** bok/items/ITEM-2026-183.json (Lane: code)

---

PRIO 1, Entscheidung Auftraggeber 2026-09-16 (Variante A). Dieser CR faellt in ZWEI Repos: zuerst graph-api-core (der Defekt und die Konsolidierung), dann graphcode (der Fork in der Anwendung faellt weg, Modell zieht nach). Voraussetzung ist Stufe 1 - das contracts-Duplikat ist entfernt.

DER DEFEKT, reproduziert am lebenden Gate (graph_mutate dryRun, bok-Graph v49):
Eine Beschreibung mit Zeilenumbruch wird nicht nur abgeschnitten - die uebergelaufene Zeile wird zu einem EIGENEN KNOTEN, uid = der Resttext, Typ = die gerade offene "### <TYPE>"-Sektion.
- Probe SYS: Eingabe ein Knoten mit umbrechender Beschreibung. Ergebnis success TRUE, mutations 2, tier suggest - der Phantom-Knoten WAERE angelegt worden. Einzige Meldung: R-17 "has no compose traces (empty system)", eine Warnung, die nie blockt. Das ist die erinnerte Meldung "es wurden mehrere SYS-Knoten angelegt".
- Probe REQ: derselbe Ueberlauf, Phantom-Knoten ebenfalls erzeugt (appliedCommands 2), hier aber ZUFAELLIG aufgehalten - R-01 "REQ has no verification trace" ist ein error und blockte den Batch. Der Schutz ist ein Zufall der Regellage des Typs, kein Schutz.
- Nebenbefund: das inline-Attribut [__name:...] haftet am PHANTOM, nicht am gemeinten Knoten. Der echte Knoten verliert seinen Namen und meldet das als nameWarning - die Warnung zeigt auf das falsche Opfer.

MECHANISMUS (graph-api-core/src/format-e-codec.ts): parse() laeuft ueber input.split('\n') (:71). Die uebergelaufene Zeile ist keine @-Attributzeile, keine Sektion, kein '#'-Header und enthaelt kein '->', faellt also in den Knotenzweig (:131). Dort ist das Operator-Praefix OPTIONAL (parseNodeLine :207-208) und die uid ist alles vor dem Pipe, Leerzeichen eingeschlossen (:222). Kein Fehler wird gemeldet. Auf der Schreibseite geht der Umbruch roh hinaus: serialize schreibt `|${node.description}` ungefiltert (:174), ebenso graphcodes eigener encode (projections/codec.ts:151).

WO ES NICHT AUFTRITT: der JSON-commands-Pfad von graph_mutate. MutateCommandSchema hat description als z.string().optional() ohne Einschraenkung (contracts/src/harness/index.ts:43); ein Umbruch wird dort sauber gespeichert. Der Verlust entsteht ausschliesslich dort, wo Format-E die Form traegt - am formatE-Eingang (graphcode src/surface/write.ts:208) und in jeder Format-E-Projektion (graph_elements format formatE, graph_impact, graph_context).

ALTBESTAND: 0 mehrzeilige Beschreibungen in allen neun Familien-Graphen. Es gibt nichts zu migrieren; die Haertung ist reine Zukunftssicherung und kann sofort scharf gestellt werden.

KEINE LAENGENGRENZE (Entscheidung Auftraggeber 2026-09-16): die Laenge wird NICHT limitiert, sondern beobachtet. Ein langer Text an einer UC, REQ oder FUNC ist ein Hinweis auf fehlende Dekomposition - ein Signal fuer die Architekturarbeit, kein Formfehler, den ein Gate abweist. Gemessen: 374 Knoten ueber 300 Zeichen, davon 241 CR-Knoten. Die CR-Seite davon ist ITEM-2026-155 (CR-Knoten traegt nur eine Referenz), die Auslagerungs-Idee docRef liegt mit den Anti-Drift-Massnahmen im Backlog.

STUFE 2 - graph-api-core (zuerst):
a) HAERTEN. Knotenzeile: Operator-Praefix (+ - ~ !) verlangen; eine uid mit Leerzeichen ablehnen; jede Zeile, die keiner bekannten Form entspricht, als Fehler melden statt als Knoten zu deuten. Serialisieren: eine description mit Zeilenumbruch verweigern statt sie roh zu schreiben. Beide Enden sind noetig - nur lesend geprueft hiesse, der Text entsteht weiter kaputt.
b) UEBERNEHMEN, was heute nur graphcodes Fork kann und was REQ-deterministic-serialization verlangt: Knotensortierung je Typ, die Rundlauf-Felder __name/__createdAt/__updatedAt, und validate() vor dem Schreiben.
c) Die Faelle der vier geloeschten contracts-Testdateien landen hier oder sind als abgedeckt nachgewiesen.
Dateien: src/format-e-codec.ts plus tests/format-e-typed-sections, format-e-fanout, format-e-attr-hydration, format-e-agent-view. Die Deskriptor-Parametrisierung BLEIBT - loadFixture (test-fixtures.ts:145) parst mit TEST_ONTOLOGY und ist publiziert; graph-renderer haengt daran.

STUFE 3 - graphcode (danach):
GraphCodeCodec.encode faellt weg; die Klasse wird eine duenne Delegation an den Codec (decode ist es bereits, projections/codec.ts:257). Die Oberflaeche bleibt UNBERUEHRT: read.ts:269/321, write.ts:215, bootstrap.ts:107 und tool-context.ts:202 rufen nur encode/decode, und die Signaturen ueberleben. codec.validate() ruft seit CR-GC-200 niemand mehr aus dem Gate (gate.ts:136).
Dateien: src/projections/codec.ts plus tests/codec.roundtrip, codec.validation, mutate.edge-only-batch, mutate.formate-name.

MODELLZUG - NICHT IN DIESEM CR (Entscheidung Auftraggeber 2026-09-16, sicherste Variante): er laeuft als ITEM-2026-191 mit Lane graph im HAUPT-Arbeitsbaum, unmittelbar NACH der Integration dieses CR. Grund: Kuzu ist Single-Writer, und ein code-Lane-Arbeitsbaum hat keinen Store - der Zug wuerde dort entweder scheitern oder gegen einen fremden Stand laufen. Bis 191 gelaufen ist, ist die Modell-Drift die BENANNTE Ausnahme dieses CR (siehe Kriterium 6). Inhalt des Zuges: SCHEMA-format-e traegt realRef auf contracts/src/se/format-e-parser.ts - also auf die Implementierung, die mit Stufe 1 verschwindet. Nach dem Umbau auf den ueberlebenden Codec zeigen. FUNC-encode und FUNC-decode (beide realRef src/projections/codec.ts) neu beurteilen: encode delegiert nur noch. Das Modell trug uebrigens die richtige Absicht die ganze Zeit - REQ-formatE-parity sagt woertlich "single codec, no fork" und wird von vier TESTs verifiziert; der Code war davon weggelaufen, und weil sigloch-modules Format-E mit NULL Knoten modelliert, konnte keine Regel es sehen.

AKZEPTANZKRITERIEN:
1. Rot zuerst: ein Test, der eine description mit \n durch serialize schickt, faellt VOR dem Fix und ist nach dem Fix gruen. Ebenso einer, der eine uebergelaufene Zeile parst und einen FEHLER erwartet statt eines zweiten Knotens.
2. Gegenprobe am lebenden Gate: derselbe formatE-Block wie in der Reproduktion oben liefert nach dem Umbau einen Fehler; es entsteht KEIN zweiter Knoten. Mit dryRun belegen, Ausgabe in den CR.
3. In graphcode existiert keine eigene Format-E-Erzeugung mehr: grep nach '### ' und '|${' in src/projections/codec.ts ist leer.
4. Die volle Suite in graph-api-core und graphcode ist gruen; die Rundlauf-Zusicherung decode(encode(g)) deep-equals g gilt weiterhin, ebenso die Byte-Gleichheit zweier encode-Laeufe (REQ-deterministic-serialization).
5. loadFixture mit TEST_ONTOLOGY laeuft unveraendert - die Fremd-Ontologie ist nicht verloren gegangen.
6. Die Modell-Drift ist BENANNT, nicht stillschweigend: nach Stufe 1 zeigt SCHEMA-format-e.realRef auf eine geloeschte Datei. Das ist die bewusst offen gelassene Ausnahme dieses CR - RC-Urteil samt Bindungsquote hier notieren und ITEM-2026-191 (Lane graph, Haupt-Arbeitsbaum) als Aufloesung nennen. Ohne diesen Eintrag gilt der CR nicht als fertig.
