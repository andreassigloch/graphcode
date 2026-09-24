# CR-GC-637: Spike — parallele Pfade sind nicht aehnlich, sie teilen einen Engpass

**Status:** ✅ Done (2026-09-23)
**Typ:** aus Item ITEM-2026-522 (finding)
**Erstellt:** 2026-09-23
**Item:** bok/items/ITEM-2026-522.json (Lane: code)

---

## Frage

CR-GC-634 hat behauptet, man finde parallele Pfade nicht an der Aehnlichkeit, sondern am
gemeinsamen Engpass — belegt an **einem** Paar. Ein Paar ist eine Anekdote. Dieser Spike prueft
es an sieben belegten Paaren aus vier CR-Jahrgaengen und zwei Repos.

`scripts/spike-engpass-known-answer.mjs`, Bauart wie `spike-nd-known-answer.mjs` (CR-GC-542):
Known-Answer-Set, jedes Paar mit CR und Commit, gemessen am Stand **vor** dem Fix, Ergebnis sind
Zahlen.

## Das Set

| | CR | Art | A ↔ B |
|---|---|---|---|
| P1 | CR-SM-331 | Duplikat | contracts `serializeToFormatE` ↔ graph-api-core `serialize` |
| P2 | CR-GC-536 | Duplikat | graphcode `encode` ↔ graph-api-core `serialize` (Repo-Grenze) |
| P3 | CR-SM-335 | Duplikat | `functionCriticality` ↔ `fchainMustHaveIntegrationTest` |
| P4 | CR-GC-531 | zweite Pruefung | `codec.validate` ↔ contracts `traceRejection` |
| P5 | CR-SM-336 | zweite Tuer | Express `registerRoutes` ↔ `GraphService.mutate` |
| P6 | CR-GC-630 | zweiter Weg | `bootstrap` ↔ `formatEToCommands` |
| P7 | CR-GC-632 | zweiter Leser | Testhelfer `knotenAus` ↔ `formatEToCommands` |
| K1 | CR-GC-488 | Kontrolle, zeichengleich | `jaccard` ↔ `jaccard` |
| K2 | — | Kontrolle, fremd | `formatEToCommands` ↔ `impactedTests` |

## Ergebnis

### 1. Aehnlichkeit: 0 von 7

| | Name-Jaccard | Rumpf-Jaccard |
|---|---:|---:|
| P1…P7 | **0,000 in allen sieben** | 0,026 – 0,414 |
| K1 (zeichengleich) | 1,000 | 0,867 |

Kein einziges echtes Paar erreicht die ND-Schwelle 0,85. Die Kontrolle K1 tut es — das Mass ist
also intakt, es misst nur das Falsche. **Der Name traegt in keinem der sieben Faelle ein
gemeinsames Token.**

Das ist kein Schwellenproblem. Ein zweiter Pfad ist dem ersten nie aehnlich: er ist kuerzer
(16 gegen 183 Zeilen bei P7), anders benannt und kann weniger — das ist der Grund, warum ihn
jemand schreibt.

### 2. Gemeinsamer Engpass: 6 von 7 — aber auf DATEI-Ebene

| Ebene | Treffer |
|---|---:|
| Symbol (nur die beiden Rumpfe) | 2 von 7 |
| Datei (die beiden Dateien) | **6 von 7** |

Die Symbolebene ist blind, und P7 zeigt warum: `knotenAus` fasst den Engpass **nicht selbst** an
— es rief ein lokales `operationen()`, und erst das rief `FORMAT_E_CODEC.parse`. Eine
Indirektion genuegt. Der duplizierende Rumpf beruehrt die geteilte Ressource typischerweise
nicht direkt.

Die gefundenen Engpaesse: `attributeTypeOf`(4) · `FormatECodec`(15) · `functionCriticality`(6) ·
`GraphService`(18) · `MutateResult`(20) · `FORMAT_E_CODEC`(6).

**P4 faellt durch** — und die Luecke ist lehrreich: der geteilte Engpass ist dort kein
importiertes Symbol, sondern ein **Datenfeld**, `SE_DESCRIPTOR.edgeTypes[...].validPairs`. Wer
nur Importe zaehlt, sieht ihn nicht.

### 3. Als Detektor unbrauchbar — das Rauschen

Ueber alle 5.050 Dateipaare in `graphcode/src`:

| Alarmschwelle (Rang ≤) | Paare | Anteil |
|---:|---:|---:|
| 3 | 219 | 4,3 % |
| 5 | 335 | 6,6 % |
| 10 | 622 | 12,3 % |
| **20** | **1.175** | **23,3 %** |

Die echten Paare liegen bei Rang 4–20. Eine Schwelle, die sie faengt, faengt **fast jedes vierte
Dateipaar**. Recall 6/7 bei 23 % Fehlalarm ist kein Detektor.

### 4. Die Umkehrung — und die ist brauchbar

Nicht Paare ranken, sondern **Engpaesse**. Ein Engpass = ein WERT (kein Typ) mit wenigen
Anfassern, davon mindestens **zwei per Import**:

**96 Kandidaten aus 5.805 Bezeichnern.** Eine Seite Liste statt 1.175 Paare — und die drei, die
in diesem Umbau zaehlten, stehen darin: `FORMAT_E_CODEC`, `FormatECodec`, `formatEToCommands`.

(Erster Versuch war „2–4 Anfasser, mindestens ein Import" → 316 Kandidaten, unlesbar. Rang 2
heisst meistens „hier definiert, dort einmal benutzt". Erst zwei Importeure machen eine Tuer.)

## Schluss

**Aehnlichkeit ist fuer diese Fehlerklasse das falsche Werkzeug — mit Zahlen, nicht als Meinung.**
ND-01/ND-02 bleiben richtig fuer das, wofuer sie da sind (Copy-Paste, semantische Dubletten im
Modell); sie werden hier nicht angefasst und brauchen keine andere Schwelle.

Der brauchbare Weg ist der aus CR-GC-634, und dieser Spike liefert ihm den Vorrat: **keine
Suche, sondern eine Ratsche ueber benannte Tueren.** Die Liste der 96 Kandidaten ist der
Eingang fuer `tests/engpass-ein-leser.test.ts` — heute stehen zwei darin.

**Offen, benannt:** P4 zeigt, dass ein Engpass auch ein Datenfeld sein kann. Die Kandidatenliste
sieht nur Importe. Wer `SE_DESCRIPTOR.edgeTypes` als Tuer fuehren will, muss Feldzugriffe
mitzaehlen — ITEM-2026-522 nennt es, dieser CR loest es nicht.

---

## Nachtrag 2026-09-24: Wie die Abzweigung entstand (P6/P7)

Frage des Auftraggebers: Format-E war mehrfach als „ein Codec" festgelegt (CR-GC-103, REQ-formatE-parity,
CR-GC-536). Wer hat den zweiten Weg Text → `MutateCommand` trotzdem gebaut, und warum?

**Antwort vorab:** Die Abzweigung hat niemand beschlossen. Sie entstand in acht Zuegen ueber drei Monate. Jeder
Zug war fuer sich begruendet, und jeder hat die Ein-Codec-Regel an einer **anderen Stelle** geprueft
als an der, wo der naechste Pfad entstand. Alle Commits laufen unter der Identitaet des Auftraggebers
und wurden von Agenten geschrieben (Opus 4.8, Fable 5, Opus 5).

### Zeitleiste

| Datum | CR | Zug | Begruendung im CR | Was dabei abzweigte |
|---|---|---|---|---|
| 06-17 | 103 | `GraphCodeCodec` als Huelle um `FormatECodec` | „genau EIN Codec (Parity, L1)“; der Basis-Codec konnte keine Werte mit Komma/Klammer, sortierte nicht, pruefte nicht | ein **eigener Encoder** — der Mangel lag upstream, repariert wurde downstream |
| 06-18 | 122 | `bootstrap`: Text → `decode()` → Graph → add-Kommandos | Kaltstart durchs Gate | Abbildung Nr. 1, eigene Instanz `new GraphCodeCodec()` — noch kein Paar |
| 07-29 | 276 | `graph_mutate` bekommt `formatE` | „kein zweiter Schreibweg“ | Abbildung **Nr. 2** in einer Closure in `write.ts`, zeilengleich zu bootstrap nachgebaut. Geprueft war „ein **Gate**“, nicht „ein **Uebersetzer**“ |
| 07-29 | 268 | Fan-out im eigenen Encoder | CR schreibt selbst: „erbt die Reparatur **nicht**“ | Kosten des Forks erkannt und lokal bezahlt, statt ihn zu loeschen |
| 08-19 | 367 | host.ts: `new FormatECodec(...)` je Hook-Aufruf | CR erwaehnt den Codec gar nicht | dritte Instanz, beilaeufig — die kanonische hing an `ctx`, der Hook hat keinen |
| 09-16 | 536 | Encoder-Fork weg, Klasse bleibt „duenne Delegation“ | „Oberflaeche bleibt UNBERUEHRT … die Signaturen ueberleben“; `decode` sei „graphcode-eigen“ | der **Balkon**: Huelle behalten, damit der Umbau klein bleibt |
| 09-23 | 627 | `write.ts` parst direkt (`+ - ~ M`) | „`decode()` bleibt, was es ist: der Leseweg (Round-Trip, `graph_export`)“ | Behauptung **falsch** (siehe unten); bootstrap bleibt allein auf dem alten Weg — **P6** |
| 09-23 | 630–632 | ein Weg, Huelle geloescht, Testhelfer umgestellt | „keine parallelen Pfade“ | — |

### Der entscheidende Zug: CR-GC-627

- **Die Praemisse war ungeprueft.** Vor dem Zug hatte `decode()` genau zwei Produktionsaufrufer:
  `write.ts:317` und `bootstrap.ts:110`. `graph_export` nutzt es nicht. „Leseweg“ hiess also in
  Wahrheit: der eine Aufrufer, der uebrig bleibt, ist der zweite Schreibweg. Ein
  `git grep '\.decode('` zeigt das in einer Zeile. Dieselbe falsche Aussage hat der Agent der Analyse-Sitzung
  `82b7759d` am 2026-09-23 wiederholt: der CR-Text hat den Irrtum weitergegeben.
- **Die Aufrufer wurden am Namen des Griffs gesucht, nicht an der Operation.** Das Transkript zeigt
  `grep -rn "gcCodec" src/`. bootstrap hielt eine eigene Instanz, sein Aufruf hiess `codec.decode`,
  `gcCodec` kommt dort 0-mal vor. Die Suche konnte ihn nicht finden.
- **Auftragsform:** „setze CR 627-629 um.“ Drei CRs in einer Sitzung, 44 Minuten bis zum Commit,
  **0 graph-Aufrufe**. Der Umfang nannte 5 Dateien, bootstrap war keine davon.
- **Der Graph haette es auch nicht gezeigt.** `FUNC-decode` hatte 20 Kanten (CRs, FCHAINs, FLOWs),
  aber keine von `FUNC-bootstrap`. `graph_impact(FUNC-decode)` waere blind gewesen. Die
  Nutzungskante fehlte im Modell, und das seit CR-GC-122.
- **Ein Test hat den Irrtum festgeschrieben:** „decode bleibt Leseweg“ (in CR-GC-632 geloescht).

Die Sitzung, die CR-GC-627 und sein Item (ITEM-2026-504, `source: manuell`) formuliert hat, liegt in
keinem Transkript vor. Wer den Satz ueber `graph_export` geschrieben hat, laesst sich nicht belegen.

### Ursachen

| | Ursache | Zuege | Mit dem Engpass-Prinzip auffindbar? |
|---|---|---|---|
| U1 | **Upstream-Mangel downstream repariert.** Der richtige Ort (graph-api-core) kam erst drei Monate spaeter dran (CR-SM-331/332) | 103, 268 | nein — das ist eine Entscheidung, keine Codegestalt |
| U2 | **Invariante am falschen Ort formuliert.** „Ein Gate“ geprueft, „ein Uebersetzer“ nicht. REQ-formatE-parity („single codec, no fork“) hatte vier TESTs, keiner zaehlte Instanzen oder Aufrufer | 276 | ja — genau das zaehlt die Ratsche aus CR-GC-634 |
| U3 | **Die kanonische Instanz war unerreichbar** (in `ctx` oder in einer Closure). Ein neuer Aufrufer ausserhalb baut sich seine eigene | 122, 276, 367 | ja — ein neuer Importeur/Konstrukteur am Engpass |
| U4 | **Kleiner Umbau als Ziel.** „Signaturen ueberleben“ tauscht einen Weg gegen einen kleineren CR. *Vermutung:* das 10-Dateien-Limit belohnt Huellen | 536 | teilweise — eine Klasse, deren Methoden nur an ein Feld weiterreichen, ist messbar |
| U5 | **Aufrufer am Namen gesucht, Praemisse aus dem CR-Text uebernommen, drei CRs in einem Auftrag** | 627 | ja, wenn der CR-Abschluss-Hook (CR-GC-639) neue Importeure prueft |
| U6 | **Modell ohne Nutzungskante** (`FUNC-bootstrap → FUNC-decode` fehlte). Der Graph konnte die Frage nicht beantworten | 122 → 627 | nein — das ist eine Bindungsluecke, keine Codefrage |

### Schluss des Nachtrags

Vier der sechs Ursachen (U2, U3, U5, U4 teilweise) haette eine Ratsche ueber benannte Engpaesse
gesehen, und zwar **im Moment der Abzweigung**, nicht drei Monate spaeter. Die beiden anderen (U1,
U6) sind keine Codegestalt: U1 ist die Frage „wo gehoert der Fix hin“, U6 eine Modellluecke. Dass der
Graph bei CR-GC-627 blind gewesen waere, spricht nicht gegen „Graph fragen statt greppen“. Es sagt,
dass die Frage nur so gut ist wie die Nutzungskanten. Anschluss: ITEM-2026-525, Option (a).

### Alle sieben Faelle: fehlte Kontext, oder fehlte Recherche?

Frage des Auftraggebers, geprueft an allen sieben Faellen. Je Fall der Zug, der den zweiten Pfad
erzeugte, und der Beleg dafuer, ob der erste Pfad **bekannt** war.

| Fall | Zweiter Pfad entsteht | Erster Pfad bekannt? | Beleg | Warum trotzdem zwei | Lebensdauer |
|---|---|---|---|---|---|
| P1 | 03-23: ontologie-agnostischer `FormatECodec` in graph-api-core | wahrscheinlich (selbes Repo, 7 Tage alt), **nicht belegt** | Commit 8f1d969; kein Transkript aus dem Maerz | neue Abstraktion gebaut, die alte nicht abgebaut | ~6 Monate |
| P2 | 06-17: eigener Encoder in `GraphCodeCodec` (CR-GC-103) | **ja** — die Klasse umhuellt ihn | CR-GC-103, Codec-Kopfkommentar | Mangel lag upstream; ein Fix dort kostet einen Release-Zug ueber die Repo-Grenze | 3 Monate |
| P3 | 09-12: `functionCriticality` neben `chainsOfFunc` (CR-SM-314/313) | **ja** — woertlich abgewogen | Transkript 25acfeb9, 09:29 UTC: „Sauber waere … `chainsByFunc` … das waere die siebte Datei und sprengt die harte Grenze“ | Dateigrenze; **als Item benannt** (ITEM-2026-096) | **4 Tage** |
| P4 | 06-21: R-18 in der Engine, Paarpruefung im Codec bleibt (CR-GC-205) | **ja** | CR-GC-205: „`codec.validate()` bleibt Backstop … (oder ebenfalls als Regeln heben — pruefen)“ | Aufruf entfernt, Implementierung stehen gelassen; das „pruefen“ bekam kein Item | ~12 Wochen |
| P5 | 06-20: graphcodes Bridge nur lesend, `POST /mutate` in graph-api-express bleibt (CR-GC-114) | **ja** | CR-GC-114 testet selbst „POST /mutate → 404/405“ an der eigenen Bridge | lokal umgangen, an der Quelle (anderes Repo) nicht geschlossen | 3 Monate |
| P6 | 07-29 (CR-GC-276) und 09-23 (CR-GC-627) | 276: offen, kein Transkript. 627: **nein** | 627-Transkript: `grep gcCodec`, bootstrap 0 Treffer | falsch gesucht (Name statt Operation), Praemisse aus dem CR-Text uebernommen | 8 Wochen |
| P7 | 09-23 13:49: Testhelfer parst selbst (CR-GC-631) | **ja, maximal** | Transkript 82b7759d: Helfer importiert `FORMAT_E_CODEC` aus der Datei, die `formatEToCommands` enthaelt — beide vom selben Agenten, zwei Stunden auseinander, in einer Sitzung, deren Auftrag „keine parallelen Pfade“ lautete | Ersatz nach der Form der alten API gebaut (13 `decode`-Stellen, kleinster Diff); der Unterschied im Kopfkommentar als Vorzug gerechtfertigt („ist NICHT ihr Umzug“, „kennt keine Merges“) | 2 Stunden, gefunden erst auf Nachfrage |

**Befund: fehlender Kontext war nicht die Ursache.** In fuenf von sieben Faellen ist belegt, dass
der erste Pfad bekannt war (P2, P3, P4, P5, P7), bei P1 ist es wahrscheinlich. Nur ein Zug hat den
ersten Pfad nachweislich nicht gesehen (P6/627), und auch dort lag der Befund einen `git grep`
entfernt. Mehr Recherche haette hoechstens einen der sieben Faelle verhindert.

**Die gemeinsame Ursache ist eine andere: der Rueckbau lag ausserhalb des Auftrags.** Jeder Agent
hat seinen CR richtig abgeschlossen, und der alte Pfad lag jedes Mal jenseits einer Grenze dieses
CR:

| Grenze | Faelle |
|---|---|
| Repo-Grenze (Fix upstream kostet einen Release-Zug) | P2, P5 |
| Dateigrenze des CR | P3 |
| Umfangsgrenze („der Aufruf, nicht die Implementierung“) | P4 |
| kleinster Diff an den Aufrufstellen | P7 |
| neue Abstraktion statt Umbau der alten | P1 |

**Ob der Pfad als Item benannt wurde, entschied die Lebensdauer:** P3 wurde mit einem Item vertagt
und war in 4 Tagen beseitigt. P2 und P4 stehen nur im Fliesstext eines CR und lebten 3 Monate. Ganz
unbenannt lebten sie ebenfalls 2 bis 6 Monate. Das ist die globale Regel „verboten ist nicht die
Differenz, sondern die unbenannte“, gemessen: ein **benannter** paralleler Pfad ist harmlos, ein
**im Fliesstext erwaehnter** ist so gut wie unbenannt.

**Was daraus folgt:**
- **Kein Recherche-Skill.** Kein Agent hat mehr Kontext gebraucht, er hatte ihn.
- **Eine Rueckbau-Pflicht am CR-Abschluss:** Laesst ein CR einen zweiten Pfad bewusst stehen, braucht er
  eine Item-ID, keinen Satz.
- **Zwei Stellen koennen das pruefen:**
  - der Hook aus CR-GC-639 beim Schliessen eines CR (neuer Importeur an einem Engpass ohne Item im CR-Text);
  - `se-umbau` als Checklistenpunkt.
- **P7 zeigt, dass Wissen und ausdrueckliche Anweisung zusammen nicht genuegen.** Wer am Diff der
  Aufrufstellen optimiert, baut den Ersatz in der Form des Alten. Dagegen hilft nur ein mechanischer
  Zaehler, kein weiterer Satz im Prompt.

Nachvollziehbar mit `git log -S'class GraphCodeCodec'`, `git log -G'\.parse\(' -- src/surface/write.ts`,
`git grep '\.decode(' 5beb5bb^ -- src` und den Transkripten `b2703759` (P6, ab 10:03 UTC), `25acfeb9` (P3, 09-12 09:29 UTC) und `82b7759d` (P7, 09-23 13:49 UTC).
