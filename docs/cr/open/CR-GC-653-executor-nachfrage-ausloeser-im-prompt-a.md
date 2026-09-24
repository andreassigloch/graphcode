# CR-GC-653: Executor: Nachfrage-Ausloeser im Prompt abstellen (Duplikat-Vorpruefung, SCHEMA-Abfrage im Skill, SYS-Wiederlesen)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-553 (finding)
**Erstellt:** 2026-09-24
**Item:** bok/items/ITEM-2026-553.json (Lane: code)

---

## Befund

Siehe ITEM-2026-553 und die Argument-Messung in CR-GC-652 (gcrun-40..42): das Modell schlaegt aus
drei Gewohnheiten nach, die der Prompt erzeugt — Duplikat-Vorpruefung per Stichwort (~80),
`graph_elements {type:"SCHEMA"}` auf Anweisung des Skills `author-uc` (22, alle leer), Nachlesen
des SYS (18) und eigener Knoten.

## Umsetzung

- SYSTEM: „Schlage nur nach, was fehlt: Duplikate prueft der Treiber beim Einreichen … Die
  Systemintention steht in der Instruktion, den SYS nicht nachlesen; was du selbst angelegt hast,
  kennst du."
- Element-Liste: „keine Duplikate anlegen" entfernt (die Aussage steht jetzt einmal, im SYSTEM).
- `author-uc`: die SCHEMA/REQ-Abfrage steht ausserhalb des Executor-Ausschnitts — fuer Claude Code
  bleibt sie im Skill.

## Dateien (6)

`src/loop/executor-prompt.ts`, `src/loop/executor-inventory.ts`, `.claude/commands/se/author-uc.md`,
`tests/executor.test.ts`, `tests/executor.round-injection-suggest-skill.test.ts`, diese Datei.

## Rig-Messung (2026-09-24, `results-runde19-gcrun-653.json`, gcrun-50..52, N=3)

| Mittel je Lauf | 650/651 | 652 + Trace | 653 |
|---|---:|---:|---:|
| Lese-Aufrufe | 106 | 138 | **120** |
| davon Stichwortsuche / SCHEMA / get_node SYS | — | 27 / 7 / 6 | 23 / 1 / 9 |
| `graph_get_node` gesamt | 44 | 42 | 51 |
| Elemente | 50,7 | 47,0 | 47,7 |
| Ablehnungen | 3,0 | 2,3 | 3,3 |
| Readiness req / uc / ver | .68/.66/.85 | .67/.64/.85 | .67/.66/.85 |
| Tokens ein / aus | 210k / 9,1k | 184k / 9,0k | 189k / 8,3k |
| Laufzeit | 186 s | 160 s | 146 s |

(„—": die 650/651-Laeufe haben keine Argumente protokolliert.)

**Abnahme verfehlt:** das Kriterium war < 106 Lese-Aufrufe je Lauf; gemessen 120.

- **Gewirkt hat, einen Ausloeser zu entfernen:** SCHEMA-Abfragen 22 → 3.
- **Kaum gewirkt haben Verbote:** Stichwortsuchen 80 → 69 (−14 %), das Nachlesen des SYS stieg
  sogar (18 → 26) — bei N=3 im Rauschen, aber sicher kein Effekt in die gewollte Richtung.
  „Schlag nicht nach" befolgt qwen3-coder nur teilweise.
- Elemente, Ablehnungen und Readiness bleiben im Rahmen der Streuung; Tokens und Laufzeit fallen.
