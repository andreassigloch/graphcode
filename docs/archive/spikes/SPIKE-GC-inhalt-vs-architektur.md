# SPIKE-GC-inhalt-vs-architektur — Inhaltszug und Architekturzug trennen?

**Datum:** 2026-09-28 · **Item:** ITEM-2026-639 · **Daten:** S2-Runde gcrun-342..344 (3 × 40 Runden,
Stand CR-GC-707), Golden `sigllm-v98`, graphcodes eigenes Modell (`docs/graph/graphcode.graph.json`)
· **Werkzeug:** `rig/greenfield-systemtest/zuege.mjs` (CR-GC-708), CNM aus `@sigloch/se-engine`

## Frage

Soll der Executor zwei Arten von Zug getrennt denken und getrennt ausführen?

- **Inhaltszug:** „Ich habe eine Anforderung / brauche eine Funktion" → den ganzen Block
  REQ-FUNC-TEST (samt Kette und io) in einem Zug. Danach prüfen: Dublette, Ähnlichkeit, Wirkkette.
  Im Spec-Modus ohne realRef-Störfeuer.
- **Architekturzug:** MOD-Schnitt und Zuordnung, nachgelagert — aus den Funktionen und ihren
  Verbindungen berechnet, „fast rechnerisch".

## Ergebnis

1. **Die beiden Zugarten sind messbar verschieden.** Inhaltszüge gehen zu 79–100 % durchs Gate und
   brauchen 0–1 Regel; der Architekturzug „MOD + allocate" zu 36 %, „nur allocate" zu 44 %, mit
   4 Regeln für 95 % (IO-02, ein MOD je FUNC, FLOW braucht SCHEMA, ein compose-Parent).
2. **Das Modell vermischt sie.** 10 der 12 Runden, in denen ein MOD entstand, hatten einen
   **Inhalts**-Fokus (342: IO-01 5×, ND-01 2×, UC-01 1×; 343: R-30; 344: ND-01). Der Ausreißer 342
   begann so: r13 ein ungefragtes MOD im UC-01-Batch.
3. **76 % der Runden vervollständigen Blöcke.** Von 120 Runden galten 91 Fokusregeln, die einen
   halben Inhaltsblock melden (UC-01, RD-01, R-02, R-15, R-30, R-31, FC-04, IO-01, UC-02, R-16, R-10);
   59 davon gelöst, dabei 256 neue Fokusfunde erzeugt — jeder halbe Block hinterlässt den nächsten.
   Architektur: 12 Runden (10 %), Dubletten 6, Saat 7, FC-03 4.
   *Nicht gemessen:* wie viele Runden ein Block-Zug tatsächlich spart — das zeigt erst ein Lauf.
4. **io-Kopplung trifft den Modulschnitt nicht.** CNM über die FUNC-Kopplung, verglichen mit dem
   gezogenen MOD-Schnitt (ARI: 1 = identisch, 0 = Zufall; Reinheit: Anteil der FUNC eines Clusters
   im selben MOD):

   | Modell | Kopplung | Cluster / MOD | ARI | Reinheit |
   |---|---|---|---|---|
   | Golden (24 FUNC) | io | 10 / 7 | 0,04 | 0,63 |
   | Golden | io + gemeinsamer compose-Parent | 8 / 7 | **0,40** | 0,75 |
   | graphcode (125 FUNC) | io | 26 / 7 | **0,37** | 0,74 |
   | graphcode | io + Parent + SCHEMA + REQ | 7 / 7 | 0,22 | 0,48 |

   Weitere Signale (gemeinsames SCHEMA, gemeinsame REQ) verbessern nichts oder verschlechtern.
   **Aber:** die Cluster liegen zu 63–77 % in *einem* MOD — die Rechnung liefert brauchbare
   **Bausteine**, nicht den Schnitt.

## Deutung

Der Modulschnitt folgt nicht dem Datenfluss, sondern **technischen Randbedingungen** (Auftraggeber,
2026-09-28): Dateigröße (≤ 500 Zeilen), Programmiersprache, Frontend/Backend, APIs bündeln. graphcodes
eigene MODs belegen das: sie sind die Schichten `kernel ← loop ← projections ← surface` — eine
Abhängigkeitsrichtung, und der Datenfluss kreuzt Schichten gerade *by design*. MOD und FUNC **können**
identisch sein, müssen es nicht; bei Software ist das unkritischer als bei Hardware.

Daraus folgt eine Arbeitsteilung, die den schwierigsten Zugtyp aus dem Inhaltsmodus nimmt:

| Schritt | wer | Eingabe | Ergebnis |
|---|---|---|---|
| Inhalt | Executor, Block-Zug | UC / Anforderung | REQ-FUNC-TEST mit Kette und io |
| Bausteine | Rechnung (CNM, io + Parent) | FUNC-Graph | Cluster als Kandidaten |
| Modulschnitt | Entscheidung mit technischen Randbedingungen | Bausteine + Sprache, Schicht, Größe, API | MOD + allocate |

## Offen

- Stabilität: CNM kippt bei kleinen Änderungen (Memory `fitadvisory-coherence-partitionsartefakt`);
  ein berechneter Vorschlag braucht eine feste Vorher-Partition oder einen Stabilitätsnachweis.
- Die technischen Randbedingungen stehen heute nicht im Modell (Sprache, Schicht, Größe je FUNC).
  Ohne sie bleibt der Schnitt eine Entscheidung, keine Rechnung.
- Ob ein Block-Zug in einem Lauf wirklich weniger Runden und weniger Dubletten erzeugt, belegt erst
  eine S2-Runde — gemessen in `docs/messung/verlauf.md`.
- Die Trennung ist eine Leitlinien-Entscheidung (Spec-Modus nur Inhalt; Architektur als eigener
  Schritt) — beim Autor.
