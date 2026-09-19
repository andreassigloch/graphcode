# Ergebnis — Lauf 1, 2026-09-19

Ein Lauf, Arm `opus5` über `claude -p`, n = 1. Rohdaten in
`../greenfield-systemtest/results-sigllm.json` und `../greenfield-systemtest/runs/opus5-0/`.

## Der Satz vorweg

Der Auto-Modus liefert in **18 Minuten für 8,25 $** einen Graphen von vergleichbarer Größe zu
dem, was der handgeführte Lauf in **26 Stunden** gebaut hat — mit **null Fehler-Verstößen**
gegenüber 16 und **null Gate-Ablehnungen** gegenüber 35.

**Und genau diese Null ist kein Ergebnis, sondern die Abwesenheit einer Frage.** Der Arm hat
keine einzige der fünf Analysen durchgeführt. Ohne FMEA gibt es keine Risiko-Anforderung, ohne
Risiko-Anforderung kann FM-03 nicht feuern, und FM-03 sind genau die 16 Fehler des Goldens. Der
sauberere Graph ist der ärmere.

## Die Zahlen

| | Arm (Auto) | Golden (Hand, v98) |
|---|---:|---:|
| Elemente / Kanten | 238 / 524 | 255 / 506 |
| **Fehler-Verstöße** | **0** | 16 (alle FM-03) |
| Warnungen | 158 | 216 |
| Gate-Ablehnungen | **0** | 35 |
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
- **Null Gate-Ablehnungen** gegen 35 im handgeführten Lauf, bei 238 Elementen. Er hat den
  Autorier-Leitfaden befolgt, statt gegen die Grammatik zu laufen.
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
