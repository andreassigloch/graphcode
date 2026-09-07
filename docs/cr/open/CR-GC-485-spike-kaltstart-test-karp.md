# CR-GC-485 (Spike) — Kaltstart `test_karp`: die Suite auf einem Projekt ohne Code

**Status:** offen — **eigene Sitzung, Automodus.** Dieses Dokument ist der vollständige Kontext;
es setzt keine Konversation voraus.
**Angelegt:** 2026-09-07 · **Art:** Spike (Erkenntnis, kein Produktivcode)
**Ort des Laufs:** `/Users/andreas/Developer/dev/test_karp` (eigenes Repo)
**Prüfling:** die graphcode-Suite — **nicht** das Wiki-System

---

## 1. Wozu dieser Lauf

**Zwei Fragen auf einmal, und beide sind offen:**

1. **Trägt die Suite ein Projekt, das fast keinen Code hat?** Alle bisherigen Modelle der Familie
   sind Software mit FUNC/MOD-Substanz. Dieses System besteht überwiegend aus *Konventionen und
   Agentenverhalten*. Ob Ontologie und Regelwerk tragen, wenn FUNC/MOD dünn und FLOW/Datenhaltung
   dominant sind, ist unbelegt.
2. **Wie verhält sich die NEUE Steuerung an einem frischen Graphen?** CR-SM-292 / CR-GC-483 haben
   das Ranking am 2026-09-07 von `Δm · t̂` (ℝ⁶) auf den Chebyshev-Score über die Verstoßmasse
   umgestellt. `test_karp` ist der **erste Kaltstart danach**.

Der Ertrag ist **Erkenntnis über die Suite**, nicht ein fertiges Wiki. Wer am Ende ein schönes
Modell hat und keine Befunde über das Werkzeug, hat den Spike verfehlt.

## 2. Die Intention (Lever 1) — wörtlich vom Auftraggeber

> Der Agent baut und pflegt ein **persistentes Wiki** aus verlinkten Markdown-Dateien zwischen
> Mensch und Quellen. Karpathys Bild: die Quellen sind der Quelltext, das Wiki ist das Kompilat —
> einmal übersetzt, danach aktuell gehalten, nicht bei jeder Frage neu abgeleitet.

Der vollständige Input — drei Schichten (`raw/` · Wiki · Schema), drei Operationen (Ingest ·
Query · Lint), Systemgrenze, acht UC-Kandidaten, NFR-Kandidaten und drei ausdrücklich offene
Punkte — steht in **`test_karp/docs/project/llm-wiki-testprojekt.md`**. Das ist die Quelle, nicht
dieser CR. **Erst lesen, dann anfangen.**

## 3. Der Ort, und dass die Bindung stimmt

    /Users/andreas/Developer/dev/test_karp
      .mcp.json                          → node_modules/@sigloch/graphcode/dist/cli.js mcp
      node_modules/@sigloch/graphcode    → SYMLINK auf ../../../graphcode (Arbeitskopie)
      .graphcode/                        → leer (kein target-profile.json — es gibt nichts mehr zu gewichten)
      docs/project/…                     → der Input
      docs/graph/                        → EXISTIERT NICHT. Noch nichts im Graphen.

**Der Symlink ist der Grund, warum dieser Lauf überhaupt etwas beweist:** die MCP-Bindung fährt
die lokale Arbeitskopie mit der neuen Steuerung, nicht ein Registry-Paket. **Vor dem ersten
Schreibzugriff prüfen** — ohne das misst der Lauf ein altes Paket:

    cd ~/Developer/dev/graphcode && npm run build
    grep -c steerAdvisory dist/kernel/harness.js      # muss ≥ 1 sein

## 4. Wo gestoppt wird

**„Ready to code".** Konkret: das Modell trägt einen Implementierungsplan — Meilensteine und CRs
geschnitten (`se-plan`), die erste CR ohne offene Fragen. Phasen sind `SRR → PDR → CDR → TRR`;
der Stopp liegt **nach CDR, vor der ersten Zeile Code**.

**Keine Implementierung in dieser Sitzung.** Kein `raw/`, kein Wiki, keine `CLAUDE.md` für das
Zielsystem.

## 5. Was VORHER zu entscheiden ist — nicht raten

`docs/project/llm-wiki-testprojekt.md` §4 stellt vier Fragen. Drei sind durch die Lage bereits
beantwortet, eine nicht:

| Frage | Stand |
|---|---|
| Eigenes Repo oder hier? | **entschieden** — `test_karp` ist ein eigenes Repo |
| Agent-Runtime | **entschieden** — `.claude/` liegt dort, also Claude Code, also `CLAUDE.md` als Schema-Datei des Zielsystems |
| **Muster oder Instanz?** | **OFFEN — die eine Frage an den Auftraggeber.** Das Muster gibt eine saubere Spec, aber keine Daten zum Validieren. Eine Instanz gibt beides. Empfehlung der Vorlage: Instanz. |
| Welche Domäne (falls Instanz)? | hängt an der vorigen |

**Fürs Modellieren bis „ready to code" reicht das Muster** — der Schnitt, die UCs, die NFRs und
der Plan hängen nicht an der Domäne. Die Domäne entscheidet erst, was *validieren* heißt. Also:
**mit dem Muster anfangen, die Frage einmal stellen, nicht darauf warten.**

## 6. Drei Fallen, die dieser Lauf mit Sicherheit trifft

Alle drei sind gemessen und dokumentiert. Wer sie nicht kennt, liest sie als Erfolg.

1. **Der Chebyshev-Score ist am Anfang blind.** Ein frisches Modell liegt innerhalb aller Budgets
   → Score **0**, `worstAt` **null**, und jeder Kandidat von `graph_suggest` senkt ihn um **0**.
   *Das ist kein „nichts zu tun".* Dort führt **`readiness`** — sie zählt, was FEHLT. Die beiden
   sind komplementär: readiness misst ABDECKUNG, der Score AUSPRÄGUNG (CR-SM-291 Satz H,
   CR-GC-484 T-S4).
2. **`graph_suggest` repariert Vollständigkeit, nicht Form.** Alle fünf messenden Regeln (RD-04,
   BW-02, CR-01, MT-01, MT-02) sind `Constraint`-Klasse und haben keinen generischen Fix; die
   Vorschläge sind ausschließlich Operator-Fixes. Für die *Form* gibt es heute keine Kandidaten —
   die liefert der Mensch (CR-SM-292 §8).
3. **Zwei Graphen nicht verwechseln.** Das Zielsystem *ist* ein Wissensgraph (Wikilinks, Obsidian
   Graph View). Der SE-Graph **modelliert** es. Eine Wiki-Seite ist kein Knoten im SE-Graphen.
   Das sauber zu halten ist Teil des Tests, nicht eine Nebenbedingung.

## 7. Was am Ende auf dem Tisch liegen muss

Der Spike ist erst fertig, wenn diese sieben Punkte beantwortet sind — **mit Zahlen, nicht mit
Eindrücken**:

1. **Kaltstart-Protokoll.** Wie viele Runden von der Prosa bis zum Plan, wo hat `graph_generate`
   den Fokus gewählt, wo hat es sich verlaufen.
2. **Gate-Bilanz.** Wie viele Batches `auto-apply` / `suggest` / `block`, und **welche Regel** am
   häufigsten geblockt hat. Ein Block ist ein Befund über die Grammatik, kein Ärgernis.
3. **Die Steuerungsspur.** Ab wann ist der Chebyshev-Score ≠ 0, was war die erste `worstAt`, und
   hat das Ranking je einen Kandidaten wegen der **Zerstörungs-Sperre** zurückgestuft.
4. **Der dünne-Substanz-Test.** Tragen die Regeln, wenn FUNC/MOD dünn sind — oder feuern Regeln
   mangels Gegenstand nicht und der Score sieht dadurch gut aus? Gegenprobe: `report:silence`
   sinngemäß auf diesen Graphen.
5. **Der Lint-Vergleich.** Das Zielsystem hat ein eigenes Lint (Waisenseiten, fehlende
   Querverweise, Widersprüche, veraltete Aussagen). Das ist strukturell **dasselbe Genre** wie
   unsere Regelauswertung — der einzige echte Vergleichspunkt in diesem Projekt. Welche unserer
   Regeln hat eine Entsprechung, welche Lint-Prüfung hat bei uns keine?
6. **Die MOD-Whitebox-Lücke**, falls sie auftritt: R-04 sieht den Rand eines Moduls nur zusammen
   mit seiner Größe, ein kleines Modul mit breitem Rand ist stumm (gemessen: `MOD-kernel-measure`
   10 Verträge, `mod_api_server_ts` 17). Ob dieses Projekt sie trifft, ist offen.
7. **Was gefehlt hat.** Die Liste der Momente, in denen ein Werkzeug gefehlt hat oder das
   falsche geantwortet hat. Das ist der eigentliche Ertrag.

## 8. Automodus — was das heißt und wo es endet

`se:generate` fährt einen readiness-getriebenen Loop; jeder Schreibzugriff läuft durchs Gate,
also ist auch ein unbeaufsichtigter Lauf nicht ungeschützt. Trotzdem gilt:

- **Der Schnitt ist die Prüfung, nicht die Übersetzung.** Die Quelle nennt sich selbst
  „intentionally abstract". Wo der Schnitt fällt, ist eine Entscheidung — sie wird **vorgelegt**,
  nicht still getroffen (Lever 3: zwei Optionen, je gegen das echte Modell vorgemessen).
- **Halt vor jedem `graph_reseed`** und vor jedem Zug, der Elemente entfernt.
- **Halt an „ready to code"** (§4), auch wenn der Loop weiterliefe.

## 9. Anhang — was seit dem letzten Kaltstart anders ist

| Änderung | wirkt hier |
|---|---|
| CR-SM-288 | jeder Befund von RD-04/BW-02/CR-01/MT-01/MT-02 trägt `context.value`/`.threshold` |
| CR-SM-292 | `suggestEdits` rankt nach Chebyshev; `targetFor` und der `target`-Parameter sind **weg** |
| CR-GC-483 | `steerAdvisory` an jedem `mutate()`-Ergebnis; `graph_suggest` hat **kein** `target`-Eingabefeld mehr; Zerstörungs-Sperre im Ranking |
| CR-GC-484 | Kausalitätsnachweis T-S1..T-S4; das Gate rechnet mit dem **Budget des Hosts** |
| CR-SM-290 | `npm test` an der Wurzel kann grün werden — ein Rotstand ist wieder ein Signal |
| GRAPHCODE-STEERING.md | Lever 4 beschreibt **Budgets** statt Gewichte; wer die alte Fassung im Kopf hat, sucht einen Regler, den es nicht mehr gibt |
