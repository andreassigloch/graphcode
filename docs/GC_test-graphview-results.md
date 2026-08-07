# graphcode-Feldtest: Graphview — Ergebnisse

**Stand:** 2026-08-07
**Testobjekt:** graphcode 0.11.0 im Kaltstart, ein Nutzer, eine Sitzung
**Zielprojekt:** Graphview — eine selbstständige PWA zum Betrachten von Format-E/JSON-SE-Graphen und TypeScript-Repos
**Testrepo:** `~/Developer/dev/gc_test-graphview`, 13 Commits, `main`
**Modell:** Claude Opus 5 (1M-Kontext)

Dieses Dokument berichtet, was der Durchlauf gekostet hat, wie viel Steuerung er vom Menschen brauchte und welche Werkzeugdefekte dabei sichtbar wurden. Es ist ein Testbericht über **graphcode**, nicht über Graphview.

---

## 1. Was entstanden ist

Aus einem Absatz Prosa-Intention wurde in einer Sitzung ein vollständig gegatetes Systemmodell:

| | |
|---|---|
| Graph | 218 Elemente, 407 Kanten, graphVersion 24, **null Fehler-Violations** |
| Gates | SRR 26/26 · PDR 29/29 · CDR 7/7 regelrein; TRR offen (braucht Code) |
| Struktur | 1 SYS, 2 ACTOR, 7 UC, 7 FCHAIN, 24 FUNC, 36 FLOW, 21 SCHEMA, 7 MOD |
| Anforderungen | 40 REQ + 16 Risiko-REQ, jede mit verifizierendem TEST |
| Artefakte | 5 CRs (1 geschlossen), 2 commit-gestempelte Records, 16 gerenderte Views |
| Code | **null Zeilen** — reine Modellierung plus zwei Verifikations-Spikes |

Verbleibende Befunde sind ausschließlich Bindungsregeln, die Code voraussetzen: `R-19` (TEST ohne `testRef`), `R-20` (FUNC ohne `realRef`), `R-26` (SCHEMA ohne `realRef`).

---

## 2. Token- und Kostenbilanz

Gemessen aus dem Sitzungstranskript (472 Assistant-Turns mit `usage`-Block), nicht geschätzt.

| Posten | Menge | Rate (Opus 5) | Kosten |
|---|---|---|---|
| Output | 784k | $25 / MTok | $19,60 |
| Cache-Write (1-h-TTL) | 3 602k | $10 / MTok | $36,02 |
| Cache-Read | 136 869k | $0,50 / MTok | $68,43 |
| Input (ungecacht) | 0,9k | $5 / MTok | $0,00 |
| **Summe** | **≈ 141 Mio. Token** | | **≈ $124** |

Alle Cache-Writes liefen auf 1-h-TTL, keiner auf 5 min. Ein Long-Context-Aufschlag über 200k existiert bei Opus 5 nicht — die 1M laufen zum Normalpreis.

**Cache-Reads sind 54 % der Rechnung.** Das ist kein Verschnitt, sondern der Preis dafür, einen auf **809k Token** angewachsenen Kontext 472-mal zu lesen. Nicht die Antworten sind teuer, sondern ihre Wiedervorlage.

220 Tool-Aufrufe (98 Bash, 40 `graph_mutate`, 18 `graph_export`). 929 KB Tool-Ergebnisse, davon **72 % in nur 20 Antworten**.

### Kosten je Nutzereingabe

| # | Eingabe | Kosten | Anteil |
|---|---|---|---|
| 17 | „beide spike machen" | **$19,06** | 14,9 % |
| 19 | FMEA | **$14,17** | 11,1 % |
| 10 | ConOps starten | $8,35 | 6,5 % |
| 2 | Design-Intention + Reuse-Recherche | $7,61 | 6,0 % |
| 16 | IRR | $6,34 | 5,0 % |
| 7 | „go ahead" (Generate-Loop) | $5,80 | 4,5 % |
| … | 17 weitere | | |
| 20 | „commit" | $0,87 | 0,7 % |

---

## 3. Steuerungsaufwand: 23 Eingaben, ~2 900 Zeichen

| Art | n | Beispiele |
|---|---|---|
| **Inhaltlich** (Modell, Entscheidungen, Korrekturen) | **12** | Intention, Flows, ConOps, MOD-Korrektur, CR-5-Entscheidung, FMEA, Schema-Vereinheitlichung |
| **Steuernd** („mach jetzt X") | 4 | Trade Study, „beide spike", „du machst weiter" |
| **Prozess/Werkzeug** | 5 | `git init`, commit, Logs prüfen, GVE-Adresse, Wirkketten-Fehlalarm |
| **Meta** | 2 | Einstieg, Kostenanalyse |

Die beiden längsten Eingaben waren die Intention (377 Zeichen) und ein Dashboard-Befund (421). Der Rest lag im Schnitt bei **~100 Zeichen**. Der Prozess kostet den Nutzer also kaum Tippen — aber Round-Trips.

---

## 4. Die drei SE-Werkzeuge

| Werkzeug | Kosten | Anteil an der Projektarbeit ($98,87) |
|---|---|---|
| **ConOps** | $8,35 | 8,4 % |
| ↳ nachgezogener 7. Use Case | $4,14 | 4,2 % |
| **IRR** (Assumption Review) | $6,34 | 6,4 % |
| ↳ die zwei Spikes, die er befördert hat | $19,06 | 19,3 % |
| **FMEA** | $14,17 | 14,3 % |
| **zusammen** | **$52,06** | **53 %** |

Über die Hälfte der Projektarbeit steckt in drei Werkzeugen, die **der Nutzer selbst anstoßen musste**. Keines wurde vom Prozess vorgeschlagen.

### Was sie geliefert haben

Sie waren das Geld wert — sie sind die einzigen Schritte, in denen etwas *widerlegt* statt behauptet wurde:

- **ConOps** deckte sechs unbeantwortete Betriebsbelange auf (Config, Berechtigungen, User-Mgmt, Deploy, Observability, Datenlebenszyklus) und erzwang die Erkenntnis, dass eine „PWA ohne Backend" trotzdem einen ausgelieferten Origin braucht — Service Worker und File System Access API verlangen beide einen Secure Context, `file://` scheidet aus.
- **IRR** falsifizierte eine tragende Annahme mit Beleg: die File System Access API ist Chromium-only (MDN browser-compat-data — Firefox nein, Safari nein, alle drei Picker). Das betraf zwei Use Cases; die bestehende REQ deckte „verweigert" ab, nicht „nicht vorhanden". Außerdem: ein bestätigter Platzhalter (`REQ-nfr-scale-limits` sagte „stated limits" und nannte keine) und ein gemessenes Budget statt einer Vermutung (WASM-Grammatiken 420 KB gzip).
- **Die beiden Spikes** — teuerster Turn der Sitzung — haben die Architekturprämisse tatsächlich getestet: der GVE-Renderer-Kern ist ohne Node-Kopplung vendorbar (belegt durch Build und Screenshot mit exakt passenden Knotenzahlen), kostet aber **45 Dateien / 5 714 Zeilen** über zwei Quellbäume statt der angenommenen fünf Module. Nebenbefund: **GVE benutzt kein Cytoscape mehr** — das README ist an der Stelle veraltet, und der Fehler war über die Intention in drei Knoten des Modells gewandert.
- **FMEA** fand 16 Fehlermodi, acht davon AP hoch. Die drei mit dem höchsten RPN sind alle Vertraulichkeit und haben alle D ≥ 7 — sie erzeugen kein Symptom. Ein Standard-`cache-first`-Rezept hätte vertrauliche Graphen dauerhaft in Cache Storage geschrieben und damit die zentrale „nur im Speicher"-Zusage still gebrochen. Zwei Zerstörungspfade (veraltetes Datei-Handle, Export nach Versionsdrift) waren vorher gar nicht modelliert.

### Warum der Prozess sie nicht vorgeschlagen hat

**Die Zuordnung existiert bereits.** `graph_readiness` liefert pro Gate ein `creationArtifacts`-Feld:

| Gate | creationArtifacts |
|---|---|
| SRR / SAR | `conops`, `assumption-review` |
| PDR / FCA | `fmea`, `trade` |
| CDR / SVR | `implplan` |

Der Graph weiß also, welches Artefakt zu welchem Gate gehört. Er setzt es nur nicht durch: **`creationEnforcement: "off"`** stand die ganze Sitzung über in jeder Readiness-Antwort. Deshalb kam kein Hinweis, und deshalb musste der Nutzer dreimal selbst daran denken.

**Zur Phasenfrage:** Die Gate-Zuordnung sagt, dass ConOps und Assumption-Review für SRR *verfasst* und bei SAR *geprüft* werden, FMEA und Trade für PDR bzw. FCA. Sie gehören also in die Entwurfsphase und werden in der Implementierung nachgehalten. Der Fehler in diesem Durchlauf war nicht die Phase, sondern die **Reihenfolge**: `se-conops` verlangt ausdrücklich „operational concerns BEFORE use cases" — hier lief er nach sechs fertigen UCs, weshalb ein siebter nachträglich eingezogen werden musste. Bei richtiger Reihenfolge wären $4,14 nicht angefallen.

---

## 5. Modelltier: der Wechsel bringt fast nichts

Ausgezählt, welche Turns kein Frontier-Modell brauchen — unter der Annahme entschlackter Mutate-Antworten:

| Turn | Inhalt | Kosten |
|---|---|---|
| 4 | `git init` | $1,08 |
| 5 | commit + Adresse nachschlagen | $0,85 |
| 6 | Prozesse und Ports prüfen | $2,75 |
| 13 | Kenntnisnahme eines Fehlalarms | $0,43 |
| 20 | `commit` | $0,87 |
| 21 | CDR-Diagnose | $0,95 |
| **Summe** | | **$6,93 = 7 %** |

Bei Haiku (Cache-Read $0,10 statt $0,50) würden daraus etwa $2 — **Ersparnis rund $5 von $124, also 4 %.**

Der Grund steht in der Tabelle: Turn 20 kostete für einen `git commit` mit **1k Output** ganze **$0,87**. 97 % davon war das Lesen der Unterhaltung, nicht das Denken. Ein billigeres Modell liest denselben Kontext — nur billiger.

**Der wirksame Hebel ist der Kontext, nicht das Modell.** Git-Operationen, Exporte und Commits brauchen die 809k Token Gesprächsverlauf überhaupt nicht.

Keinen Tier-Wechsel vertragen: Reuse-Recherche, Trade Study, Flow-Modellierung, Metrik-Ursachenanalyse, IRR, Spikes, FMEA — zusammen rund 70 % der Kosten und genau die Arbeit, für die die Sitzung geführt wurde.

---

## 6. Werkzeugbefunde

Sieben Stellen, an denen graphcode Token gekostet oder in die Irre geführt hat.

### 6.1 `graph_mutate` echot alle Violations in voller Länge

Jede Antwort listet sämtliche Warnungen mit vollem `context`, inklusive `candidate_targets` — eine Antwort führte 39 Kandidaten auf. Zwei Antworten (70,3 KB und 64,9 KB) sprengten das Tool-Result-Limit und mussten auf Platte ausgelagert werden. Bei 40 Mutationen mit dauerhaft 20–45 offenen `R-19`/`R-20`-Warnungen wiederholt sich derselbe Text zigfach — und liegt danach in jedem Cache-Read.

Messung: `graph_mutate`-Ergebnisse sind **189 KB von 929 KB** aller Tool-Ergebnisse (20 %, ~47k Token). Hätte ein Summary-Modus daraus ~10k gemacht, wäre der Kontext für den Großteil der Sitzung ~37k Token kleiner gewesen — überschlägig **$5 bis $8**. Nennenswert, aber nicht der Hauptposten; der ist die Sitzungslänge selbst.

**Vorschlag:** `violations: 'summary' | 'full'`, Default `summary` (ruleId, Anzahl, betroffene uids — kein `context`). `graph_readiness` hat dieses Muster mit `detail:true` bereits, die Mutation nicht.

### 6.2 `graph_authoring_guide` nennt keine Attribut-Verträge

Die Guide liefert legale Kanten und `requiredAttrs`. Sie sagt **nicht**, welche Attribute die Views lesen. Vier von fünf Formatfehlern dieser Sitzung wären damit nicht entstanden:

| Rätsel | wie es gefunden wurde |
|---|---|
| `kinds` muss ein **Array** sein, nicht String | `nfr.md` und `conops.md` meldeten „keine REQ im Graph", obwohl 14 drinstanden |
| Risiko-REQ brauchen **`S`/`O`/`D` als Großbuchstaben-Zahlen** | Lesen des kompilierten Exporters in `dist/` |
| `[concept:true]` als Inline-Format-E-Attribut wirkungslos | `R-20` blieb unverändert |
| Trade-Kante: Skill schreibt `attributes.role`, Exporter liest `label` | leere Trade-View |

**Vorschlag:** ein Feld „von Views konsumierte Attribute" je Elementtyp.

### 6.3 Zwei View-Exporter lesen Kanten, die es so nicht gibt

- **Trade-View** walkt `relation(label ∈ {alternative, superseded-by, decides})`, der `se-trade`-Skill weist aber `attributes.role` an. Wer dem Skill wörtlich folgt, erzeugt eine Entscheidung, die im Graphen steht und in der View unsichtbar bleibt („keine Trade-Study-relation im Graph").
- **FMEA-View** liest die Mitigation-Spalte aus `relation`-Kanten Risiko-REQ → Mitigations-REQ. Die Ontologie **verbietet** `REQ -relation-> REQ` per `R-18`-Error. Diese Spalte kann in keinem regelkonformen Graphen je gefüllt werden; sie blieb bei allen 16 Zeilen leer. Legal ist `compose`, was die Ontologie ausdrücklich als „incl. mitigation" führt.

Außerdem leitet die FMEA-View die AP-Spalte **allein aus S** ab (`S>=8 → High`) — das ist gröber als AIAG-VDA (Severity, dann Occurrence) und weicht von der Bewertung im Record ab.

### 6.4 Format-E-Kanten verlangen Neu-Deklaration vorhandener Knoten

Ein Batch, der nur Kanten zwischen bestehenden Knoten hinzufügt, scheitert mit `Cannot resolve type of source "…" — not declared under a "### <TYPE>" section and no resolveType provided`. Der Codec **unterstützt** `options.resolveType`; das MCP-Tool reicht es nicht durch. Der Store kennt die Typen — die Pflicht, sie zu wiederholen, ist vermeidbar. Kostete einen verlorenen Durchlauf.

### 6.5 Das Kommando-Schema ist nur per Fehler-Probe auffindbar

Die kanonischen Shapes (`{op:'add-node', node:{uid,type,name,…}}`) stehen im `SCHEMA-01`-Fehlertext. Ein Beispiel in der Tool-Beschreibung hätte den Probe-Round-Trip gespart. Positiv: der Fehlertext ist exzellent — er listet alle sieben Operationen mit vollständiger Signatur.

### 6.6 `dryRun` → `apply` verdoppelt große Payloads

Das Protokoll verlangt Trockenlauf, dann Anwendung. Der Flow-Batch (85 Kommandos), FMEA (74), Mitigations (63) und ConOps (56) gingen je zweimal raus. Dabei ist das Gate **transaktional** — ein geblockter Batch schreibt `mutations: 0`. Für die Sicherheit ist der Trockenlauf also überflüssig; nötig ist er nur für den A/B-Vergleich zweier Alternativen.

**Vorschlag:** `applyIf: 'not-blocked'`.

### 6.7 Kein View-Lint

Drei Befunde dieser Sitzung sind derselbe Fehler: der Graph ist regelkonform, aber die View zeigt nichts. Ein `graph_lint --views` („was du geschrieben hast, rendert nirgends") hätte alle drei sofort gemeldet.

**Die Views waren durchgehend der ehrlichere Prüfer als das Gate.** Das ist die wichtigste Einzelerkenntnis dieses Tests: `compliance: 1.0` bei gleichzeitig leeren Views war zweimal der Zustand.

---

## 7. Metrikbefunde

### 7.1 `flowEfficiency` kollabiert bei actor-begrenzten Ketten auf 0

`flowEfficiency = 5 · (1/max(1, meanLength)) · reachableFraction` über Quellen (in-Grad 0) zu Senken (out-Grad 0). Bei `sources.length === 0` gibt `sourceSinkPaths` sofort `{0, 0}` zurück.

Regel `FC-04` verlangt, dass jede FCHAIN actor-begrenzt ist — ein ACTOR-Einstieg **und** ein ACTOR-Ausstieg. Sobald das erfüllt ist, hat kein Knoten mehr in-Grad 0, und die Kennzahl steht strukturell auf 0. Gemessen: 53 arch-Knoten, 76 arch-Kanten, **0 Quellen**, 6 Senken.

**Zwei Teile desselben Systems ziehen gegeneinander:** `FC-04` verlangt Zyklen, `flowEfficiency` setzt eine azyklische Quelle→Senke-Pipeline voraus. Wer die Dimension bei einem interaktiven System > 0 gewichtet, bekommt vom Optimizer Druck, eine PDR-Gate-Regel zu verletzen.

Belegt durch Gegenprobe: als eine FUNC versehentlich ohne eingehenden Flow blieb (die einzige Quelle im Graphen), sprang die Kennzahl auf 0,95. Nach Schließen der Modelllücke fiel sie zurück auf 0. **Die Kennzahl belohnte messbar das unvollständige Modell.**

Lösungsrichtung: ACTOR als Systemgrenze behandeln (Quellen/Senken über ACTOR-Ausgänge statt in-/out-Grad 0), SCC-Kondensation, oder Fallback auf harmonische Zentralität statt hart 0.

### 7.2 Kohärenz 5,0 kann ein Artefakt isolierter Module sein

Vor der Flow-Modellierung stand `coherence` auf 5,0 — bei einem Graphen, in dem die Module **null** Verbindungen untereinander hatten. Trivial kohärent, weil isoliert. Jede ehrliche Flussmodellierung senkt den Wert (hier 5,0 → 3,75). Ein Maximalwert bei fehlenden Querkanten ist kein Qualitätssignal.

### 7.3 `MOD satisfy REQ` ist legal, aber metrisch unsichtbar

Eine Verhaltens-`satisfy` am Modul statt an den FUNCs war regelkonform (die Ontologie erlaubt `MOD satisfy REQ` für Budget-NFR) und erzeugte **Fit-Delta exakt 0 in allen sechs Dimensionen** — `REQ` liegt nicht in `ARCH_TYPES`, die Kante fällt aus der Projektion. Gefunden hat es ein Mensch beim Lesen des Modells.

---

## 8. Empfehlungen, nach Wirkung sortiert

| # | Maßnahme | Wirkung |
|---|---|---|
| 1 | **Mechanik aus der Denk-Session heraushalten** — Commits, Exporte, Git in Hook oder eigene Sitzung | einziger Hebel mit zweistelligem Prozentpotenzial |
| 2 | **`violations: 'summary'` als Default in `graph_mutate`** | $5–8 in diesem Lauf, wächst mit Sitzungslänge |
| 3 | **`creationEnforcement` einschalten** — der Prozess kennt die Gate-Zuordnung von ConOps/IRR/FMEA bereits | verhindert, dass der Nutzer sie erinnern muss |
| 4 | **Attribut-Verträge in `graph_authoring_guide`** | hätte 4 von 5 Formatfehlern verhindert |
| 5 | **`graph_lint --views`** | fängt die Klasse „regelkonform, aber unsichtbar" |
| 6 | **Trade- und FMEA-Exporter auf legale Kanten umstellen** | zwei Views sind heute strukturell nicht befüllbar |
| 7 | **`applyIf: 'not-blocked'`** | halbiert große Batches |
| 8 | **`resolveType` serverseitig durchreichen** | ein Round-Trip je Kanten-Batch |
| 9 | **`flowEfficiency` gegen `FC-04` auflösen** | beseitigt eine Kennzahl, die Unvollständigkeit belohnt |

### Prozessregel für den Agenten

Keine bewusste Ausnahme von einer Vollständigkeitsdimension, ohne vorher `graph_readiness` gegen den Zwischenstand laufen zu lassen. Der CDR-50-%-Zwischenfall dieses Laufs ging auf eine eigenmächtige Entscheidung zurück („reine Auslöser-Flows brauchen kein Schema"), die der Gate-Erwartung widersprach — bei 36 Flows fehlten neun Schemas, und drei der neun trugen bei genauerer Prüfung tatsächlich Nutzlast.

---

## 9. Messvorbehalte

- Die Zahlen decken **eine** Sitzung ab (3,8 MB Transkript). Eine frühere Sitzung von 15:57 desselben Tages (133 KB) ist nicht enthalten.
- Die Kostenrechnung nutzt die Listenpreise für Claude Opus 5 ($5/$25 pro MTok, Cache-Write 2× bei 1-h-TTL, Cache-Read 0,1×). Rabatte oder abweichende Vertragskonditionen sind nicht berücksichtigt.
- Die Ersparnis-Schätzung für die Mutate-Entschlackung (§6.1) ist eine Überschlagsrechnung, keine Messung — der Kontrafaktik-Lauf existiert nicht.
- Die Zuordnung „braucht kein Frontier-Modell" (§5) ist eine Einschätzung anhand des Turn-Inhalts, nicht durch einen Vergleichslauf belegt.
- Die S/O/D-Bewertungen der FMEA sind ingenieurmäßige Schätzungen; Messwerte kann es vor der Implementierung nicht geben.
