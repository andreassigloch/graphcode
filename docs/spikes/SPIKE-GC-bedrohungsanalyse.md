# SPIKE-GC-bedrohungsanalyse — trägt das FMEA-Schema eine Bedrohungsanalyse?

**Datum:** 2026-10-12 · **Item:** ITEM-2026-884 · **Stand:** Kandidat bestätigt, Messung nicht begonnen ·
**Daten:** graphcodes eigenes Modell (`docs/graph/graphcode.graph.json`, graphVersion 743, Commit
`49cda1a4`) · **Vorbild:** FMEA aus CR-GC-779, CR-GC-795, CR-GC-798, Sicht aus CR-GC-801, Nachtrag
CR-GC-802

## Frage

Lässt sich eine Bedrohungsanalyse (TARA, Threat Analysis and Risk Assessment) mit dem Schema der FMEA
führen: Risiko als Anforderung mit `role: risk`, Gegenmaßnahme, Träger, Nachweis, Sicht nach Priorität,
ohne die Ontologie zu ändern?

## Normenlage

Klauseln aus dem Gedächtnis, vor jedem Zitat am Normtext prüfen.

| Disziplin | Ursache | Norm | Bewertung |
|---|---|---|---|
| Funktionale Sicherheit (FMEA) | zufälliger oder systematischer Fehler | IEC 61508, ISO 26262, EN 50126/50129 | Schwere, Auftreten, Entdeckung |
| SOTIF | kein Fehler, unzureichende Spezifikation oder Leistung | ISO 21448 | bekannte und unbekannte Szenarien |
| Cybersecurity (TARA) | absichtlicher, lernender Angreifer | ISO/SAE 21434 §15, IEC 62443-3-2, CLC/TS 50701 | Schadenshöhe, Angriffsmachbarkeit |

- IEC 61508-1 §7.4.2.3: Die Gefährdungsanalyse schließt böswillige Handlungen ein; ist eine absehbar,
  folgt eine eigene Bedrohungsanalyse.
- ISO 26262-2 §5.4.2.3 und Anhang E: Kommunikationskanäle zwischen den Disziplinen, keine gemeinsame
  Analyse.
- ISO/SAE 21434: Safety ist eine von vier Schadenskategorien; die Schwere darf aus der Safety-Einstufung
  kommen.
- IEC TR 63069: Security schützt die Safety-Funktion; die Analysen bleiben getrennt.

**Folge für das Schema:** Die Folgenseite (Fehlerwirkung, Schwere) ist gemeinsam, die Ursachenseite
nicht. Ein Angreifer hat keine Häufigkeit, und Entdeckung ist eine Gegenmaßnahme, kein Bewertungsmaß.

## Kandidat

Vor der ersten Messung festgelegt, vom Autor bestätigt (siehe „Entschieden").

- **Analyseeinheit:** der Fluss an einer Akteursgrenze, also jeder FLOW mit einer `io`-Kante zu einem
  ACTOR. Bestand: 4 Akteure, 14 eingehende und 45 ausgehende Enden.

  | Akteur | eingehend | ausgehend |
  |---|---|---|
  | `ACTOR-agent` | 5 | 17 |
  | `ACTOR-owner` | 8 | 21 |
  | `ACTOR-dashboard` | 0 | 5 |
  | `ACTOR-learning-engine` | 1 | 2 |

- **Raster:** je eingehendem Fluss die sechs STRIDE-Klassen (Vortäuschen, Verfälschen, Abstreiten,
  Preisgabe, Verweigern, Rechteausweitung), je Klasse ein Urteil: Bedrohung oder „nicht anwendbar" mit
  Grund. Das sind 84 Urteile. Ausgehende Flüsse nur auf Preisgabe und Verweigern.
- **Im Modell:** Was eine Bewertung trägt, wird ein Risiko (wie CR-GC-802). Die Schwere bleibt, die
  Machbarkeit ersetzt das Auftreten.

| Prädikat | Messung | Schwelle |
|---|---|---|
| K1 Abdeckung | Urteile je eingehendem Fluss und Klasse | 84 von 84 |
| K2 Tragfähigkeit | Anteil der bewerteten Bedrohungen, die ohne neuen Element- oder Kantentyp durchs Gate gehen | 100 %; darunter ist die Lücke eine contracts-Frage |
| K3 Ort | Anteil der Bedrohungen, deren Ort ein vorhandener Knoten ist | ab 80 % trägt das Modell die Grenzen |
| K4 Gemeinsame Folge | Anteil der Bedrohungen, deren Folge ein bestehendes der 19 Risiken ist | keine Schwelle; entscheidet zwischen eigenem Risiko und zweiter Ursache am Bestand |

## Positivkontrolle und Gegenprobe

Die Analyse zählt nur, wenn sie zwei bekannte Fälle findet, die das Repo heute schon abwehrt:

- **Gate umgehen:** direkter Schreibzugriff auf den Graph-Snapshot (Verfälschen). Abwehr: Hook
  `.claude/hooks/deny-graph-write.sh` und das Apply-Gate.
- **Änderung ohne Spur:** rohes `harness.mutate()` am Werkzeug-Layer vorbei (Abstreiten). Abwehr:
  `graph_export` verweigert den Stand als fremden Überschreiber.

Gegenprobe: `FLOW-sse-frame` zum Dashboard ist nur lesend. Verfälschen und Rechteausweitung müssen dort
„nicht anwendbar" ergeben.

## Ablauf

1. **Kandidat bestätigt:** Bezugsrahmen, Skala, Schwellen, Umfang (siehe „Entschieden").
2. **Messen am eingefrorenen Stand:** die 84 Urteile gegen graphVersion 743, Positivkontrolle und
   Gegenprobe zuerst.
3. **Den echten Graphen ändern:** die bewerteten Bedrohungen über `graph_mutate`, in einem eigenen CR.
4. **Sicht prüfen:** `docs/views/fmea.md` mit Bild. Trägt die Sicht Bedrohungen neben Fehlerarten, oder
   braucht es eine eigene?
5. **Kennzahlen prüfen:** `rules_evaluate` (Katalogregeln FM-02, FM-03), `graph_readiness`, K1 bis K4.
6. **Entscheidung** des Autors.

## Was der Spike entscheidet

- Bedrohung als Merkmal am bestehenden Risiko oder als eigener Typ (dann contracts, Familie-Review).
- Ob `actionPriority()` aus `@sigloch/contracts/se` mit Machbarkeit statt Auftreten eine brauchbare
  Reihenfolge liefert, oder ob Bedrohungen eine eigene Prioritätsrechnung brauchen.
- Eigene Sicht oder ein Abschnitt in `fmea.md`.
- Ob ein Skill `se-tara` lohnt.

## Entschieden

Autor, 2026-10-12: „laut deinen Empfehlungen".

- **Bezugsrahmen:** IEC 62443-3-2 mit STRIDE je Fluss.
- **Skala der Machbarkeit:** Angriffspotenzial nach ISO/SAE 21434 Anhang G (Zeit, Expertise,
  Systemkenntnis, Zugangsfenster, Ausrüstung), abgebildet auf 1 bis 10.
- **Schwellen:** K1 bis K4 wie in der Tabelle oben.
- **Lieferkette im Umfang.** Registry-Pakete, importierte Dokumente und importierter Code sind
  Angriffswege, aber keine Akteure im Modell. Sie werden als drei zusätzliche Quellen beurteilt, zählen
  in K3 und nicht in K1. Vermutung, nicht geprüft: K3 fällt an genau diesen Stellen.
  *Auslegung des Agenten:* Zu diesem Punkt lag keine ausdrückliche Empfehlung vor, nur die Vermutung.

## Nicht Teil

- Prozess-Audit nach ISO/SAE 21434 §5 oder ISO/PAS 5112, Penetrationstest.
- Änderung an `@sigloch/contracts`, neuer Skill, neue Sicht. Das sind Folge-CRs aus der Entscheidung.
- Konformität zum Cyber Resilience Act der EU.

## Offen

- Ob IEC 60812 oder das AIAG-VDA-Handbuch Angriffe ausdrücklich ausschließen.
- Stand von IEC 63452, dem Nachfolger der CLC/TS 50701.
- Was mit `detection` geschieht: Das Feld gehört zur FMEA-Bewertung, eine Bedrohung hat kein Gegenstück.
