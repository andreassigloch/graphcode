# SPIKE-GC: Ein Erfüller je Anforderung — Ergebnis

**Stand:** 2026-11-12, Modell HEAD 7e46c55b, contracts 12.12.0 (RULES 50.0.0), graphcode 0.38.0.
**Frage und Vorgehen:** [`SPIKE-GC-ein-erfueller-je-req.md`](SPIKE-GC-ein-erfueller-je-req.md)

## 1. Kernbefund

Alle 40 REQ mit mehreren Erfüllern ließen sich auf genau einen Erfüller bringen. Das Gate nahm alle
drei Batches ohne Fehler an. Keine funktionale REQ musste an eine Wirkkette. Die Grammatik bleibt
wie sie ist.

| Messgröße | vorher | nachher |
|---|---|---|
| REQ | 200 | 255 |
| REQ mit mehr als einem Erfüller | 40 | 0 |
| REQ unter SYS/UC, unzerlegt, von tieferer FUNC/MOD erfüllt (Sprung) | 57 | 37 |
| Befunde gesamt (`rules_evaluate`) | 799 | 911 |
| davon R-02 „FUNC must satisfy REQ" | 0 | 29 |
| davon R-21 „Übergabe braucht Ketten-REQ oder Integrationstest" | 1 | 78 |
| BQ-02 / BQ-03 | 67 / 6 | 69 / 6 |

Die Befunde steigen, weil die Sammel-REQ Lücken verdeckt hatten. 29 Funktionen haben keine eigene
Anforderung; sie hingen nur an einer REQ, die eigentlich eine andere Funktion oder eine Menge
beschreibt.

## 2. Einordnung der 40 Fälle

| Klasse | Anzahl | Korrektur | Beispiel |
|---|---|---|---|
| Mischung mehrerer Zusagen, teils als Kettenfolge | 24 | in Kind-REQ zerlegen, je Kind ein Erfüller | `REQ-steering-from-metrics`: messen, Stufe nennen, ranken, ans Gate, dazu „deterministisch" als NFR an `FCHAIN-steering-loop` |
| Einschränkung über eine Menge | 4 | Art auf non-functional, ein Erfüller: kleinstes gemeinsames Element | `REQ-skill-authors-through-gate`: 17 Skill-FUNCs → `MOD-agent-surface` |
| NFR mit mehreren Erfüllern | 4 | ein Erfüller: SYS oder die Kette | `REQ-gate-only-writes`: 4 MOD → `SYS-graphcode` |
| Hilfsfunktion als Miterfüller | 6 | Kante streichen | `REQ-query-precision`: `graph_impact` erfüllt, Leseschicht und Autorenhilfe nicht |
| gemeinsam genutzte Code-Funktion ohne FUNC-Knoten | 1 (+1 in einer Mischung) | FUNC anlegen, sie erfüllt | `laufUrteil` und `meldeZurueck`, beide von verify:code und verify:full genutzt |
| falsche Art, umgekehrt | 1 | NFR → functional | `REQ-rule-calibration` beschreibt, was `audit_stats` liefert |

Die Prüffrage, die sich bewährt hat:

1. Hätten die Kind-REQ denselben Text? Dann ist es eine Einschränkung über eine Menge (NFR), oder es
   fehlt eine gemeinsam genutzte Funktion im Modell. Im Code nachsehen, welches von beiden.
2. Beschreibt der Text eine Folge von Schritten? Dann entlang der Kette zerlegen; Güte (Zeit,
   Determinismus) geht als NFR an die FCHAIN.
3. Nennt der Text mehrere Zusagen? Dann je Zusage eine Kind-REQ.
4. Erfüllt ein Miterfüller nur einen Zwischenschritt? Dann die Kante streichen.

## 3. Anforderungsqualität (se:author-req v4)

Die BQ-Regeln finden die Mängel dieser 40 REQ fast nicht: BQ-03 „Singular" meldet keine der 24
Mischungen, weil sie über Modalverben zählt und die Texte als Aufzählung geschrieben sind. BQ-02
meldet 5, alle NFR ohne Zahl. Die Mehrfacherfüllung erkennt die Mischung strukturell in 24 von 24
Fällen.

| Mangel | REQ | Beispiele |
|---|---|---|
| mehrere Zusagen in einer REQ | 24 | `REQ-repo-update` (vier Zusagen), `REQ-host-end-visible` (Ende sichtbar, Abbau ≤ 3 s, Viewer läuft weiter) |
| Wie im Text | 6 | „via bindToolsToHarness", „Deny-Rule + PreToolUse-Hook", „Kuzu-Re-Traversierung" |
| Änderungsnotiz oder Altkennung im Text | 8 | „GATED auf CR-GC-100..103", „werden entfernt", „(R9)", „Familie-weit … Minor-Version-Bump" |
| falsche Art (`kinds`) | 5 | vier Mengen-Einschränkungen als functional, `REQ-rule-calibration` als NFR |
| Prozessvorgabe statt Systemanforderung | 2 | „CI und Publish fahren ihn weiter", „die Hauptsitzung startet je CR einen Agenten" |
| veralteter Begriff | 1 | „schwächste Dimension" — seit CR-SM-401 gibt es Stufen |
| Text verspricht mehr, als Erfüller oder Test abdecken | 3 | `REQ-auto-persist-merge` (Auto-Export ohne Test in der Liste), `REQ-real-health-check` (`collectStatus` sammelt laut Beschreibung nur Host und Version) |
| Duplikat | 1 | `REQ-store-recovery` überschneidet `REQ-schema-version-migration` und `REQ-first-session-claims-store-lock` |

Die Kind-REQ sind im EARS-Muster geschrieben. Ihre TEST-Zuordnung stammt aus der Testliste der
Eltern-REQ und ist im Spike nicht am Testcode geprüft.

## 4. Warum die Mehrfacherfüllung entsteht

Drei Regeln schieben den Autor dorthin:

| Regel | Wirkung |
|---|---|
| R-02 „FUNC must satisfy REQ" | Eine Funktion ohne eigene REQ wird an irgendeine REQ gehängt. 29 Funktionen hingen nur an einer Sammel-REQ. |
| FC-03 „Block … nor satisfier" (error) | Ein Block darf nicht erfüllen; wer eine Anforderung an eine Funktionsgruppe hängen will, hängt sie an alle Blätter. |
| `FCHAIN -satisfy-> REQ` nur non-functional | richtig, aber ohne Regel für die Erfüllerzahl bleibt nur die Mehrfachkante statt der Zerlegung. |

Keine Regel meldet eine REQ mit mehreren Erfüllern. RD-02 greift nur, wenn die REQ schon zerlegt ist.

## 5. Familie

19 von 38 Modellen haben REQ mit mehreren Erfüllern, zusammen 135 REQ. Die meisten: graphcode 40,
immo-infra 13, graphcodedemo 12, siconizer 11, greenfield-trial 10.

## 6. Offen

- 29 Funktionen brauchen eine eigene funktionale REQ (R-02), 78 R-21-Befunde folgen daraus.
- 37 Sprünge bleiben: REQ unter SYS oder UC, von einer tieferen FUNC erfüllt, ohne Zerlegung.
- Die zwei neuen FUNCs stehen in keiner Wirkkette (R-30, R-31).
- TEST-Zuordnung der Kind-REQ am Testcode prüfen; Texte mit Mehrversprechen am Code prüfen.
