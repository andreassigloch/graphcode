---
name: se-laufzeit
version: 1
description: Laufzeitanalyse einer Wirkkette — liest den Antwortweg (die Glieder, auf die die Antwort an den Akteur wartet) aus graph_metrics, nennt Befunde je Ort, fehlende Anforderungen an das Datenalter und Vorschläge mit Preis. Auf Stufe 8, nach se-vorbereitung. Setzt kein Merkmal, schätzt keine Zeit, wendet keinen Umbau an.
---

# se-laufzeit — auf wen wartet die Antwort

## Wofür dieser Skill da ist

Du sagst für eine Wirkkette mit einer Laufzeitanforderung, **auf welche Funktionen die Antwort an
den Akteur wartet**, und was sich daran ändern ließe. Du sagst nicht, wie lange es dauert: Menge je
Abruf und Takt der Zulieferer trägt das Modell nicht, und du schätzt keine Zeit.

**Einheit ist eine Wirkkette mit einer Laufzeitanforderung.** Ohne benannte Kette fragst du nach ihr.

**Eine Analyse ist eine Schleife.** Sie erzeugt Anforderungen, und ihr Ergebnis ist ein gewöhnlicher CR.
Die Vorbereitung des Modells gehört nicht dazu: du prüfst den Eingang und verweist bei einer Lücke
auf `se-vorbereitung`. Du setzt kein Merkmal an einem Fluss, schließt keine Kette und wendest keinen
Umbau an.

**Eine Rechnung.** Den Antwortweg rechnet `chainMetrics` in `@sigloch/contracts/se`; du liest ihn aus
`graph_metrics`. Du rechnest keine Kennzahl selbst und gehst den Weg nicht von Hand nach. Eine Zahl
ist die Länge der Liste. Fehlt dir ein Ort, ist das ein Befund an `chainMetrics`.

Was das Merkmal am Fluss heißt: `sync` = der Abnehmer wartet beim Aufruf auf diese Lieferung;
`async` = vorab geliefert. Der Abruf eines gehaltenen Zustands (Store, Ablage) ist `sync`.

---

## 1. Eingang prüfen

```
graph_metrics({ scope: ["<FCHAIN-uid>"] })   # Zeile der Kette in chains, dazu der Block scope
```

Lies die Zeile der Kette. Du liest den Stand und stellst ihn nicht her:

- `measurable: false` → der Lauf endet. Nenne die `reasons` und verweise auf `se-vorbereitung` (Schritt 1, Kette schließen).
- `answerPath: null` → der Lauf endet. Nenne jeden Fluss aus `answerPathBlockedBy` und verweise auf `se-vorbereitung`. Ein Fluss hindert aus einem von zwei Gründen; welcher es ist, zeigt `graph_get_node` am Fluss:
  - er trägt das Merkmal nicht lesbar → `se-vorbereitung`, Schritt 3 (Flüsse kennzeichnen),
  - er trägt `sync` und kommt von einer Funktion außerhalb der Kette → die Kette ist nicht vollständig: `se-vorbereitung`, Schritt 1.

  Die Liste nennt die Hindernisse, auf die der Weg trifft, nicht jeden Fluss ohne Merkmal. Nach der Vorbereitung liest du neu; es können weitere dahinter stehen.
- `answerPath: []` → kein Glied liefert einem Akteur synchron: auf diese Kette wartet keine Antwort. Sag das und frag den Autor, ob die Kette die gemeinte ist. Ohne Antwortweg gibt es keinen Vorschlag.

## 2. Betrachtungsumfang und Laufzeitanforderung

Der Block `scope` derselben Antwort nennt `modules` (die Module der Glieder), `chains` (alle Ketten
durch die Glieder) und `requirements` (jede Anforderung, die ein Glied, eines dieser Module, eine
dieser Ketten oder das System erfüllt). Das ist, was diese Analyse liest. Nenne die `requirements`
im Bericht.

Die Laufzeitanforderung benennt der Autor, oder sie steht in `requirements` (lies den Wortlaut mit
`graph_get_node`). Steht dort keine, ist das der erste Befund für Schritt 4 b: frag den Autor nach ihr.
Du erfindest keinen Wert.

## 3. Orte lesen

Alles aus der Zeile der Kette und aus `functions` derselben Antwort. Die Kennzahlen finden den Ort,
sie bewerten ihn nicht; das Urteil bleibt beim Autor.

| Ort | Quelle | Was er für die Laufzeit bedeutet |
|---|---|---|
| Antwortweg | `answerPath`; je Glied seine Reichweite `chains` und `useCases` aus `functions` | auf jedes dieser Glieder wartet die Antwort. Er verlässt die Kette nicht |
| Geteilte Funktion auf dem Antwortweg | die Glieder aus `shared`, die auch in `answerPath` stehen | die Antwort wartet auf eine Funktion, durch die andere Ketten laufen |
| Zulieferer außerhalb des Antwortwegs | die Flüsse mit `async` in ein Glied des Antwortwegs und ihre Erzeuger: `graph_get_edges({ uid: "<Glied>", edgeType: "io", direction: "in" })` nennt die Flüsse, `graph_get_node` am Fluss das Merkmal | die Antwort wartet nicht auf sie. Sie bestimmen, wie alt der Stand in der Antwort ist |
| Zulauf, Verzweigung | `fanIn`, `branching`, gelesen gegen `memberCount` | eine Stelle, an der auf mehrere gewartet wird |
| Kreislauf auf dem Antwortweg | die Einträge aus `loops`, deren `members` ein Glied des Antwortwegs nennen | die Antwort wartet auf einen Umlauf |
| Glied außerhalb des Antwortwegs | die Glieder der Kette (`graph_get_edges`, `compose`), die nicht in `answerPath` stehen | arbeitet vorab oder danach; kein Ort der Laufzeit |

Ergebnis von Schritt 3: eine Tabelle `Glied | auf dem Antwortweg | geteilt | Ketten durch das Glied | Zuflüsse mit async`, alle Werte zitiert.

## 4. Ergebnisse a bis d

**a — Befunde je Ort.** Je Ort aus Schritt 3 ein Befund mit den uids, aus denen er stammt. Ein Befund
nennt, worauf gewartet wird, und urteilt nicht über die Dauer.

**b — fehlende Anforderungen.** Zu jeder Laufzeitanforderung gehört die Anforderung an das Datenalter:
was vorab geliefert wird, ist beim Aufruf so alt wie der letzte Lauf seines Zulieferers. Prüf je
Zulieferer außerhalb des Antwortwegs, ob eine Anforderung in `requirements` sagt, wie alt sein Stand
in der Antwort sein darf. Fehlt sie, ist die Lücke der Befund. Den Wert nennt der Autor.

**c — Vorschläge, in fester Form.** Zwei Handlungsklassen:

- **Vorverlagern:** vorhalten statt beim Aufruf rechnen oder abrufen. Die Speisung bekommt einen eigenen Fluss: derselbe Inhalt, einmal abgerufen und einmal vorab geliefert, sind zwei Flüsse. Das Glied, das bisher beim Aufruf lieferte, liefert vorab und verlässt den Antwortweg.
- **Entkoppeln:** eine geteilte Funktion vom Antwortweg nehmen.

Jeder Vorschlag trägt dieselben sechs Angaben wie in `se-fmea`: Zweck (die Laufzeitanforderung, der
er dient), Kette, Ort, Handlungsklasse, Prognose (was besser wird, was gleich bleibt) und Preis. Der
Preis nennt immer zwei Dinge: das **Datenalter** (der Stand in der Antwort ist so alt wie die letzte
Speisung; dazu gehört die Anforderung aus b) und die **Schnittstelle der Funktion, die speist** (sie
bekommt einen neuen Fluss, und der braucht seinen Vertrag: ein Fluss ohne SCHEMA ist am Gate ein
Fehler; nenne, wie viele Ketten durch sie laufen, `chains` in `functions`). Die
Prognose sagt, welche Glieder nicht mehr in `answerPath` stehen sollen. Sie ist eine Aussage über
den Weg, keine über eine Dauer.

Das Vorbild, an einer Kette „Stand ansehen" mit `answerPath` = Anzeige und Ablage:

| Zweck | Kette | Ort | Handlungsklasse | Prognose | Preis |
|---|---|---|---|---|---|
| REQ-<laufzeit> | FCHAIN-<stand-ansehen> | FUNC-<ablage> auf dem Antwortweg, geteilt | Vorverlagern: Momentanstand vorhalten | die Antwort wartet nur noch auf FUNC-<anzeige>; die Glieder der Kette bleiben | Datenalter: der Momentanstand ist so alt wie die letzte Speisung, die Anforderung dazu fehlt (b). Schnittstelle: FUNC-<ablage> bekommt den neuen Fluss FLOW-<momentanstand> mit `async` und seinem Vertrag; durch sie laufen <Länge von `chains`> Ketten |

**Du wendest ihn nicht an.** Er ist Eingang der Optimierung (`se:optimize`), die ihn per Trockenlauf
probt; dort zeigt die Zeile der Kette danach, ob `answerPath` der Prognose folgt.

**d — Konflikte an geteilten Funktionen.** Verlangt ein Vorschlag an einer geteilten Funktion etwas,
das einer anderen Kette durch dieselbe Funktion schadet, notiere den Konflikt **an der geteilten
Funktion**: uid, die beteiligten Ketten (`chains` aus `scope`), was gegeneinander steht. Einer
geteilten Funktion lädst du keinen weiteren Fluss auf, ohne das zu nennen.

## 5. Ergebnis: ein CR

Schreib die Analyse als Text eines geschlossenen CR: `docs/cr/done/<nächste CR-Nummer>-<slug>.md`,
die nächste freie Nummer nach den Dateien in `docs/cr/open/` und `docs/cr/done/`. Eine neue Analyse
ist ein neuer CR. Abschnitte:

1. Kette, Laufzeitanforderung, `graphVersion`
2. Betrachtungsumfang: die gelesenen `requirements`
3. Antwortweg und Orte (die Tabelle aus Schritt 3)
4. Befunde je Ort (a)
5. Fehlende Anforderungen (b)
6. Vorschläge (Tabelle `Zweck | Kette | Ort | Handlungsklasse | Prognose | Preis`) und Konflikte an geteilten Funktionen (d), auch wenn sie leer sind
7. Was offen bleibt

**Anforderungen gehen durchs Gate.** Zeig dem Autor die fehlenden Anforderungen aus b und frag,
welche er schreibt und mit welchem Wert. Jede gewählte wird eine REQ mit ihrem Test, in einem
`graph_mutate`-Batch, `dryRun: true` zuerst. Eine Anforderung an Laufzeit oder Datenalter ist
nicht-funktional und hängt an der Kette (`R-18`):

```
## Nodes
### REQ
+ REQ-<datenalter>|<falsifizierbar: der Stand in der Antwort ist höchstens <Wert des Autors> alt> [__name:<Datenalter …>]
@kinds ["non-functional"]
### TEST
+ TEST-<datenalter>|<wie das Alter geprüft wird> [__name:<Test …>]

## Edges
+ FCHAIN-<kette> -satisfy-> REQ-<datenalter>
+ TEST-<datenalter> -verify-> REQ-<datenalter>
```

Lies `violations` im Ergebnis; ein Fehler blockt den ganzen Batch. Dazu der CR-Knoten (Kennung und
Titel, `status: "done"`) mit je einer `relation`-Kante auf jede REQ und jeden TEST, die dieser Lauf
schrieb. Ohne Wahl des Autors schreibst du nichts; die Lücke steht dann im CR unter „offen".

---

## Abschluss-Prüfliste

- [ ] `answerPath` aus `graph_metrics` zitiert, nicht nachgegangen
- [ ] bei `measurable: false` oder `answerPath: null` endete der Lauf mit dem Verweis auf `se-vorbereitung`
- [ ] je Zulieferer außerhalb des Antwortwegs die Anforderung an das Datenalter genannt oder als fehlend gemeldet
- [ ] jeder Vorschlag mit sechs Angaben, der Preis mit Datenalter und Schnittstelle
- [ ] kein Merkmal gesetzt, keine Zeit geschätzt, kein Umbau angewandt
- [ ] jede geschriebene Anforderung vom Autor gewählt und durch `graph_mutate`
