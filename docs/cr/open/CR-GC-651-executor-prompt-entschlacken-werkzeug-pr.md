# CR-GC-651: Executor-Prompt entschlacken: Werkzeug-Projektion, readiness raus, Skill-Marker, Protokoll-Schritt 1

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-548 (finding)
**Erstellt:** 2026-09-24
**Item:** bok/items/ITEM-2026-548.json (Lane: code)

---

## Befund

Der Executor laedt weder CLAUDE.md noch GRAPHCODE.md noch Memory — sein Prompt ist eigen. Er
erbt aber ueber drei Kanaele Text, der fuer Frontier-Sitzungen in Claude Code geschrieben ist.
Gemessen am eigenen Modell, eine Runde mit Fokus `req:RD-01`, Zeichen im ersten Turn:

| Kanal | vorher | Braucht der Executor das? |
|---|---:|---|
| Werkzeugkatalog `authoring` | 7.835 | `graph_mutate`-Schema allein 3.733 (formatE-Sprachdoku 1.879, `violations` 1.000, `baseVersion` 380, `dryRun` 257) — Treiber probt, ein Schreiber, Form steht im SYSTEM; `graph_readiness` beantwortet „was als Naechstes", das entscheidet der Treiber |
| Skill-Rumpf (`author-req`) | 2.497 | ohne inject-Marker kam der ganze Skill: commands-JSON-Beispiele, `graph_generate {task}`, `rules_get_violations`, `se:close-violations` |
| Gate-Protokoll (1) + Gegensatz | ~300 | der Auftrag sagt „Guide aufrufen", die Injektion zwei Absaetze spaeter „erledigt" |

## Umsetzung

- **Werkzeug-Projektion:** `AUTHORING_PARAMS` (vorher `AUTHORING_TOOLS`, ein Set) nennt je
  Werkzeug die Parameter; die Schluessel SIND das Werkzeugset. Parameterbeschreibungen entfallen,
  von der Werkzeugbeschreibung bleibt der erste Satz — abgeleitet, kein zweiter Text.
  `graph_mutate` bietet nur `formatE`, als Pflichtfeld. `toolset: 'full'` bleibt ungeschnitten.
- **Guide-Schritt:** im Treiber-Modus nennt der Auftrag aus `graph_generate` den Guide nicht mehr;
  der Treiber schreibt `GUIDE_HINT`, wenn er die Grammatik NICHT einbettet (`injection:false`).
- **Skills:** `author-req` und `author-uc` zeigen ihr Beispiel als Format-E (gilt fuer beide
  Straenge — `graph_mutate` empfiehlt Format-E auch Frontier) und setzen inject-Marker um den Teil,
  den ein lokales Modell braucht. Linter-Hinweis, testRefs-Details, Task- und Werkzeug-Verweise
  bleiben draussen, stehen aber weiter im Skill.

## Nachgemessen (dieselbe Runde, eigenes Modell)

| | vorher | nachher |
|---|---:|---:|
| SYSTEM + Suffix | 1.517 | 1.789 |
| Werkzeugkatalog | 7.835 | 1.902 |
| Auftrag | 1.416 | 1.236 |
| Grammatik / Liste / Anleitung / Vorschlaege | 540 / 6.746 / 2.497 / 459 | 853 / 6.244 / 1.445 / 367 |
| **erster Turn gesamt** | **21.010** | **13.836 (−34 %)** |

„Vorher" ist der Stand vor CR-GC-648 (dort kamen Quelltypen in Grammatik und Liste). Groesster
Posten ist jetzt die Element-Liste.

## Umfang laut Graph

`CR-GC-651 -relation-> FUNC-build-round-injection, FUNC-generation-step, FUNC-run-executor, FUNC-call-model`.

## Dateien (10)

`src/loop/executor-prompt.ts`, `src/loop/executor-backend.ts`, `src/loop/executor.ts`,
`src/loop/generate.ts`, `.claude/commands/se/author-req.md`, `.claude/commands/se/author-uc.md`,
`tests/executor.test.ts`, `tests/generate.test.ts`,
`tests/executor.round-injection-suggest-skill.test.ts`, `tests/mcp.mutate-next-step.test.ts`
(nur die CR-Nummer im Meldungstext: 647 → 648, ein Zuordnungsfehler aus CR-GC-648).

## Akzeptanzkriterien

- [x] Authoring-Katalog: nur die Tabelle, `graph_mutate` nur `formatE` (Pflicht), ohne Beschreibungen, < 2.500 Zeichen.
- [x] `toolset: 'full'` unveraendert.
- [x] Treiber-Auftrag nennt den Guide nicht; `GUIDE_HINT` genau bei `injection:false`; im Seed genau eine Nennung des Guides.
- [x] Injizierter Skill-Ausschnitt: Format-E, kein `"op"`, keine vorenthaltenen Werkzeuge — **rot auf den alten Skills** (Gegenprobe per `git stash`).
- [ ] **Rig-Abnahme** mit CR-GC-650: gcrun, sigllm-gcrun, N=3, gegen `results-runde19-gcrun-vor.json`. Kipp-Kriterium aus CR-GC-612: mehr Lese-Aufrufe des Modells (`graph_authoring_guide`, `graph_elements`, `graph_get_node`) als vorher = verschoben, nicht gespart.
