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
