# CR-GC-570: Die Gate-Antwort kuerzen — sie ist 70 % des Kontexts und zur Haelfte Wiederholung

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-411 (finding)
**Erstellt:** 2026-09-21
**Item:** bok/items/ITEM-2026-411.json (Lane: graph)

---

## 1 Befund (gemessen, `runs/opus5-5`)

| Werkzeug-Ergebnisse im Kontext | Zeichen | Anteil | Ø je Aufruf |
|---|---:|---:|---:|
| `graph_mutate` | 202.833 | **70 %** | 8.818 |
| `graph_generate` | 44.307 | 15 % | 4.430 |
| `graph_authoring_guide` | 11.961 | 4 % | 1.329 |

In 23 Gate-Antworten stehen **487 Violations, davon nur 237 distinkte** (Regel, Element)-Paare —
**51 % ist Wiederholung**; `R-21 @ FCHAIN-auftrag-abarbeiten` stand 13-mal drin. Und **alle 487
sind `gating: false`**: kein einziger haette die Anwendung verhindert.

Der teuerste Posten im Kontextfenster ist eine Liste, die nichts erzwingt und sich staendig
wiederholt. Sie verursacht zugleich 48 % der `cache_creation` (CR-GC-567) — der Posten mit
etwa dem Zwoelffachen des Lesepreises.

## 2 Zielbild

Die Gate-Antwort traegt, was der Empfaenger nicht schon weiss:
1. **Blockierendes immer** — vollstaendig, mit `fixHint`.
2. **Nicht-blockierendes nur, wenn neu** gegenueber der vorigen Antwort derselben Sitzung.
3. **Wiederholtes als Zahl**, nicht als Liste ("37 unveraenderte Befunde, davon 12 im Fokus").

Kein Informationsverlust: der vollstaendige Stand ist einen `rules_get_violations`-Aufruf
entfernt und steht ohnehin in `readiness`.

## 3 Offene Frage vor der Umsetzung

Wo liegt der Sitzungszustand? Das Gate ist heute zustandslos je Aufruf. Entweder der Aufrufer
schickt einen Stand mit (sauber, aber neuer Vertragsteil), oder der Host haelt ihn je
Session-ID (weniger sauber, kein Vertragsbruch). **Entscheidung gehoert vor die Umsetzung.**

## 4 Akzeptanzkriterien

1. Ein Lauf mit gleicher Elementzahl schreibt messbar weniger `cache_creation`.
2. Kein blockierender Befund faellt je weg — Test mit erzwungener Ablehnung.
3. Der Anteil von `graph_mutate` am Werkzeug-Payload faellt unter 40 %.
