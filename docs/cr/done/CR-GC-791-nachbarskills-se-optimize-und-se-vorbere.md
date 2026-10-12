# CR-GC-791: Nachbarskills se:optimize und se-vorbereitung auf den Antwortweg nachziehen

**Status:** ✅ Done (2026-10-12)
**Typ:** aus Item ITEM-2026-842 (finding)
**Erstellt:** 2026-10-12
**Item:** bok/items/ITEM-2026-842.json (Lane: code)

---

se:optimize v4 (.claude/commands/se/optimize.md) und se-vorbereitung v1 (Schritt 3) nennen den Antwortweg noch als kuenftige Kennzahl; die Tests sichern den alten Wortlaut ab (tests/skill-optimize-vorlage.test.ts, tests/skill-vorbereitung-felder.test.ts). se:optimize nennt als Quelle eines Vorschlags nur se-fmea; seit CR-GC-783 gibt es se-laufzeit als zweite. Seit CR-GC-783 liefert graph_metrics answerPath und answerPathBlockedBy je Kette. Umfang: beide Skills richtigstellen, Versionssprung je Skill, Tests nachziehen; se-vorbereitung liest answerPathBlockedBy als Liste der Fluesse, an denen das Merkmal fehlt oder die Kette offen ist; in der Vorlage Gesamt-Impact steht der Antwortweg davor und danach (danach aus metricsAfter.chains). Dazu in CR-GC-785 der Abschnitt Offener Punkt: erledigt mit CR-GC-790.

---

## Umfang laut `graph_impact`

Geändert werden zwei Skill-Texte; ihre Knoten sind `FUNC-se-optimize` und `FUNC-se-vorbereitung`. An ihnen
hängen `REQ-optimize-probes-and-presents` mit `TEST-optimize-presents-impact` und
`REQ-vorbereitung-reads-metrics` mit `TEST-vorbereitung-reads-metrics`. Kein Fluss, keine Kette und keine
Zuordnung ändert sich; kein Quellcode.

## Umsetzung (2026-10-12)

**`se:optimize` Version 5** (`.claude/commands/se/optimize.md`)
- Quelle (a) nennt beide Analysen: Abschnitt „Architekturvorschläge" bei `se-fmea`, „Vorschläge" bei `se-laufzeit`.
- Schritt 2: `answerPath: null` an einem Vorschlag, dessen Prognose etwas über den Antwortweg sagt: keine
  Probe, Verweis auf `se-vorbereitung` mit den Flüssen aus `answerPathBlockedBy`.
- Schritt 3: die Zeile „Antwortweg" liest `answerPath` und `answerPathBlockedBy` je Kette (vorher „noch keine
  Kennzahl").
- Schritt 5: der Antwortweg steht in der Vorlage davor und danach, danach aus der Zeile der Kette in
  `metricsAfter.chains`. Er steht nicht mehr unter „offen bis zum Nachmessen".

**`se-vorbereitung` Version 2** (`.claude/commands/se-vorbereitung.md`)
- Schritt 3 liest `answerPathBlockedBy` als Liste seiner Arbeit: je Fluss einer von zwei Gründen (Merkmal
  nicht lesbar: kennzeichnen; `sync` von einer Funktion außerhalb der Kette: Kette offen, zurück zu
  Schritt 1). Die Liste nennt nur die Hindernisse auf dem Weg; nach jedem Zug neu lesen, bis sie leer ist.
- Bericht und Prüfliste führen den Antwortweg statt einer eigenen Liste „Flüsse ohne Merkmal".

Die `description`-Zeilen beider Skills sind unverändert (Zeichengrenze des Vorspanns `GRAPHCODE.md`).

**Tests:** `tests/skill-optimize-vorlage.test.ts`, `tests/skill-vorbereitung-felder.test.ts`. Sie binden die
neuen Aussagen an `chainMetrics` und an die Antwort des Trockenlaufs (die Zeile in `metricsAfter.chains`
trägt `answerPath`).

**Dazu:** `docs/cr/open/CR-GC-785-*.md`, Abschnitt „Offener Punkt": Zeile „erledigt mit CR-GC-790".

**Modell:** Beschreibungen von `FUNC-se-optimize`, `FUNC-se-vorbereitung` und der beiden TEST-Knoten
nachgezogen; `relation`-Kanten des CR-Knotens auf die beiden Funktionen.

## Abnahme

- Die fünf Skill- und Vorspann-Tests grün (`skill-optimize-vorlage`, `skill-vorbereitung-felder`,
  `skill-laufzeit-antwortweg`, `skills.mcp-conformance`, `vorspann`).
- `npm run verify:full CR-GC-791`: 185 von 187 Dateien grün. Rot: `tests/distribution.test.ts` und
  `tests/lockfile-sync.test.ts` (Link-Modus und gehobener Peer-Floor aus CR-GC-786, erwartet bis zum Release
  von contracts 12.5.0). Das Protokoll zählt beide als Schlupf (Spur CODE, Auswahl 52 von 187): sie liegen
  außerhalb der Auswahl dieses CR, sind aber nicht von ihm verursacht.

## Offen

- Ob der auslösende Befehl eines Glieds als Warten zählt, ist nicht Gegenstand dieses CR (Entscheidung des Autors).
- CR-GC-782/784/785/787 bleiben offen bis zum Release.
