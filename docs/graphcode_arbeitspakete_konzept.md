# Konzept: Arbeitspakete statt Befund-Schleife

Stand 2026-09-28. Wie der Executor ein kleines Modell mit begrenztem Kontext vom Groben ins Feine
führt — durch die Ontologie, ihre Regeln und den Graphen, den es selbst erzeugt. Seit 2026-09-28
konsequent als **Ebenenzyklus** (Abschnitt unten): Inhalt einer Ebene, Abschluss mit
Architekturreview, erst dann die nächste Ebene.

## Ziel und Kernthese

Der Executor ist als **Arbeitsvorbereiter** gedacht: ein System, fünf Use Cases, dann jeden Use Case
einzeln detaillieren, die anderen als Kontext. Das Modell wird vom selbst erzeugten Graphen geführt.

> **Kernthese:** Die `compose`-Bäume der Ontologie schneiden die Arbeitspakete. Die Regeln sind die
> **Abnahme** eines Pakets, nicht der Antrieb. Der Kontext eines Pakets ist die Faltung um seinen
> Anker. 7±2 (RD-04/RD-05) ist zugleich Architekturregel und Kontextgrenze.

## Befund: heute ist es eine Befund-Schleife

Gemessen an neun Läufen (`rig/greenfield-systemtest/auswertung-cr682.md`):

- `graph_generate` arbeitet vier Schritte vom Groben ins Feine (SYS, UCs, ACTORs, Gerüst). Ab der
  ersten FUNC wählt allein die **schwächste Readiness-Dimension über den ganzen Graphen** den nächsten
  Schritt (`generate.ts`, Phase `expand`). Jede Runde repariert einen Befund, keine baut etwas.
- Folgen: Wirkketten aus einer FUNC (23 von 43), die nur UC-02 erfüllt; 927-mal ein bestehender
  Knoten neu angelegt; 125 Dubletten; keine Architekturebene (median 0 MOD gegen 7 in der Referenz).
- Die UCs spiegeln den Seed-Satz statt des Auftrags: Schritt 2 destilliert „aus der Intention“, und
  die ist im Rig nur ein Verweis auf die Auftragsdatei.
- Die Vorbilder liefern Inhalt statt Form (Login in 9/9 Läufen, „Anfrage annehmen“ 63-mal) —
  ITEM-2026-607. Das SYSTEM-Vorbild in `executor-prompt.ts` trägt seit CR-GC-672 nur Platzhalter; die
  Läufe von CR-GC-682 lagen davor. Offen ist die UC-02-Klausel in `generate.ts` (`FLOW-anfrage`,
  `FUNC-anfrage-annehmen`, `ACTOR-nutzer`). Die Phase `arch` verlangt zwei Alternativen, die bei einem Kandidaten beide landen —
  ITEM-2026-610.

Derselbe Treiber kostet auch ein starkes Modell Qualität: Runde 20 lieferte Opus über Claude Code die
beste, über den Executor die zweitbeste Spec. Das Problem ist der Arbeitszuschnitt, nicht das Modell.

## Prinzip: Template je Anker-Typ

Ein Arbeitspaket hat einen **Anker** — ein Element aus einem der beiden Bäume — und alles, was dieser
eine Ebene tiefer braucht. Welches Template gilt, entscheidet der **Typ des Ankers**, nicht die Ebene;
die Ebenen sind nur die Reihenfolge. Das FUNC-Template gilt deshalb auf jeder FUNC-in-FUNC-Stufe, das
MOD-Template auf jeder MOD-in-MOD-Stufe — dieselbe Rekursion, die die Ontologie hat.

Ein Template hat sechs Teile; vier davon liefert die Ontologie:

| Teil | Quelle |
|---|---|
| Anker-Typ und Eingangsbedingung | Ontologie: der `compose`-Elternteil steht |
| Was angelegt wird (Typen, Kanten) | Ontologie: `TRACE_PATTERNS` mit dem Anker-Typ als Quelle, eine Ebene tief |
| Abnahme | Regeln, deren Geltungsbereich im Paket liegt |
| Folgepakete | Ontologie: die `compose`-Kinder werden neue Anker |
| Kontextrezept | festgelegt je Template (Abschnitt „Kontext“) |
| Arbeitsauftrag und Vorbild | festgelegt je Template — Träger ist der Skill (`<!-- inject:start/end -->`) |

## Katalog

| Template | Anker | legt an | abgeschlossen, wenn | Folge |
|---|---|---|---|---|
| **T-SYS** Rahmen | SYS | ACTOR, UC (SYS compose UC), je UC die Absätze des Auftrags, aus denen er stammt | R-17; 3–9 UCs; jeder Auftragsabsatz einem UC zugeordnet oder als Abgrenzung/offen markiert; keine zwei UCs über der Überlappungsschwelle | je UC ein T-UC |
| **T-UC** Szenario | UC | REQ mit `kinds` + TEST (UC compose REQ, TEST verify REQ); eine FCHAIN (UC compose FCHAIN) mit FUNCs als Blackbox; FLOWs ACTOR→FUNC→…→ACTOR mit SCHEMA-Stub; FUNC satisfy REQ, FCHAIN satisfy End-zu-End-NFR; Fragezeilen für offene Werte | UC-01/02/03, R-01, R-02, R-10, R-15, R-30, R-31, IO-02; ≤ 9 REQ und ≤ 9 FUNC je Kette | nach allen UCs: T-KONS |
| **T-KONS** Konsolidierung | Geschwistermenge einer Ebene | Zusammenlegen (`M a + b`) oder Unterscheiden je Kandidatenpaar | kein Paar über der Schwelle offen; R-12 | Teil des Ebenenabschlusses (T-EBENE) |
| **T-FUNC** Zerlegung | FUNC mit RD-04/RD-05 oder zu breiter Schnittstelle | 3–7 Unter-FUNCs (FUNC compose FUNC), interne FLOWs, bei Bedarf REQ compose REQ | RD-02 (Schnittstelle der Kinder = Schnittstelle des Elternteils), RD-04/05, R-21, R-31 | T-EBENE für diesen Anker, dann je Unter-FUNC |
| **T-EBENE** Ebenenabschluss | Anker, dessen Kinder stehen | Zusammenlegungen, Modulentscheidung je Kind (bleibt im MOD des Ankers oder eigenes MOD), fehlende Geschwister-Flüsse | Abschnitt „Ebenenzyklus": RD-04/05, T-KONS, BW-02/R-04, IO-01/R-31/FC-04, RD-02, R-22 für diese Kinder | nächste Ebene; beim Rücksprung T-EBENE des Elternteils (nur Rand) |
| **T-MOD** Struktur | SYS bzw. MOD | SYS/MOD compose MOD, FUNC allocate MOD, MOD satisfy nicht-funktionale REQ — **je Ebene im T-EBENE**; als eigenes Paket nur noch für die Wurzel (Stack) | R-22, R-23, R-04, R-12 | T-VERTRAG |
| **T-VERTRAG** Schnittstelle | FLOW mit SCHEMA | Felder des SCHEMA, TEST verify SCHEMA | R-10, R-32 | T-ABSCHLUSS |
| **T-ABSCHLUSS** | SYS | restliche Verifikation (R-01, R-05), MS/CR-Planung (MS compose UC/REQ/FUNC) | keine Fehler-Regel verletzt; offene Punkte benannt | — |

`realRef`/`testRef`-Bindung (R-20, R-26, R-19) gehört nicht in die Spezifikation — sie ist Sache der
Umsetzung und bleibt aus den Abnahmen draußen.

## Ein Vorgehen, zwei Stellgrößen

Das Vorgehen ist immer dasselbe — ob der Mensch es geht, ein Frontier-Modell oder der Executor mit
einem kleinen Modell: System, UCs, jeder UC bis zur Wirkkette, Konsolidierung, Zerlegung, Struktur,
Verträge. Die Templates **sind** dieses Vorgehen. Offen sind nur zwei Stellgrößen:

| Stellgröße | Frage | untere Grenze | obere Grenze |
|---|---|---|---|
| **Schnittgröße** | wie viel des Vorgehens ein Paket umfasst | ein Anker, eine Ebene — die kleinste abgeschlossene Einheit (Ontologie) | das Budget des Ausführenden: Kontext, Ausgabe, Zuverlässigkeit |
| **Kontextrezept** | was offen, als Box, als Index und aus dem Auftrag beiliegt | Anker offen, Geschwister als Box, Rest als `uid · type · name`, Auftragsausschnitt | der ganze Graph und der ganze Auftrag |

Ein Frontier-Modell oder der Mensch nimmt „System und alle UCs“ in einem Zug; ein kleines Modell
genau einen Anker. Je kleiner das Paket, desto mehr hängt am Kontextrezept — gemessen: beim kleinen
Modell entscheidet der Kontext, ob es den Auftrag abbildet oder das Vorbild (ITEM-2026-607).

Daraus folgen drei getrennte Teile, damit jeder Ausführende dasselbe Vorgehen mit seiner Einstellung geht:

1. **Template-Register** — Anker-Typ → Template (Skill-Text + Abnahmeregeln).
2. **Paket-Werkzeug** (MCP) — zu einem Anker und einer Schnittgröße: Kontext nach Rezept,
   Vorschlagsrahmen aus den `TRACE_PATTERNS`, Abnahmestand. Statt einer globalen Readiness-Zahl
   entsteht so eine Karte: je Anker, welche Abnahmen grün sind.
3. **Planer** — wählt den nächsten Anker; im Executor automatisch, sonst wählt ihn der Mensch.

Die Schnittgröße je Modell ist eine Messgröße, keine Annahme: das Rig misst je Modell die Abnahmequote
über Paketgrößen (ein Anker, eine Ebene · ein Anker, zwei Ebenen · alle Geschwister einer Ebene).

## Die Skills sind die Templates — neu geschnitten

Die `se`-Skills fassen diese Arbeitsgänge heute schon, aber nach Tätigkeit statt nach Anker:

| Template | heutiger Skill | Deckung |
|---|---|---|
| T-SYS | `top-level` (SYS-Blackbox, UCs), `author-uc`, `author-actor` | stark |
| T-UC | `author-req` (REQ + TEST); Wirkkette nur als Teil von `top-level` | halb — kein Skill „UC → Wirkkette mit FUNCs und FLOWs“ |
| T-KONS | — (`optimize` schlägt Merges nur als Architekturzug vor) | fehlt |
| T-EBENE | — (`top-level` kennt Blackbox-Zerlegung, aber keinen Abschluss je Ebene) | fehlt |
| T-FUNC | `top-level` („rekursiv per Blackbox-Zerlegung“) | vorhanden, im großen Skill |
| T-MOD | `top-level` (MOD + Stack), `optimize` | vorhanden |
| T-VERTRAG | `top-level` (Verträge) | am Rand |
| T-ABSCHLUSS | `close-violations` | stark |
| Planer | `generate` (heutiger Befund-Loop) | wird ersetzt |

`top-level` bündelt vier Templates in einem Arbeitsgang — für Mensch und Frontier ein Leitfaden, für
ein kleines Modell zu groß. Der Umbau heißt: `top-level` nach Ankern schneiden, die zwei Lücken
(UC → Wirkkette, Konsolidierung) schließen, `generate` durch den Planer ersetzen.

## Planer

Eine Warteschlange von Paketen ersetzt „schwächste Dimension über den ganzen Graphen“:

1. **In der Breite je Ebene, in der Tiefe im Paket — und jede Ebene wird abgeschlossen, bevor die
   nächste beginnt.** T-SYS → alle T-UC (Reihenfolge des Auftrags) → T-EBENE der UC-Ebene → je
   markierter FUNC: T-FUNC → T-EBENE → … → T-VERTRAG → T-ABSCHLUSS. Die Breite ist nötig, weil der
   Abschluss alle Geschwister sehen muss; die Architektur entsteht im Abschluss jeder Ebene, nicht
   als Nachsortieren am Ende (Abschnitt „Ebenenzyklus").
2. **Ein Paket = ein zusammenhängender Batch**, dann Gate, dann höchstens *k* Reparaturrunden **nur
   für die Befunde dieses Pakets**. Danach ist es abgeschlossen oder als „offen mit Grund“ markiert —
   nie endlos.
3. **Fremdbefunde gehen in die Warteschlange ihres Besitzers.** Besitzer ist der Anker, in dessen
   Teilbaum das betroffene Element liegt (`elternBaum` aus `src/loop/faltung.ts`). Ein Befund an einem
   Element, das noch keinen Anker hat, wartet auf das Template der nächsten Ebene.
4. **Ebenengrenzen sind Prüfpunkte für den Menschen.** Nach T-SYS die UC-Liste bestätigen, nach T-KONS
   die Zusammenlegungen — dort bündelt der Fragekanal (CR-GC-667) seine Fragen.

## Ebenenzyklus (2026-09-28)

Spezifikation und Architektur sind **ein** Modell. Getrennt werden nicht zwei Phasen, sondern zwei
Durchgänge **je Ebene** — die Blackbox-Logik der Leitlinie (§2: jede Ebene eine Blackbox mit 3–9
Kindern und schmalem Rand) konsequent als Arbeitsweise:

> **Eine Ebene ist ein Anker und seine `compose`-Kinder.** Durchgang 1 füllt sie mit Inhalt, die
> Kinder bleiben Blackboxen. Durchgang 2 schließt sie ab: ein Architekturreview nur dieser Ebene.
> Erst eine abgeschlossene Ebene darf geöffnet werden, und wer nach oben zurückkehrt, prüft den Rand.

Weder „nach jedem Inhaltszug ein Architekturzug" (zu kleinteilig, der Schnitt braucht die
Geschwister) noch „erst alles erzeugen, dann umsortieren" (die Knoten entstehen wild, das Sortieren
kostet mehr als das Erzeugen). Der Abschluss einer Ebene ist der natürliche Zeitpunkt: alle
Geschwister stehen, darunter ist noch nichts gebaut.

### Die drei Schritte

| Schritt | Umfang | Züge | Kontext |
|---|---|---|---|
| **1 Inhalt** | Anker öffnen, 3–9 Kinder anlegen | je Kind ein **Block**: das Kind mit REQ (`kinds`), TEST, satisfy/verify, dazu die Flüsse zwischen den Geschwistern und am Rand des Ankers | Anker offen, Geschwister des Ankers als Box, Rest als Index |
| **2 Abschluss** (T-EBENE) | nur diese Ebene | Zusammenlegen, Flüsse schließen, Modul je Kind entscheiden | alle Kinder offen, ihr Inneres leer |
| **3 Rücksprung** | Elternebene, nur ihr Rand | Rand nachziehen, wenn die Kinder ihn geändert haben | Anker als Box mit seinen Kindern |

### Was der Abschluss prüft

| Prüfung | Regel | Bemerkung |
|---|---|---|
| Breite 3–9 | RD-04, RD-05 | RD-05 „nur 1–2 Kinder": auflösen oder sammeln, **nie** mit Kopien auffüllen (gcrun-342: 7 Klone) |
| keine Dubletten unter Geschwistern | T-KONS, ND-01/02 | nur die Geschwistermenge — klein und genau |
| Datenfluss zwischen den Geschwistern geschlossen | IO-01, R-31, FC-04 | Inhalt, kein Architekturbefund: beantwortet mit Flüssen, nie mit Zerlegung oder MOD |
| Rand der Kinder = Rand des Ankers | RD-02 | der Blackbox-Vertrag |
| schmaler Rand | BW-02 (FUNC), R-04 (MOD) | |
| Modul je Kind | R-22 für diese Kinder | siehe unten |

### Modulentscheidung je Ebene

MOD und FUNC **können** identisch sein, müssen es nicht; bei Software ist das unkritischer als bei
Hardware. Der Modulschnitt folgt **technischen Randbedingungen**, nicht dem Datenfluss: Dateigröße
(≤ 500 Zeilen), Programmiersprache und Laufzeit, Frontend/Backend, APIs bündeln. Je Kind gibt es
darum genau zwei legale Antworten:

- **bleibt im MOD des Ankers** — der Normalfall, keine neue Struktur;
- **eigenes MOD** (`MOD compose MOD` unter dem MOD des Ankers), weil eine Randbedingung es verlangt —
  mit der Randbedingung als Begründung.

Die Entscheidung betrifft 3–9 Elemente statt des ganzen FUNC-Baums. Eine Rechnung liefert dafür nur
**Kandidaten**: CNM über die Kopplung der Kinder trifft den gezogenen Schnitt nicht (ARI ≤ 0,40 am
Golden und an graphcode), die Cluster liegen aber zu 63–77 % in einem MOD
([SPIKE-GC-inhalt-vs-architektur](spikes/SPIKE-GC-inhalt-vs-architektur.md)).

### Was global bleibt

Die Ebene fängt Dubletten unter Geschwistern — nicht dieselbe Anforderung unter zwei UCs. In
gcrun-343/344 lagen von 47 Dublettenpaaren 9 unter demselben Elternteil, 8 eine Ebene höher, **26 in
verschiedenen Zweigen**. Die Ähnlichkeitsprüfung beim Anlegen (Preflight) bleibt deshalb global und
gilt für jeden Typ, nicht nur REQ/UC.

### Belege (S2-Runde gcrun-342..344, `rig/greenfield-systemtest/zuege.mjs`)

- 76 % der Runden (91/120) vervollständigen halbe Inhaltsblöcke und erzeugen dabei 256 neue
  Fokusfunde — der Block-Zug in Schritt 1 ersetzt diese Kette.
- 10 der 12 Runden, in denen ein MOD entstand, hatten einen **Inhalts**-Fokus (IO-01, ND-01, UC-01,
  R-30): ohne Ebenengrenze beantwortet das Modell Inhaltsbefunde mit Architektur.
- „MOD + allocate" geht zu 36 % durchs Gate (4 Regeln für 95 %), Inhaltszüge zu 79–100 % (0–1 Regel).
- Nicht gemessen: ob der Zyklus Runden und Dubletten tatsächlich senkt — das zeigt erst eine
  S2-Runde, eingetragen in `docs/messung/verlauf.md`.

### Offen

- **Randbedingungen im Modell:** Sprache, Laufzeit, Schicht und Größe stehen heute nicht am Element.
  Ohne sie ist „eigenes MOD" eine Behauptung ohne Prüfer; Vorschlag: Attribute am MOD (Sprache,
  Laufzeit) und eine Regel, die ein Kind im Fremd-MOD ohne abweichende Randbedingung meldet —
  Contracts-Sache (Familie-Review).
- **Abschlusskriterium im Treiber:** Zustand je Ebene (offen / abgeschlossen / offen mit Grund) und ein
  Fokus, der auf die Ebene beschränkt ist. Heute zieht der Treiber Fundfenster je Regel über den ganzen
  Graphen und springt dadurch zwischen den Ebenen.
- **realRef im Spec:** R-19/R-20/R-26 stehen schon nicht im Fokus, aber noch in jeder Gate-Rückmeldung
  an das Modell — dort gehören sie im Spec ebenfalls heraus.

## Kontext eines Pakets

| Teil | Inhalt |
|---|---|
| offen | der Anker mit seinem Teilbaum, mit Beschreibung |
| Box | die Geschwister (andere UCs, andere FUNCs der Kette): uid, Name, ein Satz |
| Index | alles Übrige als `uid · type · name` — ohne Namen schlägt das Modell nach (CR-GC-682) |
| Auftrag | nur die Absätze, die T-SYS diesem Anker zugeordnet hat |
| offen gebliebene Fragen | die Fragezeilen und Antworten dieses Pakets |

Die **Auftragszuordnung** ist der wichtigste Hebel: der Executor nummeriert die Absätze des Auftrags
deterministisch (`[A1]` … `[An]`), T-SYS ordnet jedem UC seine Absätze zu, und jedes spätere Paket
bekommt nur seine. Damit kennt jedes Paket seinen Teil des Auftrags, statt dass der Seed-Satz der
einzige Inhalt im Kontext ist.

## Größe

RD-04/RD-05 begrenzen eine Zerlegung auf 7±2. Dasselbe hält ein Paket bei etwa 20–40 neuen Knoten.
Wird ein Paket größer, ist das kein Kontextproblem, sondern ein **Befund**: ein UC mit mehr als 9 REQ
wird geteilt (zurück an T-SYS), eine Kette mit mehr als 9 FUNC bekommt eine Zwischenebene (T-FUNC).
Der Graph teilt sich selbst in beherrschbare Stücke.

## Arbeitsteilung

| Executor (deterministisch) | Modell |
|---|---|
| nächstes Paket, Kontext bauen (Faltung, Auftragsausschnitt) | Inhalt des Pakets in einem Batch |
| Abnahme gegen die Regeln des Pakets, begrenzte Reparatur | Reparatur nur der Befunde dieses Pakets |
| Kandidatenpaare, Überlappung, Größensignal | Entscheidung Zusammenlegen/Unterscheiden, Fragezeilen |
| Alternativen nur, wenn ein Gate wählt (N > 1) | — |

**Vorbilder zeigen Form, nie Inhalt:** Platzhalter oder eine Domäne, die kein Auftrag hat. Kein
Login, keine „Anfrage annehmen“ (ITEM-2026-607).

## Was bleibt, was sich ändert

| bleibt | ändert sich |
|---|---|
| Gate, Preflight, Fragekanal, Faltung (`faltung.ts`), Inventar-Schalter | Phase `expand` in `generate.ts` → Planer mit Paket-Warteschlange |
| Seed-Stufen in `generate.ts` (werden T-SYS) | Schritt „UCs destillieren“ bekommt den nummerierten Auftrag |
| Skills als Träger des Arbeitsauftrags | ein Skill je Template, Vorbilder ohne Inhalt |
| Readiness als Messung | Readiness bestimmt nicht mehr den nächsten Schritt |

## Messplan

Korpus `sigllm-gcrun`, qwen3.8 (Spezifikationsmodell der lokalen Kette) und qwen3-coder, je 3 Läufe,
heutiger Treiber gegen Paket-Planer. Gemessen nach Leitlinie §9.3: Blindurteil gegen `golden/auftragspunkte.json`
(T-E10, `blindurteil.mjs`), Vorbild-Leck und Dubletten (T-E11, `verhalten.mjs`), Struktur gegen das
Golden (T-V5), Abnahmequote und Kontextgröße je Paket (T-E12), dazu je Runde Lösungsquote je
Fokusregel und Regel-Pareto je Zugtyp (`zuege.mjs`, CR-GC-708). Ein Paket-Planer, der das Blindurteil nicht hebt, ist widerlegt — auch wenn
die Readiness steigt.

## Schnitt in CRs

1. **Vorbilder und Alternativen** (ITEM-2026-607, ITEM-2026-610) — klein, Voraussetzung, allein messbar.
2. **Paket-Werkzeug, Planer-Gerüst, T-SYS mit Auftragszuordnung, T-UC** mit Faltung als Kontext und Paket-Abnahme; `top-level` in T-SYS/T-UC geschnitten.
3. **T-EBENE** (Ebenenabschluss mit T-KONS und Modulentscheidung je Kind) und der ebenenbeschränkte
   Fokus im Treiber; Preflight-Ähnlichkeit für jeden Typ.
4. **T-FUNC, T-VERTRAG, T-ABSCHLUSS**; T-MOD nur noch für die Wurzel.

Nach 2 wird gemessen; 3 und 4 nur, wenn 2 das Blindurteil hebt. Jede Messung steht als Zeile in
`docs/messung/verlauf.md` (CR-GC-709).

## Entscheidungen (2026-09-27)

- **Körnung der Auftragszuordnung: Absatz.** Der Executor nummeriert die Absätze des Auftrags
  (`[A1]` … `[An]`) und stellt jedem die Überschrift seines Abschnitts voran. Der sigllm-Auftrag hat
  19 Absätze unter 5 Überschriften gegen 33 Rasterpunkte; ein Satz verliert seinen Zusammenhang, eine Überschrift ist zu
  grob. Abschnitte der Abgrenzung und der offenen Punkte werden als solche zugeordnet, nicht einem UC.
- **Reparaturrunden: fest k = 2.** Gemessen über 316 Runden der CR-GC-682-Läufe werden 74 % beim
  ersten Batch angenommen, 88 % nach einer Reparatur, 92 % nach zwei, 93 % nach drei; 22 nie. Nach
  k = 2 ist das Paket „offen mit Grund“, der Befund geht an den Besitzer. Eine Kopplung an die
  Paketgröße ist erst messbar, wenn es Pakete gibt.
- **Templates: Code und Skill.** Kontextrezept, Vorschlagsrahmen und Abnahme sind Code im
  Paket-Werkzeug — deterministisch, testbar, für jeden Ausführenden gleich. Der Skill trägt nur
  Arbeitsauftrag und Form-Vorbild; so bleibt er Leitfaden für Mensch und Frontier. Grund: Beispiele
  in Skills werden als Inhalt übernommen (CR-GC-655), und Regeln im Skill-Text driften gegen die
  Grammatik (se-Skills gegen R-18).
- **Frontier-Pfad:** dasselbe Vorgehen, andere Schnittgröße (Abschnitt „Ein Vorgehen, zwei Stellgrößen“).

## Vorversuch T-SYS (2026-09-27, n = 1 je Modell)

Das T-SYS-Paket von Hand gebaut (19 nummerierte Absätze des sigllm-Auftrags, Form-Vorbild mit
Platzhaltern, Abnahme als Anweisung), direkt über das sigllm-Gateway:

| | qwen3-coder | qwen3.8 |
|---|---|---|
| Zeit | 21 s | 1 049 s, 93 % der Ausgabe Denken |
| Absätze genau einmal zugeordnet, Abgrenzung/offen richtig | 19/19, ja | 19/19, ja |
| offene Punkte des Auftrags als Frage / erfundene Werte | 5/5 / 0 | 5/5 (+ 7 weitere) / 0 |
| Form | uids behalten `«…»` trotz Anweisung | sauber |
| Use Cases | 9; Akteur fast immer das System selbst, Scheitern-Punkte als UC | 7, zwei echte Akteure; ein Sammel-UC mit 6 Absätzen |

Im Paketzuschnitt erfindet keines der Modelle Werte — anders als im Executor-Lauf (CR-GC-682). Der
Unterschied liegt im Urteil, was ein Use Case ist, und genau dort steht der Prüfpunkt nach T-SYS.
Mit 12 000 Token Budget lieferte qwen3.8 nach 753 s keine Antwort; ohne präzisierte Form wiederholte
der Coder eine Zeile bis zum Abbruch. Folgemessung: N = 3 je Modell, Coder mit Vorbild aus fremder
Domäne, UC-Listen im Blindurteil, dazu qwen3.8 als Prüfer eines Coder-Entwurfs.

## Offen

- Welche Schnittgröße trägt qwen3.8, welche qwen3-coder — erste Messung nach CR 2 (Leitlinie T-E12).
