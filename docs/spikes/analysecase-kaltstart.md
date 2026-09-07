# Analyse-Case: Kaltstart eines Systemmodells

**Abgeleitet aus:** CR-GC-485 (`test_karp`, 2026-09-07) — 11 Graph-Versionen, 43 Gate-Durchläufe,
Prosa bis „ready to code" · **Zweck:** derselbe Lauf zweimal gefahren soll dieselben Fragen
beantworten, nicht dieselben Fallen neu entdecken.

Der Case besteht aus drei Teilen: **womit man prüft** (Werkzeug-Disziplin), **was man prüft**
(die Prüffragen) und **woran man merkt, dass man falsch prüft** (die Gegenproben).

---

## Teil 1 — Werkzeug-Disziplin: was im Lauf schiefging

Sieben Fehlgriffe, alle belegt, alle vermeidbar. Sie stehen hier nicht als Beichte, sondern weil
jeder von ihnen eine **Regel** trägt. F1–F5 sind falsche Werkzeugwahl, F6 falsche Ausführung bei
richtiger Wahl, F7 eine Schlussfolgerung aus einer Auskunft, die es nicht gab.

### F1 — Quelltext greppen statt den Katalog importieren

    grep -rn "postcondition" packages/contracts/src/se/*.ts    # falsch

Gesucht waren die legalen `ReqKind`-Werte. Richtig wäre gewesen:

    node -e "console.log(require('@sigloch/contracts/se').ReqKind.options)"
    → functional, non-functional, risk, mitigation, precondition, postcondition

**Aber:** `graph_authoring_guide {type:"REQ"}` liefert `requiredAttrs: []` und nennt `kinds` nicht;
`graph_help {token:"REQ"}` gibt eine fünf-Wort-Glosse. **Keine MCP-Werkzeugantwort trägt das
Wertevokabular.** Der Grep war falsch, die Lücke ist echt — `requiredAttrs` sollte die Enums der
Attribute mitführen, sonst bleibt der Quelltext die einzige Auskunft.

> **Regel:** Vokabular kommt aus dem Paket-Export, nie aus dem Quelltext. Findet sich weder im
> Export noch im Werkzeug, ist das ein Befund und kein Anlass zu greppen.

### F2 — Parameternamen raten statt Schema laden

    graph_context {"uid":"FUNC-read-source"}   → leer
    graph_context {"id":"FUNC-read-source"}    → 10 Knoten, 10 Kanten

Der Parameter heißt `id`. Ich habe `uid` geraten, die leere Antwort für einen **Befund über das
Werkzeug** gehalten und sie beinahe so berichtet.

> **Regel:** Vor dem Erstgebrauch eines Werkzeugs sein Schema laden. Eine leere Antwort ist erst
> dann ein Befund, wenn der Aufruf nachweislich richtig war.

### F3 — Ergebnisse wegwerfen

    graph_export '{}' >/dev/null 2>&1

Vier Aufrufe hintereinander haben **verweigert** („would delete 4 trace(s) … likely a stale
process", nach der gegateten Löschung in Runde 7). Gemerkt habe ich es erst durch die Datei
`.graphcode/EXPORT_PENDING`; das committete Artefakt stand da vier Versionen zurück.

> **Regel:** Kein `>/dev/null` auf einem Schreibpfad. Nach jeder Mutationsrunde `graph_export`
> und **das Ergebnis lesen** — der Treiber ohne `bootHost` hat keinen Auto-Export.

### F4 — Den Code prüfen statt den Graphen

Die Bindungsprüfung aus CR-GC-485 §3 war `grep -c steerAdvisory dist/kernel/harness.js`. Sie war
**grün**, während der MCP-Server am Graphen eines fremden Repos hing. Ein Code-Check kann eine
Datenbindung nicht prüfen.

> **Regel:** Erster Zug jeder Sitzung ist `graph_metrics`. Auf einem frischen Repo muss
> `modules: []` kommen. Kommt etwas anderes, hängt die Bindung woanders.

### F5 — Rechnen statt messen

Die Instabilitäts-Verzerrung habe ich zuerst aus rohen Kanten überschlagen (43–55 %) und
veröffentlicht. Die echte Messung — Store-Kopie, alle 17 MS/CR-Knoten gelöscht, `graph_metrics` —
ergab **22–24 %**: `fanIn` zählt anders als eine rohe Kantenzählung.

> **Regel:** Eine Zahl über das System kommt vom System. Handrechnung ist eine Hypothese, kein
> Befund — Rig aufsetzen kostet zwei Minuten.

### F6 — 72 Einzelprozesse statt einer Schleife

Für die Regelklassifikation habe ich `graph_help` **72-mal als eigenen Treiberaufruf** gestartet.
Jeder Aufruf öffnet und schließt einen Kuzu-Store von ~105 MB. Die Werkzeugwahl war richtig, die
Ausführung war es nicht: `createHarness` einmal öffnen, `bindToolsToHarness` einmal binden,
72-mal `registry.graph_help.handler({token})` — ein Store-Öffnen statt 72.

> **Regel:** Ein Treiber, der über eine Liste läuft, öffnet den Harness EINMAL. Der Einzelaufruf
> ist für den Einzelfall.

### F7 — Klassifiziert, was die Auskunft nicht hergab

Drei Regeln habe ich nach ihrem **Namen** eingeordnet, weil `graph_help` keinen Eintrag hat:
BW-02 (als Modul-Blackbox statt FUNC-Whitebox), BQ-04 (als Einzelknoten statt paarweise über alle
REQ), R-12 (als Zweierring statt DFS jeder Länge — dort ist der Eintrag da, aber überholt).
Alle drei standen falsch in einem committeten Dokument.

> **Regel:** Ist die Auskunftsschicht stumm oder verdächtig, ist der Quelltext die Quelle — und
> die Lücke ein CR, kein Achselzucken. Nie aus einem Regelnamen auf ihre Semantik schließen.

### Zwei geprüfte Nicht-Fehlgriffe

Zur Ehrlichkeit der Bilanz gehört, was sich bei der Nachprüfung als richtig herausstellte:

- **CR-Nummern über `ls docs/cr/done/`.** Naheliegender Vorwurf: das hätte `graph_elements
  {type:"CR"}` beantworten können. Gemessen: sigloch-modules führt **3 CR-Knoten bei 99
  CR-Dateien**, graphcode 311 Dateien. Der Graph ist für CR-Nummern **keine** Quelle; die Ablage
  ist es. (Dass CR-R01/CR-R04/MS-03 über CR-Knoten wachen, die es für 96 von 99 Vorgängen nicht
  gibt, ist ein eigener Gedanke — hier nur festgehalten.)
- **`ps`/`lsof`/`find`/`sed` auf Quelltext.** Prozess-, Datei- und Implementierungsfragen; dafür
  gibt es kein Graph-Werkzeug, und es soll auch keines geben.

### Was richtig lief, zur Abgrenzung

- `graph_authoring_guide` vor **jedem** neuen Elementtyp — hat legale Kanten und Kardinalitäten
  jedes Mal korrekt geliefert.
- **Das System sich selbst dokumentieren lassen:** ein absichtlich falsches `{"op":"bogus"}` holt
  über den `SCHEMA-01`-Fehlertext die vollständige Signaturliste aller sieben Operationen.
- `graph_help` für Regelsemantik (R-19, RD-01, CR-R03, MT-01) — und der MT-01-Text hat den
  Defekt selbst preisgegeben („over the module's traces").
- `ps`/`lsof`/`find` für Prozess- und Dateifragen: dafür gibt es kein Graph-Werkzeug, das ist
  kein Verstoß.

---

## Teil 2 — Die Prüffragen

Die ersten sieben stammen aus CR-GC-485 §7. Die restlichen sind im Lauf dazugekommen; sie stehen
hier, weil sie beim nächsten Mal **vorher** gestellt gehören.

### Vor dem ersten Schreibzugriff

| # | Frage | Wie geprüft | Rot, wenn |
|---|---|---|---|
| V1 | Hängt die Sitzung am richtigen Graphen? | `graph_metrics` | Module eines fremden Repos |
| V2 | Fährt die Bindung den lokalen Build? | `grep -c steerAdvisory dist/…` + Symlink | Registry-Paket |
| V3 | Gibt es einen Auto-Export? | `bootHost` im Pfad? | nein → Export von Hand, Ergebnis lesen |
| V4 | Ist eine Entscheidung offen, die den Schnitt bestimmt? | Vorlage lesen | offen → einmal fragen, nicht warten |

### Während des Laufs

| # | Frage | Wie geprüft |
|---|---|---|
| L1 | Deckt sich der `focusKey` mit der Arbeitsanweisung im `prompt`? | beide lesen, vergleichen |
| L2 | Nennt `focusTypes` alle Typen, die die Anweisung braucht? | gegen `graph_authoring_guide` |
| L3 | Ist jede Alternative **vor** der Anwendung als `dryRun` gemessen? | Verdict-Vergleich |
| L4 | Trägt der Verdict Steuerung? | bei `tier: block` sind `steerAdvisory`/`fitAdvisory` `null` |
| L5 | Sind `value`/`threshold` sichtbar? | nur mit `violations: "full"` |
| L6 | Ist der Export durchgelaufen? | Ergebnis lesen, `EXPORT_PENDING` prüfen |

### Nach dem Lauf — die sieben aus §7, plus vier

| # | Frage | Antwortform |
|---|---|---|
| N1 | Kaltstart-Protokoll: Runden, Fokuswahl, Verirrungen | Tabelle je Runde |
| N2 | Gate-Bilanz: applied / rejected, welche Regel blockte | `audit_stats` |
| N3 | Steuerungsspur: ab wann Score ≠ 0, erste `worstAt`, Zerstörungs-Sperre | Verdicts der Runden |
| N4 | Dünne-Substanz-Test: welche Regel hatte keinen Gegenstand | `audit_stats.byRule`, occurrences = 0 |
| N5 | Vergleich mit dem Lint des Zielsystems | Zuordnungstabelle |
| N6 | MOD-Whitebox-Lücke getroffen? | `graph_metrics`, Kohäsion int/ext |
| N7 | Was hat gefehlt | Liste der Werkzeugmomente |
| **N8** | **Welcher Prüfgegenstand hat getragen?** | Regeln nach Klasse A–G, Feuerquote je Klasse |
| **N9** | **Welche Regel steuert, ohne sich zu erklären?** | `graph_help` je Regel des `steerAdvisory` — BW-02 hatte keinen Eintrag |
| **N12** | **Deckt sich die Hilfeschicht mit dem Katalog?** | `ALL_RULE_DEFS` gegen `graph_help` je Regel |
| **N13** | **Öffnet sich ein Harness über jedem Familienrepo?** | `createHarness` je Repo — Config-Drift bricht hart ab |
| **N10** | **Hat der Plan die Architekturmetrik verschoben?** | Rig ohne MS/CR gegen Rig mit |
| **N11** | **Stimmt Artefakt gleich Store?** | `graphVersion` in beiden vergleichen |

**N8 ist die Frage, die im Lauf die meiste Substanz erzeugt hat** und in der Vorlage fehlte.
Die Klassifikation samt Messung steht in
`sigloch-modules/docs/project/regel-pruefgegenstand.md`.

---

## Teil 3 — Die Gegenproben

Jede dieser vier hat im Lauf eine Behauptung gekippt, die ohne sie stehengeblieben wäre.

**G1 — Die Alternative auch dann messen, wenn man die Antwort zu kennen glaubt.**
Ich hielt die Gruppierung der FUNCs unter Eltern-Knoten für eine redundante dritte Ebene neben
FCHAIN und MOD. Gemessen räumt sie RD-04 vollständig und verbessert **jede** Fit-Dimension ohne
Regression. Die Vermutung war falsch, und nur der dryRun hat es gezeigt.

**G2 — Die naheliegende Erklärung gegen die eigenen Daten halten.**
„MT-01 schweigt, weil es ohne Code keine Architektur gibt" — widerlegt durch denselben Lauf, der
sechs Module mit unterschiedlichem LCOM4, unterschiedlicher Kohäsion und einer Δm-Entscheidung
zwischen zwei Schnitten hervorgebracht hat. Die echte Ursache lag in der Fan-Zählung.

**G3 — Den Schaden eingrenzen, nicht nur nachweisen.**
Nachdem der MT-01-Defekt belegt war, lag die Verallgemeinerung nahe: „Doku-Traces verfälschen die
Steuerung". Die dryRun-Löschung aller 17 MS/CR-Knoten bewegt den R6-Fit-Vektor um **0.000** auf
allen sechs Dimensionen. Der Defekt betrifft `fanIn`/`instability`/MT-01 — und nichts sonst.
Ohne diese Gegenprobe wäre ein CR entstanden, der dreimal zu breit geschnitten ist.

**G4 — Prüfen, ob das Werkzeug die Frage überhaupt beantworten kann.**
Bevor ein fehlender Wert zum Befund wird: gibt es einen zweiten Pfad? `context: null` auf dem
`graph_mutate`-Pfad sah nach einem Verlust aus; `violations: "full"` und `rules_evaluate` tragen
den Wert. Aus einem Fehler wurde ein dokumentierter Default — und ein deutlich kleinerer Befund.

---

## Kurzform für die nächste Sitzung

1. `graph_metrics` → richtiger Graph?
2. Offene Entscheidung einmal vorlegen, nicht darauf warten.
3. Je Runde: `graph_authoring_guide` → 2 Alternativen als `dryRun` → Verdicts vergleichen →
   besten anwenden → `graph_export` **und Ergebnis lesen**.
4. Bei `block`: keine Steuerung im Verdict — Regel per `graph_help` klären, nicht raten.
5. Am Ende: `audit_stats` für N2/N4, `graph_metrics` für N6, Rig-Gegenprobe für N10,
   `graphVersion` beidseitig für N11.
6. Jede Zahl, die in einen Bericht geht, ist gemessen — nicht überschlagen.
7. Keine Aussage über eine Regel aus ihrem Namen. Fehlt die Erklärung, ist das der Befund.
