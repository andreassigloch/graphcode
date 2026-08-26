# CR-GC-434 — Die Trajektorie stempelt den Auslöser, sonst bleibt Claim A unbeweisbar

**Status:** open · **Angelegt:** 2026-08-26 · **Priorität: hoch — Voraussetzung für einen Kern-Claim**
**Herkunft:** direkte Konsequenz aus CR-GC-432 (Falsifikation Claim A, Ergebnis: **nicht messbar**).

## Warum

Claim A lautet: *„Die Regeln lassen Agenten selbst steuern."* CR-GC-432 hat versucht, ihn an
678 realen Violation-Episoden zu belegen. Die Hint-Konformanz liegt bei **92,4 %** — und trägt
den Claim trotzdem nicht, aus drei gemessenen Gründen:

1. **Tautologie:** bei 95,6 % der Episoden ist der `fix_hint` die wörtliche Negation des
   Regel-Prädikats. Dort kann die Violation nur durch den Hinweis-Edit oder durch Löschen
   verschwinden — die Quote misst „repariert statt gelöscht", nicht Steuerung. Wo echte Wahl
   bestand: 4 von 20.
2. **Zirkularität:** das Fix-Template leitet den Kantentyp aus `inferTraceType(v.fix_hint)` ab —
   es *liest* den Hinweis. 57,9 % der konformen Episoden entfallen auf solche Regeln. Ob das
   Template benutzt wurde, ist nirgends gestempelt.
3. **Confounder Mensch:** 92,6 % der Episoden schließen in Kampagnen-Commits, 75,7 % in Commits
   mit CR-Nennung. **Weder noch: 1 von 678 (0,1 %).** Praktisch jede Reparatur geschah in einem
   vom Menschen beauftragten Kontext.

Der dritte Punkt ist der entscheidende und er ist kein Analyse-Mangel, sondern eine **Datenlücke**:
`trajectory.jsonl` kennt nur `operation: mutate|validate`. Alle 289 Zeilen tragen
`consumerType: agent`, es gibt kein `author`-Feld und **null Auslöser-Information**. Ein Aufruf
von `graph_next_step` oder `graph_suggest` hinterlässt **keine Spur** — Read-Tools werden nicht
protokolliert. Damit ist „der Agent folgte dem Regel-Hinweis" von „der Mensch beauftragte einen
CR, der zufällig dasselbe tat" **strukturell nicht unterscheidbar**.

## Änderung — vier Stempel

Je applied Mutation zusätzlich:

| Feld | Inhalt | beantwortet |
|---|---|---|
| `respondsTo` | `{ruleId, elementId}` der Violation, auf die die Mutation antwortet (leer, wenn keine) | folgte die Edit einem Regel-Fund? |
| `trigger` | menschlicher Auftrag vs. agenteninterne Runde | Confounder Mensch |
| `consultedTools` | welche Read-Tools vor der Mutation liefen (`graph_next_step`, `graph_suggest`, …) | hat der Agent die Steuerung überhaupt abgerufen? |
| `editSource` | `suggestion-template` \| `authored` | Zirkularität — Template oder eigene Formulierung? |

`consultedTools` schließt zugleich die Lücke, die schon bei der Architektur-Frage aufgefallen ist:
heute lässt sich nicht einmal auszählen, ob `graph_suggest` in realen Runden je aufgerufen wurde.

## Abgrenzung

- Kein Ersatz für CR-DRAFT-GC-328 (Lauf-Stempel/Evidenz) und CR-DRAFT-GC-348
  (Trajektorie-Regelidentität) — geprüft, **überschneidet sich nicht**; die vier Felder hier sind
  neu.
- Keine Read-Tool-Vollprotokollierung: nur die Tools, die vor einer Mutation gelaufen sind, und
  nur als Namensliste. Kein Payload, keine zweite Audit-Fläche.
- Kein Modell-/Regel-Eingriff, keine neue Metrik.

## Akzeptanzkriterien

- [ ] Jede applied Mutation trägt die vier Felder; fehlende Information ist **explizit leer**,
      nie geraten (Test, vorher rot).
- [ ] `trigger` unterscheidet nachweisbar die zwei Fälle — Test mit je einem echten Lauf.
- [ ] `consultedTools` erfasst `graph_next_step`/`graph_suggest`; ein Lauf ohne Abruf ist als
      solcher erkennbar.
- [ ] Der raw-`mutate`-Pfad ohne Feed bleibt dokumentierte Lücke (CR-GC-252-Verhalten), nicht
      still.
- [ ] Mehraufwand je Mutation gemessen und genannt.
- [ ] CR-GC-432 kann mit den neuen Stempeln **wiederholt** werden — das ist der Zweck.

## Folge

Bis dahin gilt die von CR-GC-432 gedeckte Formulierung, nicht die starke:

> „Die Regeln machen die nächste Handlung eindeutig benennbar, und die realen Reparaturen sind
> ihr gefolgt statt sie zu umgehen — 611 Reparaturen gegen 38 Löschungen und 12 Umgehungen."

Nicht: „Agenten steuern sich damit selbst."

## Dateien (≤ 5)

1. Trajektorie-Schema / `recordAudit`
2. Tool-Layer (Read-Tool-Erfassung)
3. Gate-Pfad (`respondsTo`, `editSource`)
4. Test
5. dieser CR
