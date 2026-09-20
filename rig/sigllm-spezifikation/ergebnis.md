# Ergebnis — Lauf 1 und Lauf 2, 2026-09-19

Ein Lauf, Arm `opus5` über `claude -p`, n = 1. Rohdaten in
`../greenfield-systemtest/results-sigllm.json` und `../greenfield-systemtest/runs/opus5-0/`.

## Der Satz vorweg

Der Auto-Modus liefert in **18 Minuten für 8,25 $** einen Graphen von vergleichbarer Größe zu
dem, was der handgeführte Lauf in **26 Stunden** gebaut hat — mit **null Fehler-Verstößen**
gegenüber 16 und zwei Gate-Ablehnungen gegenüber 35.

*(Korrektur: die erste Auswertung meldete 0 Ablehnungen. `legality()` zählte nur
`tier === 'block'`, und keiner der 13 Datensätze trägt ein `tier` — es waren 2, beide sofort
repariert. Die Messung ist gefixt.)*

**Die Null bei den Fehlern ist kein Ergebnis, sondern die Abwesenheit einer Frage.** Der Arm hat
keine einzige der fünf Analysen durchgeführt. Ohne FMEA gibt es keine Risiko-Anforderung, ohne
Risiko-Anforderung kann FM-03 nicht feuern, und FM-03 sind genau die 16 Fehler des Goldens. Der
sauberere Graph ist der ärmere.

## Die Zahlen

| | Arm (Auto) | Golden (Hand, v98) |
|---|---:|---:|
| Elemente / Kanten | 238 / 524 | 255 / 506 |
| **Fehler-Verstöße** | **0** | 16 (alle FM-03) |
| Warnungen | 158 | 216 |
| Gate-Ablehnungen | 2 | 35 |
| Steuerwert | 0,500 | 0,500 |
| Anker | `R-04@MOD-agent-loop` | `BW-02@FUNC-agent-management` |
| Wall-Zeit | **17,9 min** | ~26,4 h |
| Kosten | 8,25 $ | nicht erfasst |
| Token ein / aus | 8 816 / 109 147 | nicht erfasst |

Typen:

| Typ | Arm | Golden | |
|---|---:|---:|---|
| SYS | **6** | 1 | der Arm behielt die Zerlegung des Briefs |
| UC | 3 | 3 | gleich viele, andere Schnitte |
| ACTOR | **7** | 3 | der Arm fügte hinzu, der Mensch strich |
| FUNC | 29 | 24 | |
| FLOW | 39 | 28 | |
| SCHEMA | 33 | 24 | |
| MOD | 10 | 7 | |
| REQ | **49** | 80 | |
| TEST | **35** | 63 | |
| CR / MS | 17 / 4 | 14 / 4 | beide bis zum Plan |

## Was der Arm besser gemacht hat

- **Er hat `MOD.path` gesetzt — 10 von 10.** Im handgeführten Lauf trug **kein einziges** der
  sieben Module einen Pfad; genau deshalb meldete RC-05 dort 0 Befunde bei 19 % Reichweite, und
  der Pfad musste am 18.09. von Hand nachgetragen werden (Review §9). Der Arm tat ungefragt, was
  dem Menschen entging.
- **Zwei Ablehnungen** gegen 35 im handgeführten Lauf, bei 238 Elementen — und **beide sofort
  repariert und wieder vorgelegt**. Er hat außerdem `validate` als Trockenlauf benutzt, bevor er
  mutierte: das Gate-Protokoll, das laut Executor-Abschlussbericht 2026-08 nur Haiku freiwillig
  befolgte.
- **Er hat bei v6 zurückgenommen**, fünf `compose`-Kanten gelöscht. Nicht nur additiv.

## Was er schlechter gemacht hat

- **Keine Analyse.** Der SYS-Knoten trägt **keinen einzigen** `analysisFreshness`-Stempel; das
  Golden trägt vier (assumption-review, fmea, conops, trade). 0 von 49 REQ tragen S/O/D, das
  Golden 16 von 80. AF-01…05 sind `warning` und blocken nicht — sie stecken in den 158 Warnungen
  und haben den Lauf nicht aufgehalten.
- **Er hat die Systemgrenze nicht gezogen, sondern abgeschrieben.** Sechs SYS-Knoten und sieben
  Akteure, Namen und Nummern direkt aus der Projektdefinition (SYS-01…05, ACT-01…06, plus ein
  selbst erfundener siebter). Der Mensch legte 17 Akteure an und verwarf 14 — die Arbeit, die im
  Review §14 als das Beste des Laufs steht. Der Arm hat sie nicht getan.
- **Anforderungen und Nachweis dünn:** 49 REQ gegen 80, 35 TEST gegen 63, 49 `verify`-Kanten
  gegen 105.
- **Alle 49 REQ tragen `kinds` als Zeichenkette statt als Liste** (`"non-functional"` statt
  `["non-functional"]`). Das Gate nahm alle an. Das ist die Live-Reproduktion von
  ITEM-2026-007 — Sichten filtern solche REQ still weg.

## Was das für den Vergleich heißt

Die beiden Graphen sind **nicht gleich gut und nicht gleich schlecht — sie sind an
verschiedenen Stellen dünn.** Der Arm ist formal sauberer und strukturell reicher an
Verträgen; der Mensch ist reicher an Anforderungen, Nachweis und Risiko — und hat als einziger
die Systemgrenze wirklich verhandelt.

Der teuerste Befund ist methodisch, nicht modellseitig: **ein fehlendes Analyse-Artefakt
erzeugt keinen Fehler, nur eine Warnung.** Damit kann ein Lauf, der nichts analysiert, mit
`compliance = 1` enden. Dieselbe Klasse wie RC-05 bei 19 % Reichweite: die Regel schweigt nicht,
weil alles gut ist, sondern weil niemand gefragt hat.

## Vorbehalte

- **n = 1.** Ein großer Unterschied ist sichtbar, ein kleiner nicht.
- **Die Projektdefinition trägt bereits eine Systemzerlegung und sechs Akteure.** Dass der Arm
  sie übernommen hat, ist auch eine Folge des Briefs. Der Mensch hatte denselben Brief und hat
  ihn verworfen — der Vergleich ist fair, aber „top-down aus dem Nichts" prüft er nicht.
- **Ungleicher Umfang.** 18 Minuten gegen 26 Stunden vergleicht nicht dieselbe Arbeit: die 26
  Stunden enthalten vier Analysen und fünf Neuschnitte der Akteursmenge, die der Arm nicht
  gemacht hat.
- **Dies ist nicht der Kontrollarm aus Leitlinie Satz 7.** Dieser Arm lief **mit** graphcode.

---

## Nachtrag: die Steuerung

Gefragt war, ob die Steuerung in diesem Lauf besser gegriffen hat. **Sie hat schlechter
gegriffen, und der Grund ist die Stapelgröße.**

| | Auto (Opus) | Hand (bis v98) |
|---|---:|---:|
| Audit-Datensätze | 13 | 134 |
| angewendete Züge | **9** | 99 |
| Kommandos | 772 | 1 473 |
| **Kommandos je Zug** | **86** | **15** |
| Werkzeug-Konsultationen | **8** | 122 |
| ℝ⁶ bewegte sich | 4-mal | 22-mal |
| Steuerwert bewegte sich | 1-mal | 1-mal |
| Steuerwert am Ende | 0,500 | 0,500 |
| Anker am Ende | `R-04@MOD-agent-loop` | `BW-02@FUNC-agent-management` |

Der Arm hat 238 Elemente in **neun Stapeln** autoriert — einer davon 195 Kommandos groß. Die
Steuerung spricht *zwischen* den Zügen; bei neun Zügen hat sie **acht Gelegenheiten**. Der
handgeführte Lauf hatte 98. Prozentual sieht der Auto-Lauf besser aus (ℝ⁶ bewegt sich in 50 %
statt 22 % der Intervalle), absolut ist es ein Viertel der Information.

**Er hat die Steuerwerkzeuge durchaus gerufen** — `graph_next_step` zweimal, `graph_suggest`
einmal, dazu `graph_authoring_guide`, `graph_generate`, `graph_elements`, `graph_help`,
`rules_evaluate`. Acht Konsultationen in 18 Minuten. Der `graph_suggest`-Aufruf steht bei v8,
direkt vor dem einzigen abgelehnten Mutations-Stapel.

**Und er bekam nichts.** Am Endstand des Arms stehen 172 Befunde, davon **0 mit ausführbarer
Vorlage**. Die sieben ausgelieferten Vorlagen (CR-R01, R-22, R-23, SC-02, R-18, MS-03, UC-02)
decken keinen einzigen. Die fünf größten Posten sind BQ-06 (49), BQ-02 (45), R-20 (29),
CR-R03 (16), CR-01 (14) — keiner davon hat eine. **Auch der Anker `R-04` hat keine.**

Das ist ITEM-2026-281, unabhängig in einem zweiten Lauf bestätigt: die Empfehlungsmaschine
antwortet auch dann nicht, wenn sie gefragt wird.

**Neu ist der Befund zur Auflösung:** die Stapelgröße ist eine Steuergröße, die niemand setzt.
86 Kommandos je Zug sind nicht falsch — der Arm war schnell, legal und hat repariert —, aber sie
machen jede Kennzahl, die zwischen Zügen misst, blind. Das trifft ℝ⁶, den Steuerwert und
**alle drei bestätigten Vorschläge aus Review §18** gleichermaßen.
→ [ITEM-2026-348](../../../bok/items/ITEM-2026-348.json)

---

## Nachtrag: die Anforderungen des Auftrags

Zum Abschluss gehört die Frage, ob **jede** Anforderung der initialen Beschreibung umgesetzt
oder ausdrücklich verworfen wurde. Die Prüfliste steht in
[`golden/anforderungen-auftrag.json`](golden/anforderungen-auftrag.json): die 42 Anforderungen
aus §3 der Projektdefinition, verbatim, aus dem Initialisierungs-Commit.

**Beide Hälften der Frage sind im Modell heute nicht ausdrückbar.** Es gibt kein Feld für die
Herkunft eines REQ, und das `status`-Enum kennt `draft | reviewed | open | done` — kein
„geprüft und bewusst nicht übernommen". Eine verworfene Anforderung verschwindet spurlos und ist
von einer vergessenen nicht zu unterscheiden. → ITEM-2026-306

**Die Ersatzmessung warnt vor sich selbst.** Wortlaut-Überdeckung liefert:

| | gedeckt (≥ 0,3) | davon exakt 1,00 |
|---|---:|---:|
| Arm (Auto) | **42 / 42** | 11 |
| Golden (Hand, v98) | **15 / 42** | 0 |

Das ist kein Vollständigkeitsunterschied, sondern der Abschreib-Befund noch einmal: der Arm hat
den Wortlaut übernommen und **sogar die Nummerierung in die Kennungen gezogen** —
`REQ-019-ttft-budget`, `REQ-029-queue-serialization`, `REQ-004-durable-ledger`. Der Mensch hat
umformuliert und fällt deshalb durch.

Eine Deckungsnote auf Textähnlichkeit würde also Transkription belohnen und Spezifikationsarbeit
bestrafen. Sie ist im Rig deshalb als **Liste** eingebaut, sortiert nach der schwächsten
Überdeckung, nicht als Zahl — dieselbe Linie wie beim Modul-Audit.

---

# Lauf 2 — der prosaische Auftrag

Derselbe Inhalt ohne Kennungen, ohne Zerlegungstabelle, ohne Akteursliste. Die Struktur ist
damit Teil der Aufgabe. `runs/opus5-3`, 27 Minuten, $8.96, kein Abbruch.

## Die Zahlen nebeneinander

| Kennzahl | Lauf 1 strukturiert | Lauf 2 prosaisch |
|---|---|---|
| Elemente / Traces | 238 / 524 | 248 / 497 |
| UC / FUNC / MOD / REQ / TEST | 3 / 29 / 10 / 49 / 35 | 6 / 41 / 8 / 44 / 60 |
| compliance | 1,000 | 0,863 |
| Elemente mit Fehlern | 0 | 34 |
| Gates | 3/8 | 2/8 |
| Gate-Ablehnungen | 2 | 2 |
| Steuerwert @ Anker (kleiner ist besser) | 0,50 @ R-04@MOD-agent-loop | 0,75 @ R-04@MOD-jobs |
| Code-Urteil | nicht prüfbar | **gedriftet** |
| Bindung Blatt-FUNC | 0/29 (0 %) | 33/33 (100 %) |
| Wall / Kosten | 18 min / $8.25 | 27 min / $8.96 |

## Der Befund, der die Sitzung wert war

**Die 100 % Bindung sind erfunden.** Alle 33 `realRef` des Prosa-Laufs zeigen auf Dateien, die
es nicht gibt — `src/gateway/accept-request.ts`, `src/guard/anomaly.ts`, `src/jobs/load-
declaration.ts` und dreißig weitere. Nachgezählt im Arbeitsverzeichnis: **0 von 33 vorhanden.**
Es ist ein reiner Spezifikationslauf, es gibt überhaupt keinen Quellcode.

Lauf 1 hat gar keine `realRef` gesetzt und steht deshalb auf `nicht prüfbar` — das ist die
**ehrliche** Lage. Lauf 2 steht auf `gedriftet`, weil RC-01 alle 33 erwischt.

Genau dafür ist das dreiwertige Urteil da. Zweiwertig gelesen wäre Lauf 2 der bessere Lauf:
100 % Bindung statt 0 %. Dreiwertig gelesen ist er der schlechtere, und die Bindungsquote ist
kein Gütesiegel, sondern die **Reichweite einer Aussage**, die hier ins Leere greift.

## Was der Prosa-Auftrag sonst bewirkt hat

**Mehr Zerlegung, weniger Ordnung.** Doppelt so viele Use Cases (6 statt 3), 40 % mehr
Funktionen, aber zwei Module weniger und 34 fehlerhafte Elemente statt null. Ohne die
vorgegebene Zerlegung strukturiert der Arm mehr — und schlechter.

**Die Steuerung wurde schlechter, nicht besser**: 0,50 → 0,75, beide Male am selben Regeltyp
`R-04` an einem MOD. Der Anker ist über beide Läufe derselbe Regel-/Typ-Ort, nur das Modul
wechselt. Der Befund aus §20 hält also auch unter verändertem Input.

## Was die Prüfliste hier NICHT sagt

42/42 in Lauf 1 gegen 1/42 in Lauf 2 ist **kein Deckungsunterschied**. Die Prüfliste zieht ihren
Wortlaut aus der strukturierten Projektdefinition — Lauf 1 hat genau diesen Text gelesen, Lauf 2
eine Paraphrase. Die Zahl misst den Input des Arms, nicht sein Ergebnis, und ist zwischen den
beiden Läufen nicht vergleichbar. Der Abschreib-Befund aus §146 ist damit zum zweiten Mal
bestätigt, diesmal von der anderen Seite. → ITEM-2026-360.

## Vorbehalte

n = 1 je Arm, ein Modell, eine Domäne. Der Unterschied bei der Bindung ist groß genug, um bei
n = 1 sichtbar zu sein; die Unterschiede bei compliance und Steuerwert sind es nicht.

---

# Lauf 3 — `graphcode run` statt `claude -p`

Der erste Lauf, der die Steuerungsmaschinerie überhaupt anfasst (CR-GC-555). `runs/gcrun-0`,
12 Runden, 51 Turns, 13 Minuten, $0.

**Der Arm ist ein anderer und die Qualitätszahlen sind deshalb nicht vergleichbar.**
`graphcode run` spricht rohes HTTP und kann Claude Codes OAuth nicht benutzen, also läuft er
auf `qwen3-coder-30b` lokal statt auf Opus. Was dieser Lauf beantwortet, ist: *greift die
Maschinerie* — nicht: *ist sie besser*.

## Was nur dieser Arm zeigt

| | |
|---|---|
| Mutationen angewandt | 6 |
| **nach Gate-Ablehnung repariert** | **2** |
| Preflight-Vervollständigungen | 14 |
| Preflight-Blocks | 15 |
| Dry-Run-Proben | 3 |

Der Gate-Rückkanal funktioniert: das Gate lehnt ab, die Verstöße gehen zurück ans Modell, der
nächste Versuch geht durch. Der Preflight ergänzt selbständig, was eine Regel verlangt — bei
R-01 etwa den TEST-Stub samt `verify`-Kante. **Beides gibt es auf den `claude -p`-Armen nicht.**

## Der harte Beleg für den Unterschied

Aus den Audit-Logs, dieselbe Frage an beide Läufe — was wurde vor einer Mutation konsultiert?

| | Lauf 2 `claude -p` | Lauf 3 `graphcode run` |
|---|---|---|
| Mutationen **ohne jedes** vorherige Werkzeug | **16 von 19** | 4 von 10 |
| `graph_generate` davor | **0×** | 6× |
| `graph_authoring_guide` / `graph_elements` / `graph_get_edges` davor | je ≤ 1× | je 6× |
| Kommandos je Batch (Mittel) | 40 | 26 |

`graph_generate` ist der Rundenprompt-Treiber des Executors. Im `claude -p`-Lauf erscheint er
null Mal — dort ist er dem Modell vorenthalten und niemand ruft ihn.

## Der schärfste Befund der ganzen Reihe

`graph_suggest` läuft **auch hier null Mal**, und keine Mutation trägt
`editSource: 'suggestion-template'`. Der Grund ist jetzt aber benannt statt rätselhaft: im
Executor-Loop liegt `graph_suggest` hinter dem **Handoff**, und der verlangt alle acht
Readiness-Dimensionen über Schwelle, null Fehler-Verstöße und vollständige Phasen-Gates.

Erreicht wurden: Lauf 1 → 3/8, Lauf 2 → 2/8, Lauf 3 → 1/8.

**Die Vorlagen, an denen diese Sitzung gearbeitet hat, sitzen hinter einer Schwelle, die kein
Lauf je erreicht hat.** Nicht umgangen — planmäßig noch nicht an der Reihe. Das erklärt
rückwirkend, warum 11 Vorlagen und 4 neue Regelabdeckungen in keinem Lauf messbar wurden, und
es ist eine andere Aussage als „der Agent fragt nicht".

## Ein Messfehler, gefunden beim Zusammenstellen

Das Rig hat die Eingabetoken des `claude -p`-Arms **um Faktor 800 unterschätzt**. `tokens_in`
las nur `usage.input_tokens` — den ungecachten Rest. Tatsächlich:

| | gemeldet | tatsächlich | davon Cache-Lesung |
|---|---:|---:|---:|
| Lauf 1 | 8.816 | **7.209.148** | 6.874.467 |
| Lauf 2 | 8.822 | **7.056.849** | 6.744.342 |
| Lauf 3 | 359.521 | 359.521 | — |

Damit dreht sich die Aussage um: der Frontier-Arm liest nicht ein Fünfundzwanzigstel des
lokalen, sondern das **Zwanzigfache**. Erfassung korrigiert (ITEM-2026-365); die beiden alten
Zeilen in `results-sigllm*.json` tragen noch den zu kleinen Wert.

## Vorbehalte

n = 1, ein Modell je Arm, eine Domäne. Die Loop-Kennzahlen sind Zählungen und belastbar; jeder
Qualitätsvergleich zwischen Lauf 3 und Lauf 1/2 ist es nicht, weil Arm und Modell mitwandern.

---

# Lauf 4 — dieselbe Maschinerie, nach vier CRs Steuerung

Erster Lauf, der mit Lauf 3 **apples to apples** vergleichbar ist: gleicher Arm, gleiches
Modell (`qwen3-coder-30b` lokal), gleiche 12 Runden, gleicher Auftrag. Dazwischen liegen
CR-GC-556 bis 562 — `graph_suggest` und Optimizer-`delta` ab Element 1 im Rundeninhalt, der
Skill-Rumpf je Runde, die Anleitung je Fokus-Dimension, der Kaltstart in drei Stufen, und
`graph_next_step` entfernt.

## Das Ergebnis ist schlechter

| | Lauf 3 | Lauf 4 |
|---|---:|---:|
| Elemente | 49 | **22** |
| Compliance | 0,92 | **0,59** |
| Phasen-Gates | 1/8 | 2/8 |
| Mutationen angewandt | 6 | 21 |
| Gate-Ablehnungen | 3 | 1 |
| Preflight-Blocks | 15 | 0 |
| Wanduhr | 763 s | 271 s |

Die ehrliche Vergleichszahl ist **22 gegen 49 Elemente** — mit der Einschränkung, dass 14 der
49 aus Lauf 3 vom Preflight erzeugte TEST-Stubs waren; modell-autoriert steht es etwa 22 zu 35.
Auch so: weniger.

Der Endgraph trägt 1 SYS, 9 UC, 8 ACTOR, 4 FCHAIN und **16 Kanten, allesamt `compose`**.
Kein FUNC, kein FLOW, keine einzige `io`-Kante. Ein Namensbaum ohne Verhalten.

## Warum — drei Ursachen, der Größe nach

**1. Der Fokus kommt nie aus `uc` heraus.** Im Endzustand hat genau EINE Dimension Funde:
`uc` mit 56, alle anderen mit 0. Die Fokuswahl filtert auf `violations > 0` — es gibt also
dauerhaft nur einen Kandidaten. Und *innerhalb* der Dimension sortiert `windowsOf` die Funde
**alphabetisch nach `rule_id`**. Damit lautet die Reihenfolge FC-02 → R-15 → R-16 → UC-01 →
UC-02 → …, und das heißt:

- **FC-02 (Warnung)** wird vor **UC-02 (Fehler)** abgearbeitet, weil F vor U kommt.
- **R-15** — „häng FUNC-Elemente an die leere Kette" — ist das zweite Fenster und kam nur dran,
  nachdem FC-02 zweimal zurückgestellt wurde. Das Wort **FUNC steht kein einziges Mal im
  Lauflog.**

Das ist keine Modellschwäche, das ist die Fundreihenfolge. → ITEM-2026-386

**2. Die Actor-Stufe hat 8 Actors erzeugt.** `se:author-actor` nennt 2–5 als Regelfall und
„mehr als 7 heißt, du modellierst Nutzer statt die Grenze". Das Log zeigt, warum: Runde 3
endete mit `stop=length` bei 4096 Ausgabetoken, und der Recovery-Pfad hat aus der
abgeschnittenen Antwort 8 Mutationen gerettet. Über den Skill sagt das nichts — die Antwort
war abgeschnitten, nicht ignorant.

Die Folge ist trotzdem meine: acht unverdrahtete Actors sind acht R-16-Funde, und die landen
in genau der `uc`-Dimension, die ohnehin feststeckt. Die Stufe füttert den Stau, den sie
auflösen sollte. → ITEM-2026-387

**3. Die Lesewut ist zurück.** Runde 8: 40 Aufrufe `graph_elements`, null Mutationen. Runden
5, 7 und 9 ähnlich. Genau das Verhalten, das die Runden-Injektion seit CR-GC-285 abstellen
soll — der Element-Index liegt im Prompt, das Modell fragt trotzdem. Sieben von zwölf Runden
meldeten Stagnation. → ITEM-2026-388

## Was messbar besser wurde

Gate-Ablehnungen 3 → 1, Preflight-Blocks 15 → 0, **kein einziger R-18-Verstoß**. Die
Fehlerart, an der Lauf 3 zweimal hängenblieb — ACTOR direkt an FCHAIN — ist verschwunden.
Der gestufte Kaltstart hat also getan, wofür er gebaut wurde.

Es hat nur nichts eingebracht, weil die Schleife eine Ebene weiter stehenbleibt.

## Die Lehre

Vier CRs haben den Kanal zum Modell verbessert und die Reihenfolge, in der die Steuerung
arbeitet, unangetastet gelassen. Der Kanal war nicht der Engpass. **Ein Fund-Fenster, das
alphabetisch wählt, macht jede Anleitung darin wirkungslos** — sie kommt zur falschen Zeit.

ITEM-2026-386 ist der nächste Zug, und es ist der kleinste der drei.

---

# Läufe 5 und 6 — die Fundreihenfolge und ihr Imperativ

Gleicher Arm, gleiches Modell, gleiche 12 Runden wie Lauf 3 und 4. Je eine Änderung.

| | Lauf 3 | Lauf 4 | Lauf 5 | Lauf 6 |
|---|---:|---:|---:|---:|
| | *vor dieser Sitzung* | *+ Injektion, Stufen* | *+ CR-563* | *+ CR-564* |
| Elemente | 49 | 22 | 15 | **44** |
| Compliance | 0,92 | 0,59 | 0,53 | **0,95** |
| REQ | — | 0 | 0 | **15** |
| FUNC | — | 0 | 0 | **5** |
| Phasen-Gates | 1/8 | 2/8 | 2/8 | 1/8 |
| Gate-Ablehnungen | 3 | 1 | 2 | 10 |
| Preflight-Vervollständigungen | 14 | 0 | 0 | **40** |
| Wanduhr | 763 s | 271 s | 184 s | 1200 s |

## Lauf 5 — der Fokus stimmte, die Anweisung nicht

CR-GC-563 hat getan, was es sollte: das Log zeigt `defer: uc:UC-01`, also wurde der
**Fehler** bearbeitet statt der alphabetisch erste Fund. Das Ergebnis war trotzdem
schlechter — null REQ, zwei R-08-Blocks.

Der Grund brauchte keinen weiteren Lauf, nur den gerenderten Prompt: der Fund sagte
dreimal *„Add at least one REQ via compose trace"*, der Imperativ darunter nannte
*„fehlende ACTORs, FCHAIN-Szenarien oder fehlende UCs"*. Das Wort REQ kam im Befehlssatz
nicht vor. Das Modell folgte dem Befehlssatz. → CR-GC-564

## Lauf 6 — zum ersten Mal Struktur

Die Regel-Klausel ist jetzt die Anweisung. Runde 3 zeigt sie wörtlich befolgt: zehn REQ,
jede mit ihrem TEST im selben Batch — und der Preflight drehte acht `verify`-Kanten
zurecht, die das Modell falsch herum gezogen hatte (`REQ verify TEST` statt
`TEST verify REQ`).

**REQ 0 → 15, FUNC 0 → 5.** In den Läufen 4 und 5 gab es von beidem nichts.

## Die ehrliche Einordnung

**Gegen den Ausgangspunkt ist das Parität, kein Fortschritt.** Lauf 3 stand bei 49
Elementen und 0,92; Lauf 6 steht bei 44 und 0,95 — bei 4,4-facher Laufzeit und dreimal so
vielen Gate-Ablehnungen. Was die beiden Korrekturen geleistet haben, ist den Rückschritt
zu beheben, den die Stufen-Umstellung gekostet hat, nicht darüber hinauszukommen.

**Und jeder dieser Läufe ist n=1 auf einem lokalen Modell.** Die UC-Zahl allein schwankte
über vier Läufe zwischen 2 und 9 — bei gleichem Prompt. Der Unterschied 22 → 15 liegt
plausibel im Rauschen; der Sprung auf 44 mit REQ und FUNC ist größer als das, und er ist
durch den Mechanismus gedeckt (die Klausel verlangt genau REQ+TEST, das Log zeigt genau
das). Aber als Zahl bleibt er ein Einzelwert.

**Was daraus folgt, ist keine weitere Optimierung, sondern `RUNS=3`.** Solange eine
Änderung gegen einen einzelnen Lauf gemessen wird, optimieren wir zur Hälfte gegen
Streuung.

## Was weiterhin unbelegt ist

`graph_suggest` wird seit CR-GC-556 vom Host gerufen und als Inhalt injiziert — im Audit
trägt **keine einzige Mutation** `editSource: 'suggestion-template'`. Dass die Vorschläge
ankommen, ist geprüft; dass das Modell einen aufgreift, nicht.

---

# Basislinie mit drei Läufen — und was sie rückwirkend klärt

Erste Messung mit `RUNS=3` statt eines Einzelwerts. Zustand: nach CR-GC-563/564, sonst
unverändert.

| Lauf | Elemente | Compliance | Gates | Ablehnungen | Wanduhr |
|---|---:|---:|---:|---:|---:|
| 1 | 41 | 0,878 | 1/8 | 3 | 660 s |
| 2 | 50 | 0,900 | 1/8 | 7 | 550 s |
| 3 | 38 | 0,974 | 1/8 | 8 | 571 s |
| **Mittel** | **43** | **0,917** | 1/8 | 6 | 594 s |

Das Band ist **38–50 Elemente**. Damit lässt sich die ganze Reihe endlich einordnen:

- **Lauf 3 (49, vor dieser Sitzung)** liegt im Band, am oberen Rand.
- **Lauf 6 (44)** liegt im Band, mittig.
- **Läufe 4 (22) und 5 (15)** liegen **weit darunter** — das war kein Rauschen. Der
  Rückschritt durch die Stufen-Umstellung war real, und CR-GC-563/564 haben ihn behoben.

**Die ehrliche Bilanz der Sitzung am Ergebnis gemessen: Parität.** Der Ausgangswert liegt
im Band der Endmessung. Was die Steuerungsarbeit gebracht hat, ist an dieser Zahl nicht
sichtbar — sie hat einen selbst verursachten Einbruch repariert und dabei zwei echte
Defekte freigelegt (alphabetische Fundreihenfolge, Template gegen fix_hint), die vorher
unentdeckt waren.

## Die Lesewut ist stabil, nicht sporadisch

Über alle drei Läufe, Werkzeugaufrufe nach Art:

| Lauf | Lese-Aufrufe | Mutationen | Leseanteil |
|---|---:|---:|---:|
| 1 | 208 | 28 | **88 %** |
| 2 | 153 | 33 | 82 % |
| 3 | 162 | 30 | 84 % |

`graph_elements` dominiert durchgehend, 8–23 Aufrufe je Runde — obwohl der Element-Index
seit CR-GC-285 in jedem Rundenprompt steht.

## Korrektur: `toolset=authoring` ist NICHT der Hebel

Ich hatte den Werkzeugkatalog als Ursache vermutet (ITEM-2026-369/388). Das ist falsch, und
zwar nachlesbar: `AUTHORING_TOOLS` enthält `graph_elements` und `graph_authoring_guide` —
**genau die beiden Werkzeuge, die die Flut ausmachen**. Der kuratierte Satz würde Eingabe-
token sparen und am Verhalten nichts ändern.

Der eigentliche Befund ist ein anderer und derselbe wie zweimal zuvor in dieser Sitzung:
**der Host injiziert Guide-Slice und Element-Index jede Runde — und bietet dieselben zwei
Fakten zusätzlich als Werkzeug an.** Dieselbe Tatsache auf zwei Wegen, und das Modell
nimmt den teuren. Bei `graph_suggest` (CR-GC-556) und `graph_next_step` (CR-GC-560..562)
war die Antwort jeweils: den zweiten Weg schließen. → ITEM-2026-390

Offen bleibt dabei eine echte Frage, die vor dem Zug beantwortet gehört: der injizierte
Index ist auf die **Fokus-Typen** gefiltert. Braucht das Modell legitim Typen außerhalb des
Fokus, nimmt man ihm mit dem Werkzeug etwas weg, das der Prompt nicht ersetzt.

---

# Basislinie nach dem neutralen Prompt — der Prompt war der Engpass

Dieselben drei Läufe, dieselbe Konfiguration, **nur der Auftragstext neutralisiert**
(CR-GC-565). Die Bänder überlappen nicht.

| | alt (Ontologie im Prompt) | neu (neutral) |
|---|---:|---:|
| Elemente | 41 / 50 / 38 — **Band 38–50** | 86 / 77 / 96 — **Band 77–96** |
| Mittel | 43 | **86** |
| Compliance (Mittel) | 0,917 | 0,926 |
| Leseanteil | 88 / 82 / 84 % | 81 / 84 / 88 % |

**Ein neutralerer Prompt verdoppelt die Ausbeute.** Zwei getrennte Dreier-Messungen, keine
Überlappung — das ist keine Streuung.

## Warum, und warum das zum Rest der Sitzung passt

Der alte Prompt trug eine **zweite Tagesordnung**: „Systemgrenze, Akteure, Use Cases,
Funktionen, Verträge und Module sind aus dem Auftrag herzuleiten." Das Modell hatte damit
zwei Imperative — den des Auftraggebers und den der Runde aus `graph_generate` — und
bediente beide halb. Der neue Prompt nennt nur das Ziel; die Runde ist der einzige Befehl.

Das ist derselbe Befund wie zweimal zuvor in dieser Sitzung, jetzt zum dritten Mal:

| Wo | zwei Wege zur selben Sache | Zug |
|---|---|---|
| Werkzeuge | `graph_next_step` neben `graph_generate` | CR-GC-560..562 |
| Rundenprompt | Dimensions-Template neben der Regel-Klausel | CR-GC-564 |
| Auftragstext | Nutzer-Agenda neben der Rundenanweisung | CR-GC-565 |

**Die Steuerung wird nicht besser, indem man ihr mehr sagt, sondern indem genau eine Stelle
spricht.**

## Was die Zahl NICHT sagt

Ein großer Teil des Zuwachses sind REQ+TEST-Paare, und die TESTs sind überwiegend vom
Preflight erzeugte Stubs (28 / 12 / 26 Vervollständigungen bei 29 / 27 / 26 TESTs).
Modell-autoriert bleiben etwa 58 / 65 / 70 Elemente.

Und die **Kantenvielfalt schwankt stark**: Lauf 1 trägt nur `compose` und `verify` — ein
Kompositionsbaum ohne Verhalten. Erst Lauf 3 hat `io`, `satisfy` (23) und `allocate`
zusammen, also zum ersten Mal in der ganzen Reihe einen wirklich verdrahteten Graphen.
Die Streuung liegt nicht in der Menge, sondern in der Tiefe.

## Unverändert

Der **Leseanteil bleibt bei 81–88 %** — der Prompt hat daran nichts geändert. Das
Phänomen aus ITEM-2026-388 ist davon unabhängig, und ITEM-2026-392 bleibt seine
Vorbedingung: fünf Rundenanweisungen verlangen Elementtypen, die der injizierte Index gar
nicht abdeckt (`uc`→FLOW, `req`→TEST, `arch`→MOD, UC-01→REQ+TEST, UC-02→FLOW). So lange
das gilt, ist ein Teil des Lesens erzwungen und kein Hebel.

---

# Nach CR-GC-566 — was die Fokus-Deckung gebracht hat, und was nicht

Dritte Dreier-Messung, gleiche Konfiguration, nur `focusTypes` deckt jetzt, was die
Anweisung verlangt.

| | Basislinie (neutral) | nach CR-GC-566 |
|---|---:|---:|
| Elemente | 86 / 77 / 96 — Mittel **86** | 82 / 122 / 68 — Mittel **91** |
| Compliance | 0,926 | 0,926 |
| **Gate-Ablehnungen** | 10 / 7 / 2 | **1 / 1 / 1** |
| Leseanteil | 81 / 84 / 88 % | **91 / 87 / 94 %** |

**Was es gebracht hat: die Gate-Reibung ist weg.** Ein Fund je Lauf statt bis zu zehn. Die
Grammatik, die die Anweisung braucht, steht jetzt im Prompt — und das Modell zieht keine
illegalen Kanten mehr. Das ist der klare Ertrag.

**Was es nicht gebracht hat: weniger Lesen.** Die Menge ist unverändert (Bänder 77–96 gegen
68–122 überlappen breit), und der Leseanteil ist *gestiegen*.

## Meine Erklärung für ITEM-2026-388 war falsch

Ich hatte angenommen, die Lesewut komme daher, dass die Anweisung Typen verlangt, deren
Grammatik die Injektion nicht liefert. Die Lücke gab es, sie ist behoben, und sie war
**nicht** die Ursache. Die Aufschlüsselung sagt, warum:

| | Lauf 1 | Lauf 2 | Lauf 3 |
|---|---:|---:|---:|
| `graph_elements` (existiert das schon?) | 164 | 81 | 247 |
| `graph_authoring_guide` (was ist legal?) | 47 | 52 | 30 |

Die Flut ist **nicht die Grammatikfrage**, sondern die **Existenzfrage** — drei- bis
achtmal so viele Aufrufe. Und die hat einen handfesten Grund: der injizierte Element-Index
ist auf die Fokus-Typen gefiltert (CR-GC-539, gegen 757 Knoten je Runde). Alles außerhalb
ist für das Modell unsichtbar, und ohne Sicht kann es keine Dublette vermeiden.

## Damit ist ITEM-2026-390 entschieden — negativ

`graph_elements` vorenthalten, weil „der Host injiziert es ja ohnehin", wäre falsch: der
Host injiziert **einen Ausschnitt**. Solange der Index gefiltert ist, ist die Existenzfrage
für alles außerhalb des Fokus unbeantwortbar, und das Werkzeug ist der einzige Weg dahin.

Dahinter steht eine echte Spannung, kein Bug: **need-to-know gegen Dublettenfreiheit.**
Ein vollständiger Index kostet Kontext (gemessen 757 Knoten), ein gefilterter kostet
Lese-Turns. Was fehlt, ist eine dritte Form — etwa nur die **uids** aller Typen statt
`uid · type · name` der Fokus-Typen. Das ist ein Entwurf, kein Schalter. → ITEM-2026-393

---

# Der Bezugspunkt, neu gemessen — Opus über den dokumentierten Einstieg

Nach zwölf Läufen auf dem Executor/qwen-Arm zurück zum Pfad, den ein Kunde benutzt:
`claude -p`, Opus 5, Einstieg wörtlich aus `GRAPHCODE-STEERING.md`
(`Read GRAPHCODE.md, then se:generate: "…"`), neutraler Prompt (CR-GC-565). Ein Lauf,
`runs/opus5-4`, 21 Minuten, $9,27.

| | Opus, Lauf 2 (alter Prompt) | **Opus, jetzt** | Golden |
|---|---:|---:|---:|
| Elemente / Traces | 248 / 497 | **202 / 336** | 238 / 524 |
| UC / FUNC / MOD / REQ / TEST | 6 / 41 / 8 / 44 / 60 | 8 / 21 / 5 / 44 / 44 | 3 / 29 / 10 / 49 / 35 |
| Compliance | — | **1,00** | |
| Phasen-Gates | 2/8 | **4/8** | |
| Gate-Ablehnungen | — | 2 | |
| Turns | — | 56 | |

**Kein Rückschritt auf dem Produktpfad.** Compliance 1,0 und 4 von 8 Gates sind die besten
Werte der ganzen Reihe (vorher 3/8 → 2/8 → 1/8). Der Graph ist vollständig verdrahtet —
79 `io`, 45 `satisfy`, 21 `allocate`, 39 `relation` auf 27 SCHEMA. Das hat kein
Executor-Lauf je erreicht. Die fünf produktweiten Änderungen (Fundreihenfolge, Klausel vor
Template, `next_step` weg, gestufter Seed, Fokus-Deckung) haben den manuellen Pfad nicht
beschädigt; ob sie ihn *verbessert* haben, sagt n=1 nicht.

Weniger Elemente als Lauf 2 (202 gegen 248) — aber die 248 entstanden mit dem Prompt, der
die Ontologie mitlieferte, und trugen 60 TESTs zu 44 REQ. Die neuen 44 TESTs stehen 1:1 zu
den REQs. Weniger ist hier nicht schlechter.

**Kein Lese-Problem.** Vor den 22 Mutationen wurden konsultiert: `graph_generate` 9×,
`graph_authoring_guide` 5×, `graph_get_node` 1×, `rules_evaluate` 1×. 56 Turns für
22 Mutationen und 28 Dry-Runs — praktisch jeder Turn ein Schreib- oder Prüfzug. Die Lesewut
war ein Executor/qwen-Phänomen, kein Produktproblem. ITEM-2026-388/393 sind damit
zweitrangig, solange der Executor nicht der gewählte Weg ist.

## Die Ausgangsfrage — und die Antwort ist immer noch nein

`editSource: 'suggestion-template'`: **0 von 22 Mutationen.** `graph_suggest`: **0 Aufrufe.**
Auch auf dem Arm, der zählt, mit dem Skill, der es vorschreibt.

Der Grund ist derselbe wie beim Executor, nur jetzt unbestreitbar: der Skill schickt
`graph_suggest` erst beim **Handoff**, und der verlangt alle Dimensionen über Schwelle.
`ms` steht bei 0 (keine Meilensteine), `cr` ohne Wert (keine Bauordnung) — Handoff nie
erreicht. Und dann der Satz, mit dem Claude selbst schließt:

> *„Steering-Verschlechterung 0.25 bei `BW-02`/`FUNC-auftragsbetrieb` … Das ist der
> schlechteste offene Punkt und **ein Fall für `graph_suggest`, nicht für Handarbeit**."*

Das Modell **kennt** das Werkzeug, **benennt** den Fund, den es lösen würde, **empfiehlt**
es dem Menschen — und ruft es nicht, weil der Skill es ihm für diese Phase nicht erlaubt.
Die Vorlagen sitzen hinter einer Schwelle, die in vierzehn Läufen keiner erreicht hat.

**Das ist kein Modellproblem und kein Executor-Problem. Es ist die Phasenlogik von
`se:generate`.** Solange `graph_suggest` handoff-exklusiv ist, wird keine Vorlage je eine
Entscheidung ändern — egal welches Modell, egal welcher Arm.

## Was das für die Sitzung heißt

Der Executor-Umweg hat fünf echte Produktdefekte gefunden und behoben, ohne den
Produktpfad zu beschädigen. Die Frage, mit der alles begann, beantwortet er nicht — sie
liegt in `se:generate`, Schritt 5, und dort seit dem ersten Lauf.
