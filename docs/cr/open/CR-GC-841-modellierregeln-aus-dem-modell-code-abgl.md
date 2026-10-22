# CR-GC-841: Modellierregeln aus dem Modell-Code-Abgleich in die Skills

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1024 (finding)
**Erstellt:** 2026-10-22
**Item:** bok/items/ITEM-2026-1024.json (Lane: code)

---

## Befund

CR-GC-832..838 haben graphcodes Modell am Code nachgeprüft. Etwa 4 von 10 Flüssen in 25 Ketten nannten einen Weg, den kein Code geht. Jede Regel ließ sie durch. Die Ursache: das Modell entstand aus der Absicht („die Daten kommen aus dem Speicher"), danach bewegte sich der Code CR für CR. Jeder CR zog nur seine Knoten nach, die Flüsse der Nachbarn blieben stehen.

Die häufigsten Fehlerklassen:

| Fehler | Beispiel |
|---|---|
| Fluss überspringt das Werkzeug | Agent → Kernfunktion statt Agent → `graph_impact` → Kernfunktion |
| Antwort an den letzten Leser statt an den Aufrufer | Gate-Bericht direkt an den Agenten |
| „liest den Speicher", bekommt den Graphen aber als Argument | Speicher → fit-advisory |
| eine Kette mit mehreren Auslösern | repo-lifecycle: 5 Abläufe, 4 Auslöser |
| `sync` geraten oder fehlend | 43 Flüsse ohne Wert, 6 async, auf die gewartet wird |
| `realRef` auf einem Wrapper | `harness.importGraph` statt `importOntologyGraph` |
| Einstieg ohne FUNC | graph_generate, graph_merge, die npm-Spuren |
| Eigenschaft als Kette | modelfree-gate, interface-escalation |
| Anforderung verspricht mehr als ihr Test prüft | 10 REQ-Paare |

Dazu war `se:import-code` veraltet: der Text sagte „ersetzt den gesamten Graphen", seit CR-GC-527 ersetzt der Import nur seine eigenen Knoten.

## Änderung (Skills, ausgeliefert mit dem Paket)

- **`se:top-level` (Version 3):** neuer Abschnitt „Model the call path, not the data lineage" mit acht Regeln, je mit Gegenbeispiel aus diesem Repo. Dazu: über bestehendem Code von unten anfangen (`se:import-code` zuerst). Prüffrage 8: hat jeder Fluss eine Aufrufstelle?
- **`se:author-req` (Version 3):** der Text verspricht nur, was der TEST prüft.
- **`se:import-code` (Version 2):** Reseed-Text richtiggestellt (nur Knoten mit `origin: import-code`). Neuer Abschnitt „Danach: Ketten aus den Aufrufen bilden".
- **`se-vorbereitung` (Version 3):** neuer Schritt 4 „Flüsse am Code prüfen", vier Ergebnisse je Fluss (belegt, falscher Abnehmer, kein Aufruf, ohne Bindung). Der Bericht ist jetzt Schritt 5. Schritt 3 sagt, woran man synchron im Code erkennt.
- **`se-umbau` (Version 2):** ein Knoten mit geänderten Aufrufen zieht seine Flüsse im selben CR mit.
- `tests/skill-vorbereitung-felder.test.ts`: Versions-Pin 2 → 3.

## Umfang

relation-Kanten: `FUNC-se-top-level`, `FUNC-author-req`, `FUNC-import-code`, `FUNC-se-vorbereitung`, `FUNC-se-umbau`.

## Prüfung

- 13 Skill-Testdateien grün (skill-*, skills.mcp-conformance, policy-herkunft, vorspann).

## Offen

- Die Prüfung je Fluss bleibt Handarbeit am Code. Die mechanische Prüfung ist CR-GC-843.
