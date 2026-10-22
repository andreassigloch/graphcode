---
name: se-vorbereitung
version: 3
description: Modell vor den Kettenanalysen vorbereiten — Wirkketten schließen, Gegenmaßnahmen dem tiefsten Träger zuordnen, Flüsse als synchron oder asynchron kennzeichnen, jeden Fluss am Code prüfen. Am Abschluss der Modulstufe (Marke PDR), vor se-fmea. Schlägt Züge vor, baut nicht selbst um.
---

# se-vorbereitung — erst das Modell, dann die Analyse

## Wofür dieser Skill da ist

Eine Analyse ist so gut wie das Modell, das sie liest. Zwei Dinge müssen stehen: die Wirkketten
sind geschlossen, und jede Anforderung hängt am richtigen Träger auf der tiefsten möglichen Ebene.
Das ist Hygiene, keine Analyse. Der Ort ist der Abschluss von Stufe 7 der Regelmatrix (Module), an
der Marke PDR, vor `se-fmea` auf Stufe 8.

Du führst durch fünf Schritte. Je Lücke schlägst vor, was sie schließt, und der Autor wählt.
Die gewählten Züge sind ein gewöhnlicher CR im Repo des Modells und gehen durch `graph_mutate`.
Du rechnest keine Kennzahl: was du brauchst, liest du aus `graph_metrics` und aus den Befunden
(`rules_evaluate`, `rules_get_violations`). Du beurteilst kein Risiko und keine Laufzeit.

**Einheit ist eine Wirkkette.** Ohne benannte Kette gehst du die Ketten des Umfangs einzeln durch
(`graph_elements({ type: "FCHAIN" })`). Ein späterer Schritt beginnt erst, wenn der frühere nichts
mehr meldet oder der Autor das Offene benannt hat.

---

## 1. Kette schließen

```
graph_metrics()                              # Zeile der Kette in chains: measurable, sonst reasons
rules_get_violations({ detail: "grouped" })  # Befunde der Verdrahtung an der Kette und ihren Gliedern
```

Die Regeln der Verdrahtung sind `R-30`, `R-31`, `R-21`, `IO-01`, `FC-04` und `FC-05`. Alle sind
Warnungen; das Gate hält eine offene Kette nicht auf.
Ein Befund von `FC-05` (die Kette hängt nicht zusammen) hält die Marke PDR.

`measurable: false` an einer Kette des Umfangs: der Lauf endet nach diesem Schritt, mit den Zügen als Ergebnis.

| `reasons` | Was fehlt | Zug |
|---|---|---|
| `FC-05` | ein Glied liefert an kein anderes Glied | Fluss zwischen Erzeuger und Abnehmer, oder das fehlende Glied |
| `loose-member` | ein Glied ohne Eingang oder ohne Ausgang (`R-31` nennt es) | die fehlende `io`-Kante, oder das Glied gehört nicht in diese Kette |
| `no-entry` | kein Fluss von außen in die Kette | Eingang vom Akteur: `ACTOR io FLOW io FUNC` |
| `no-exit` | kein Fluss aus der Kette nach außen | Ausgang zum Akteur, auf demselben Weg |
| `empty` | die Kette hat kein Glied | Glieder zuordnen (`FCHAIN compose FUNC`) |

Eine bewertbare Kette mit offenem Befund an einem Glied: erst schließen, oder der Autor bestätigt
ihn als bewusst offen. Ein Block ist kein Glied einer Kette und trägt keine Anforderung: `FC-03` ist ein Fehler, den das Gate hält.
Glied wird die Blattfunktion darunter.

## 2. Anforderungen zuordnen

**Die Grammatik zuerst** (`R-18`, am Gate ein Fehler):

- Eine Funktion erfüllt nur funktionale Anforderungen.
- Eine nicht-funktionale Anforderung hängt an Kette, Modul oder System.

Lies `riskCarriers` aus derselben Antwort von `graph_metrics`:

- `risks`: je Risiko `riskId`, `carriers` (die Blattfunktionen, die es tragen) und `satisfiers`,
  je Eintrag die Gegenmaßnahme (`mitigation`) und ihr Erfüller (`by`), wie modelliert.
- `surface`: dieselben Paare je Funktion.

Welche Anforderungen an der Kette hängen, sagt `scope`: `graph_metrics({ scope: ["<FCHAIN>"] })`
liefert `modules`, `chains` und `requirements`. Bearbeite die Gegenmaßnahmen darin.

Ziel ist ein Träger je Risiko. Ein Erfüller, der ein Modul ist, macht jede Blattfunktion des
Moduls zum Träger. Dafür gibt es keine Regel; es ist der Hinweis dieses Schritts. Ordne jede
Gegenmaßnahme, deren `by` ein Modul oder das System ist, einer von vier Klassen zu:

| Klasse | Erkennbar an | Zug |
|---|---|---|
| **Tieferlegen** | genau eine Funktion führt die Gegenmaßnahme aus | als funktionale Anforderung fassen und dieser Funktion zuordnen |
| **Zerlegen** | zwei Aussagen in einer Anforderung | in zwei Anforderungen teilen, dann jede neu einordnen |
| **Funktion fehlt** | keine Funktion im Modell führt sie aus | kein Zug. Befund am Funktionsbaum; **Funktion fehlt** wird ein Item, die Gegenmaßnahme bleibt, wo sie ist |
| **Gilt quer** | sie bindet jede Funktion, keine einzelne | bleibt am System. Der Ort dort ist die Kennzeichnung; in `carriers` zählt sie nicht |

**Vor dem Tieferlegen: die Bindung der Funktion lesen** (`realRef` aus `graph_context`), nicht
nur den Text. Führt der gebundene Code die Gegenmaßnahme aus, steht der Vorschlag. Führt sie
eine andere Funktion aus, gilt der Code. Führt sie keine aus, sag das am Vorschlag; der Autor
entscheidet zwischen Modul und der Klasse „Funktion fehlt".

Das Vorbild für einen Zug der Klasse Tieferlegen, `dryRun: true` zuerst:

```
## Nodes
### REQ
~ REQ-<gegenmassnahme>
@kinds ["functional"]

## Edges
- MOD-<modul> -satisfy-> REQ-<gegenmassnahme>
+ FUNC-<funktion> -satisfy-> REQ-<gegenmassnahme>
```

Ob eine Gegenmaßnahme quer gilt, ist ein Urteil des Autors. Du legst deine Einordnung als
Vorschlag vor und kennzeichnest sie so. Ein Risiko ohne Gegenmaßnahme oder ohne Erfüller melden
`FM-02` und `RD-01` schon; zitiere sie.

## 3. Flüsse kennzeichnen

Die Laufzeitanalyse (`se-laufzeit`) liest den Antwortweg der Kette: die Glieder, auf die die
Antwort an den Akteur wartet. `graph_metrics` liefert ihn je Kette als `answerPath` und liest dafür
das Merkmal `sync` an den Flüssen. Deine Arbeit ist die Liste daneben:

```
graph_metrics()    # Zeile der Kette in chains: answerPath, answerPathBlockedBy
```

- `answerPath` ist eine Liste, auch eine leere: der Weg ist lesbar, dieser Schritt meldet nichts.
- `answerPath: null`: `answerPathBlockedBy` nennt die Flüsse, die ihn verhindern. Ein Fluss hindert aus einem von zwei Gründen; welcher es ist, zeigt `graph_get_node` am Fluss:
  - er trägt das Merkmal nicht lesbar: frag den Autor und kennzeichne ihn (unten),
  - er trägt `sync` und kommt von einer Funktion außerhalb der Kette: die Kette ist offen. Zurück zu Schritt 1: die Funktion wird Glied, oder der Fluss ist asynchron.

Die Liste nennt die Hindernisse, auf die der Weg trifft, nicht jeden Fluss ohne Merkmal. Nach
jedem angewandten Zug liest du neu, bis `answerPathBlockedBy` leer ist; es können weitere dahinter stehen.

Die Frage je Fluss ohne lesbares Merkmal:

> Wartet die Antwort des Abnehmers auf diese Lieferung?

Ja heißt synchron, nein heißt asynchron (vorab geliefert). Im Code heißt Ja: der Aufrufer wartet auf den Rückgabewert. Ein Rückruf, ein Ereignis oder eine Datei, die später jemand liest, heißt Nein. Der Zug je Fluss:

```
## Nodes
### FLOW
~ FLOW-<abgerufen>
@sync sync
~ FLOW-<vorab-geliefert>
@sync async
```

- Wird derselbe Inhalt von einem Abnehmer abgerufen und einem anderen vorab geliefert, sind das zwei Flüsse. Schlag die Trennung vor.
- Ohne Antwort des Autors bleibt der Fluss ohne Merkmal, steht im Bericht, und `answerPath` bleibt `null`.

## 4. Flüsse am Code prüfen

Die Regeln sehen, ob ein Fluss verdrahtet ist, nicht, ob der Code ihn macht. In graphcodes eigenem
Modell nannten etwa 4 von 10 Flüssen einen Weg, den kein Code geht (CR-GC-832..838). Jede Regel
ließ sie durch.

Je Fluss der Kette zwischen zwei Funktionen:

```
graph_context("<FUNC-erzeuger>")   # realRef des Erzeugers und seine Flüsse
```

Lies den Code an der `realRef` des Erzeugers. Such die Stelle, an der der Inhalt zum Abnehmer geht.

| Ergebnis | Erkennbar an | Zug |
|---|---|---|
| **belegt** | der Erzeuger ruft den Abnehmer, oder der Abnehmer ruft den Erzeuger und bekommt den Inhalt zurück | Datei und Symbol der Stelle in die Beschreibung des Flusses |
| **falscher Abnehmer** | der Inhalt geht an eine andere Funktion, meist an das Werkzeug dazwischen | Fluss umhängen; fehlt das Werkzeug als Funktion, es anlegen |
| **kein Aufruf** | keine Stelle im Code reicht den Inhalt weiter | Fluss löschen; ist er gewollt, wird er ein Item, nicht Modell |
| **ohne Bindung** | eine Seite hat keine `realRef` | erst binden; bis dahin steht der Fluss ungeprüft im Bericht |

Drei Muster fanden sich am häufigsten:

- Der Fluss überspringt das Werkzeug: der Akteur liefert direkt an eine Kernfunktion.
- Die Antwort geht an den letzten Leser, nicht zurück an den Aufrufer.
- Der Abnehmer soll den Speicher lesen, bekommt den Graphen aber als Argument vom Aufrufer.

Ein Fluss mit `sync`, auf den der Aufrufer nicht wartet, geht zurück an Schritt 3.

## 5. Bericht

Je Kette, alles zitiert und nichts gezählt, was `graph_metrics` nicht liefert:

| Punkt | Quelle |
|---|---|
| bewertbar | `measurable`, sonst `reasons` |
| Träger je Risiko | `carriers` je `riskId` |
| Sockel | die `satisfiers`, deren `by` das System ist |
| Antwortweg | `answerPath`, sonst die Flüsse aus `answerPathBlockedBy`, je mit ihrem Grund |
| Flüsse am Code | je Fluss eines der vier Ergebnisse aus Schritt 4, mit Datei und Symbol |
| Vorschläge | je Zug: Klasse, Elemente, Format-E, gewählt oder offen |
| offen | was bleibt, mit Grund; je „Funktion fehlt" das Item |

Der Bericht ist der Eingang des CR, der die gewählten Züge anwendet.

---

## Abschluss-Prüfliste

- [ ] jede Kette des Umfangs bewertbar, oder der Lauf endete in Schritt 1
- [ ] je Gegenmaßnahme an Modul oder System eine der vier Klassen, als Vorschlag gekennzeichnet
- [ ] vor jedem Tieferlegen die Bindung der Funktion gelesen
- [ ] `answerPath` der Kette lesbar (`answerPathBlockedBy` leer), oder die hindernden Flüsse im Bericht als offen
- [ ] jeder Fluss der Kette am Code geprüft, oder als ungeprüft im Bericht
- [ ] kein Zug ohne Wahl des Autors; jeder gewählte durch `graph_mutate`
