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

## 3 Drei Wege, und warum der dritte gewinnt

Das Gate ist heute **zustandslos**: jeder `graph_mutate`-Aufruf bewertet alle Regeln neu und
gibt alle Befunde zurueck. Es kann gar nicht wissen, was es beim letzten Mal schon gesagt hat.
"Nur Neues melden" braucht also ein Gedaechtnis — oder einen Verzicht darauf.

**(a) Der Aufrufer schickt den Stand mit.** Das Werkzeug bekommt ein Feld ("diese Befunde kenne
ich schon"), das Gate zieht ab. Sauber, das Gate bleibt eine reine Funktion von (Graph, Batch).
Preis: der veroeffentlichte Werkzeugvertrag waechst, und **jeder** Client muss die Liste
mitfuehren — auch `claude -p`, das gar nicht weiss, dass es sie fuehren soll.

**(b) Der Host merkt es sich je Sitzung.** Einfach zu bauen. Preis: **derselbe Aufruf liefert
je nach Vorgeschichte eine andere Antwort.** Determinismus ist in diesem System aber tragend —
Rankings, Tests und Replay haengen daran. Das waere ein hoher Preis fuer eine Bequemlichkeit.

**(c) Gar nicht diffen — begrenzen und zaehlen.** Die Antwort traegt:
- **alle blockierenden** Befunde vollstaendig (die, die den Batch verhindern),
- die nicht-blockierenden **nur fuer die Fokus-Typen dieser Runde**,
- fuer den Rest **eine Zahl** ("37 weitere Befunde, `rules_get_violations` zeigt sie").

Zustandslos, deterministisch, kein Vertragsbruch — und es trifft die Ursache genauer als (a)
oder (b): die 51 % Wiederholung entstehen dadurch, dass jede Antwort den **ganzen Graphen**
berichtet, nicht dadurch, dass sie sich nicht erinnert. Wer an UC-Anforderungen arbeitet,
braucht `R-21` an einer FCHAIN nicht 13-mal — und beim ersten Mal auch nicht.

**Empfehlung: (c).** (a) bliebe als Ergaenzung moeglich, wenn (c) nicht reicht; (b) faellt aus.

## 4 Akzeptanzkriterien

1. Ein Lauf mit gleicher Elementzahl schreibt messbar weniger `cache_creation`.
2. Kein blockierender Befund faellt je weg — Test mit erzwungener Ablehnung.
3. Der Anteil von `graph_mutate` am Werkzeug-Payload faellt unter 40 %.
