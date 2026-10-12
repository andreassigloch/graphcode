# SPIKE-GC: Compose-Faltung — RESULTS (2026-09-26)

Frage und Definitionen: [`SPIKE-GC-compose-faltung.md`](SPIKE-GC-compose-faltung.md).
Auswertung: `node rig/greenfield-systemtest/faltung.mjs` (Nachspiel, kein LLM, 0,3 s).

## Verdikt

> **Nachtrag nach dem echten Lauf (CR-GC-682):** im Lauf verliert die Faltung gegen den flachen
> Index mit `type · name` — die nackte uid reicht dem Modell nicht, es schlägt nach. Siehe
> „Echter Lauf“ unten. Das Folgende ist das Urteil des Nachspiels.

**Im Nachspiel trägt die Faltung — aber nur mit einem ID-Index der verborgenen Knoten.** Gefaltet wie
vorgeschlagen (Arbeitsast offen, Geschwister als Box, Rest verborgen), braucht jede vierte
Mutation etwas, das nicht zu sehen war. Fast immer war das nur eine **uid** für eine Kante in
einen anderen Ast. Hängt man die verborgenen Knoten als reine uid-Liste an, muss nur noch
**5 %** der Mutationen Inhalt nachladen, bei **35 %** der Größe des vollen Graphen.

| Hypothese | Ergebnis |
|---|---|
| **H1 — gefaltet ≤ 30 % der vollen Ansicht** | **knapp verfehlt mit Index (35 %), gehalten ohne (25 %)** — ohne Index aber H2 verfehlt |
| **H2 — Nachladen ≤ 20 %** | **ohne Index falsifiziert (28 %), mit Index bestätigt (5 %)** |
| **H3 — eine Ebene reicht** | **falsifiziert:** Median 2 Ebenen bis zum verborgenen Knoten |
| **H4 — Executor ≠ Frontier** | **Unterschied bestätigt, Richtung umgekehrt zur Vermutung** — siehe unten |

## Korpus

78 aufgezeichnete Läufe, 34 000 Befehle, **1 190** Mutationen mit berührtem Bestand und
bekannter Saat. 29 Läufe mit echter Verschachtelung (FUNC in FUNC, MOD in MOD), Baumtiefe bis 4
(SYS › UC › FCHAIN › FUNC › FUNC). Gruppen: `gcrun` (Executor, lokale und Frontier-Modelle
gemischt, 772), `gcrun-frontier` (Executor mit Frontier-Modell, 72), `opus5` (346).

**Positivkontrollen, beide bestanden:** der Nachbau aus `audit.jsonl` stimmt in allen 78 Läufen
exakt mit `graph.json` überein (Knoten und Kanten); mit der Orakel-Saat (genau die berührten
Knoten) fällt Nachladen **0 von 1 190** an.

## Zahlen

Nachladen = Anteil der Mutationen, die einen verborgenen Knoten referenzieren oder den Inhalt
eines nicht offenen Knotens ändern. Größe = Median gefaltet/voll, Graphen ab 50 Elementen.

| Variante | alle | gcrun | gcrun-frontier | opus5 |
|---|---|---|---|---|
| A — Saat Befund, sonst vorige; Teilbaum offen (Spike-Definition) | 28 % · 25 % | 23 % · 20 % | 46 % · 12 % | 33 % · 46 % |
| B — Saat Befund **und** vorige; Teilbaum offen | 16 % · 63 % | 15 % · 40 % | 8 % · 58 % | 20 % · 74 % |
| C — wie B, nur eine Ebene unter der Saat offen | 21 % · 41 % | 18 % · 38 % | 13 % · 41 % | 30 % · 48 % |
| **D — wie A, plus uid-Index der verborgenen** | **5 % · 35 %** | **4 % · 31 %** | **3 % · 21 %** | **7 % · 51 %** |
| E — wie B, plus uid-Index | 3 % · 67 % | 3 % · 50 % | 1 % · 62 % | 4 % · 76 % |

Direkte Nachbarn über Nicht-`compose`-Kanten als Box dazuzunehmen bringt 1–5 Punkte Nachladen
für 3–5 Punkte Größe — kein Hebel.

## Woran es ohne Index scheitert

Gründe bei Variante B mit Nachbar-Boxen, gezählt je Knoten: **Referenz auf einen verborgenen
REQ (186), FUNC (121), FCHAIN (88), TEST (62)** — gegen **Inhaltsänderung** an Box oder
Verborgenem: REQ 110, UC 31, TEST 14. Autorieren ist querverweisend: eine FUNC erfüllt REQs
unter einem anderen UC, eine FCHAIN greift FUNCs aus anderen Ketten. Das deckt sich mit H4 des
Vorgängers (`SPIKE-GC-minimal-whitebox`: Autorieren ≠ Implementieren).

## Frontier gegen Executor

Der Executor mit Frontier-Modell arbeitet am engsten (Variante D: 21 % Größe, 3 % Nachladen), die
opus5-Läufe am breitesten (51 %, 7 %) — sie bauen große Batches quer über den Graphen. Das
Nachspiel misst, **wie breit** gearbeitet wurde, nicht **wer die Faltung braucht**. Die zweite
Frage entscheidet das Kontextfenster: Frontier hat es, das lokale Modell mit 32k nicht
(CR-SL-091: OpenCode verdichtete bei 32k 113-mal und verlor dabei den offenen Punkt). Die
Vermutung „nur der Executor“ ist damit plausibel, aber nicht hier belegt.

## Echter Lauf (CR-GC-682)

Das Nachspiel hatte eine Grenze benannt: ob ein Modell mit einer **nackten uid** auskommt. Der
echte Lauf (qwen3-coder, je 3×, Korpus `sigllm-gcrun`) verneint das: die Faltung brachte die
wenigsten Elemente (Median 83) bei den meisten Lese-Aufrufen (1 614) — das Modell schlug die uids
nach. Der **flache Index mit `type · name`** gewann (126 Elemente, 861 Lese-Aufrufe, gegen 112 /
1 259 beim heutigen Befund-Kontext). Die tragende Einsicht des Spikes ist also der vollständige
Index, nicht die Faltung — und der Index braucht einen Namen je Zeile.

## Grenzen

- Die Aufzeichnung zeigt, was getan wurde, nicht was mit der gefalteten Sicht getan worden wäre.
- Ob ein Modell aus einer nackten uid (`REQ-buchen-fenster`) den richtigen Knoten wählt, ist
  nicht gemessen. Die uids im Korpus sind sprechend; das trägt die Annahme, beweist sie nicht.
- Die Größe zählt Zeichen in einer Format-E-nahen Zeilenform, keine Token.

## Vorschlag (Entscheidung beim Auftraggeber)

Variante D als deterministische Sicht im Executor: Saat aus dem Gate-Befund (sonst der vorige
Batch), Arbeitsast offen, Geschwister als Box, Rest als uid-Index, `graph_expand` für die
restlichen 5 %. Nächster Schritt ist ein echter Lauf, nicht mehr Nachspiel: Executor lokal mit
Sicht D gegen die heutige Injektion, derselbe Auftrag, gemessen an Ausbeute, erfundenen Werten
und Runden bis zum Stillstand.
