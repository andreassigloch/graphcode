# Interaktives Rig (CR-GC-715)

Eine Zeile je Lauf, geschrieben von `rig/interaktiv/treiber.mjs`. Korpus, Simulator und Arme: `rig/README.md`
(Abschnitt „interaktiv"). Dauer in Minuten; „Schritte" = Werkzeugaufrufe je Zug; „Ablehnungen" = vom Gate
abgelehnte Mutationen. Das Blindurteil steht je Runde unter der Tabelle.

## Reihe 1 — Rohdaten, 12 Züge mit Analysen (2026-10-04)

Nicht vergleichbar: die Analysen sprengen lokal das Kontextfenster. lokal-2 lief ab Zug 9 in `finish: length`
(72 000 Zeichen Denken) und dreimal `ContextOverflowError` beim Verdichten — abgebrochen, keine Zeile; lokal-3 nicht
gefahren. Verglichen wird normiert bis zum ersten Analyse-Vorschlag (unten).

| Datum | Arm | Lauf | Stempel | Modell | Züge · Ende | Dauer je Zug Median / Max | Fragen Zug 1 | Schritte Median / Max | Mutationen angenommen / abgelehnt | Elemente · Kanten |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-04 | frontier | 1 | graph 85cfe22be3ce (50/93) · policy todo/graphcode.config.jsonc · rules 34.0.0 · code 7065d59+dirty | claude-opus-5-5 | 12 · zuglimit | 0.4 / 1.4 | 6 | 2.5 / 10 | 8 / 1 | 50 · 93 |
| 2026-10-04 | frontier | 2 | graph a5328c79e5bb (62/121) · policy todo/graphcode.config.jsonc · rules 34.0.0 · code 7065d59+dirty | claude-opus-5-5 | 12 · zuglimit | 0.6 / 1.5 | 5 | 3 / 11 | 12 / 3 | 62 · 121 |
| 2026-10-04 | frontier | 3 | graph a3bc05aaac8b (53/90) · policy todo/graphcode.config.jsonc · rules 34.0.0 · code 7065d59+dirty | claude-opus-5-5 | 12 · zuglimit | 0.4 / 1.1 | 6 | 2.5 / 13 | 10 / 2 | 53 · 90 |
| 2026-10-04 | lokal | 1 | graph 09fbdb5c4ab6 (37/70) · policy todo/graphcode.config.jsonc · rules 34.0.0 · code 9423ca4+dirty | ollama/qwen3.8-27b-lms:medium | 12 · zuglimit | 6.5 / 25.3 | 4 | 4.5 / 14 | 10 / 5 | 37 · 70 |

## Normiert bis zum ersten Analyse-Vorschlag (2026-10-04)

Geschnitten beim ersten Analyse-Vorschlag von graphcode; ältere Läufe über `auswertung.mjs normieren` (Graph am
Schnitt aus dem Audit nachgespielt). Spalte „Ende": `kern` = so hieß dieser Schnitt bis 2026-10-04. Seit 2026-10-05
enden Läufe bei „SRR und PDR bestanden" (PDR mit Allokation, CR-SM-389) — nachgerechnet: an diesem Schnitt fehlt das
bei den drei Frontier-Läufen und bei lokal-nvfp4-2 (kein Modul).

| Datum | Arm | Lauf | Stempel | Modell | Züge · Ende | Dauer je Zug Median / Max | Fragen Zug 1 | Schritte Median / Max | Mutationen angenommen / abgelehnt | Abbrüche Länge / Fehler | Elemente · Kanten |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-04 | frontier | 1 | graph b4b112e200c9 (37/58) · policy todo/graphcode.config.jsonc · rules 34.0.0 · code 9423ca4+dirty | claude-opus-5-5 | 4 · kern (normiert, Zug 4/12) | 0.5 / 0.8 | 6 | 3 / 6 | 3 / 1 | — | 37 · 58 |
| 2026-10-04 | frontier | 2 | graph baaf9b14940c (39/57) · policy todo/graphcode.config.jsonc · rules 34.0.0 · code 9423ca4+dirty | claude-opus-5-5 | 4 · kern (normiert, Zug 4/12) | 0.5 / 1.0 | 5 | 3 / 8 | 3 / 2 | — | 39 · 57 |
| 2026-10-04 | frontier | 3 | graph 05daec6f306b (41/62) · policy todo/graphcode.config.jsonc · rules 34.0.0 · code 9423ca4+dirty | claude-opus-5-5 | 4 · kern (normiert, Zug 4/12) | 0.6 / 0.9 | 6 | 3 / 7 | 3 / 1 | — | 41 · 62 |
| 2026-10-04 | lokal | 1 | graph c91671b442a7 (20/25) · policy todo/graphcode.config.jsonc · rules 34.0.0 · code 9423ca4+dirty | ollama/qwen3.8-27b-lms:medium | 3 · kern (normiert, Zug 3/12) | 2.3 / 13.0 | 4 | 5 / 8 | 2 / 2 | — | 20 · 25 |
| 2026-10-04 | lokal | 2 | graph 5d29445873f0 (42/69) · policy todo/graphcode.config.jsonc · rules 34.0.0 · code 9423ca4+dirty | ollama/qwen3.8-27b-lms:medium | 3 · kern (normiert, Zug 3/11) | 13.8 / 29.5 | 3 | 5 / 11 | 4 / 1 | — | 42 · 69 |
| 2026-10-04 | lokal | 3 | graph 895f73682f51 (34/46) · policy todo/graphcode.config.jsonc · rules 34.0.0 · code b0f518f | ollama/qwen3.8-27b-lms:medium | 5 · kern | 4.3 / 14.8 | 4 | 3 / 8 | 4 / 3 | 0 / 0 | 34 · 46 |
| 2026-10-04 | lokal-nvfp4 | 1 | graph 3aa3e128819c (36/58) · policy todo/graphcode.config.jsonc · rules 34.0.0 · code 22bb37c | ollama/qwen3.8:27b-nvfp4 | 6 · kern | 2.9 / 8.4 | 5 | 2.5 / 8 | 5 / 5 | 0 / 0 | 36 · 58 |
| 2026-10-04 | lokal-nvfp4 | 2 | graph 379baeb26f0c (42/52) · policy todo/graphcode.config.jsonc · rules 34.0.0 · code 22bb37c+dirty | ollama/qwen3.8:27b-nvfp4 | 4 · kern | 2.0 / 5.2 | 5 | 4 / 7 | 3 / 3 | 0 / 0 | 42 · 52 |
| 2026-10-04 | lokal-nvfp4 | 3 | graph 5c4f2d6bc6c9 (29/53) · policy todo/graphcode.config.jsonc · rules 34.0.0 · code 22bb37c+dirty | ollama/qwen3.8:27b-nvfp4 | 4 · kern | 2.2 / 10.6 | 5 | 4 / 6 | 2 / 2 | 0 / 0 | 29 · 53 |

### Blindurteil bis zum ersten Analyse-Vorschlag (2026-10-04)

Ein anonymer Gutachter je Spec (`blindurteil.mjs`, Raster `rig/interaktiv/korpus/todo.json`: 11 Vorgaben P*, 5 offene
Punkte O*); Frontier und lokal in einer gemischten Runde, nvfp4 als eigene Runde mit derselben Vorgabe.

| Arm | Lauf | P* ✓ · ~ · ✗ | O* offen geführt | erfunden | Dubletten | Notensumme |
|---|---|---|---|---|---|---|
| frontier | 1 | 10 · 0 · 1 | 3 | 0 | 0 | 21 |
| frontier | 2 | 9 · 1 · 1 | 3 | 2 | 2 | 19 |
| frontier | 3 | 10 · 0 · 1 | 5 | 0 | 3 | 18 |
| lokal | 1 | 5 · 5 · 1 | 0 | 4 | 0 | 15 |
| lokal | 2 | 9 · 1 · 1 | 0 | 5 | 1 | 17 |
| lokal | 3 | 10 · 1 · 0 | 1 | 4 | 0 | 18 |
| lokal-nvfp4 | 1 | 11 · 0 · 0 | 0 | 3 | 0 | 19 |
| lokal-nvfp4 | 2 | 7 · 2 · 2 | 0 | 2 | 3 | 13 |
| lokal-nvfp4 | 3 | 9 · 1 · 1 | 1 | 0 | 0 | 16 |

T-E3 (Spannen überlappen, Blindurteil trennt nicht): **nicht erfüllt**. Getrennt: offen geführte Punkte (Frontier 3–5,
lokal 0–1, nvfp4 0–1), erfundene Werte (Frontier 0–2, lokal 4–5), Zugdauer, Fragen in Zug 1. Überlappend: Ablehnungen,
P*-Abdeckung. In allen Armen: keine Lade-/Speicher-Funktion für todos.json; drei Frontier-Kerne ohne Modul.

