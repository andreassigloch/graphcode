# CR-GC-729: next an der Mutation wird Vorschlag an den Nutzer (Chat-Vorbefuellung), ohne Fix-Anleitung und Abnahme-Angebot

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-712 (idea)
**Erstellt:** 2026-10-03
**Item:** bok/items/ITEM-2026-712.json (Lane: code)

---

## Befund

Seit CR-GC-588 trägt jede angewandte `graph_mutate`-Antwort als `next` den Imperativ der nächsten
Runde: Fix-Vorlagen, Werkzeugaufrufe (`graph_generate {task:'conops'}`) und das Angebot, Funde als
`acceptedFindings` abzunehmen. Gemessen in Probe todo E/F (2026-10-03, qwen3.8 als Client, interaktiv):

- E: in 7 von 10 Antworten trug `next` Arbeit an, die der Nutzer nicht verlangt hatte.
- F: der Client nahm AF-01..05 von selbst als `acceptedFindings` ab — ausgelöst durch den Satz in `next`.

Der Use Case ist interaktives Modellieren: über den nächsten Schritt entscheidet der Nutzer.

## Zielbild

Ein Kanal je Empfänger:

- **Agent:** der Arbeitsauftrag kommt nur von `graph_generate` (Automodus, `/se:generate`).
- **Nutzer:** die Mutationsantwort trägt `vorschlag` — ein Satz in seiner Sprache, als Bitte an den
  Agenten formuliert, mit Elementnamen statt IDs, ohne Fix-Anleitung, Werkzeugaufruf, Regel-ID oder
  Abnahme-Angebot. Gewählt wie der Schritt von `graph_generate` (dasselbe Sitzungsgedächtnis).
  Ein Client-Plugin (OpenCode: `tool.execute.after` → Eingabefeld) legt ihn dem Nutzer vor.

`next` entfällt ersatzlos (kein paralleler Pfad).

## Umfang

| Datei | Änderung |
|---|---|
| `src/loop/next-step.ts` | `vorschlagNachAnwendung` / `vorschlagAusSchritt`, Sätze je Dimension, Kaltstart-Stufe, Analyse |
| `src/surface/write.ts` | `vorschlag` statt `next` an der Antwort |
| `src/loop/generate.ts` | Host-Protokoll (4): nächster Schritt über `graph_generate`, `vorschlag` gehört dem Nutzer |
| `src/loop/suggest.ts`, `stagnation.ts`, `channel-rank.ts` | Beschreibung/Kommentare ohne `next` |
| `tests/mcp.mutate-next-step.test.ts` | neu: Vorschlag, kein Auftrag, Vollständigkeit, Host-/Treiber-Prompt |
| `tests/channel-model.test.ts` | Ausnahme für den Kanal entfällt — er hat jetzt Rang `proposal` |
| `CLAUDE.md` | Frage-Tabelle |
| Modell | `FLOW-channel-next-step`: Beschreibung, Name, `channelRank: proposal` |

`graph_impact(FLOW-channel-next-step)`: einziger Produzent `FUNC-generation-step` (io).

**Nicht hier:** das OpenCode-Plugin wird zuerst im Test-Repo gemessen (Probe F); die Auslieferung
über `graphcode init` folgt als eigener CR, wenn es trägt. `docs/graphcode_leitlinie.md` Z. 89 nennt
noch `next` — Änderung nur durch den Autor.

## Abnahme

- Angewandte Mutation: `vorschlag` da, `next` nicht; Probe und Ablehnung ohne `vorschlag`.
- Kein Vorschlag enthält `graph_*`, `Fix:`, `acceptedFindings`, Regel-IDs, „Gate“.
- Jede Fokus-Dimension und Kaltstart-Stufe hat einen Satz (Test, kein Wurf zur Laufzeit).
