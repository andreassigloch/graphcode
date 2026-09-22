# CR-GC-612: Fester Vorspann je Lauf entflechten: GRAPHCODE.md, Werkzeugbeschreibungen, Skills und Antworten haben doppelte Zustaendigkeit — jede Frage soll genau einen Ort haben

**Status:** ✅ Done (2026-09-22)
**Typ:** aus Item ITEM-2026-369 (finding)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-369.json (Lane: code)

---

~~REIHENFOLGE: setzt auf die Ueberarbeitung von Regeln, Phasen und Action-Matrix auf.~~ **Freigegeben
2026-09-22** (Auftraggeber): die Regel-/Phasen-/Action-Matrix ist mit CR-GC-616 durch —
`docs/research/regel-matrix.{csv,md}` traegt jetzt auch Fix und Folge-Regeln.

BESTANDSAUFNAHME (gemessen 2026-09-22 an Lauf gefuehrt-1 des Code-Tests und an den Spec-Laeufen 14/15):
| Quelle | Zeichen | wann im Kontext |
| GRAPHCODE.md | 15.150 | wenn gelesen — in Lauf 14, 15 und im Code-Test je einmal ganz |
| GRAPHCODE-STEERING.md | 6.524 | wenn gelesen — im Code-Test nicht |
| Werkzeugbeschreibungen + Schemas, 24 Werkzeuge | 44.678 (Beschreibungen 25.232, Schemas 19.446) | im Executor JEDE Runde; in Claude Code nur die per ToolSearch geladenen |
| se-Skills auf Platte, 21 Dateien | 98.555 | nur die aufgerufene |
| lokale CLAUDE.md | im Rig 0 | in echten Repos zusaetzlich |
| graph_authoring_guide | 11 Aufrufe x ~2,2k = 24.000 | Lauf 14 UND 15, derselbe Leitfaden mehrfach |

KORREKTUR der ersten Fassung dieses Items: die 26.305 Zeichen Werkzeugkatalog sind KEINE Grundlast der Claude-Code-Laeufe. Claude Code laedt MCP-Werkzeuge verzoegert — im Code-Test standen beim Start 0 graphcode-Werkzeuge, der Agent holte sie in 4 ToolSearch-Aufrufen mit zusammen 998 Zeichen. Voll zahlt den Katalog der EXECUTOR, der ihn selbst in jede Anfrage schreibt. toolset=authoring bleibt dort der Hebel.

UEBERLAPPUNG (gemessen): gemeinsame Saetze ab 50 Zeichen = 0 zwischen GRAPHCODE.md, STEERING.md und den Werkzeugbeschreibungen (3 zwischen GRAPHCODE.md und den Skills). Kein Copy-Paste. Doppelt ist die ZUSTAENDIGKEIT: alle 15 Werkzeug-/Regelmarker aus GRAPHCODE.md stehen auch in den Werkzeugbeschreibungen, 21 von 165 Zeilen der Datei erklaeren Werkzeuge, die sich selbst erklaeren; Werkzeuge und Skills teilen 28 Marker. Die zwei laengsten Beschreibungen tragen Regelsemantik statt Auswahlhilfe: graph_readiness 3.556, graph_metrics 3.491 Zeichen.

ZIELBILD — jede Frage hat genau einen Ort (Prinzip 'ein Imperativ je Runde'):
- GRAPHCODE.md: die Hausregeln des Repos (frag den Graphen, schreib nur durchs Gate, wo die Views liegen). Keine Werkzeugnamen, keine Regelsemantik.
- Werkzeugbeschreibung: WANN nehme ich es, ein Satz. Keine Regelerklaerung, keine Beispiele.
- graph_help: die Regelsemantik, auf Abruf.
- Skill: der Ablauf, welche Schritte in welcher Reihenfolge. Keine Werkzeugsemantik.
- Antwort des Werkzeugs: das Delta plus der Umfang, den sie genommen hat. Nicht die Weltlage.

ABNAHME-KRITERIUM (Kipp-Punkt, Andreas 2026-09-22): gekuerzt werden darf nur so weit, wie der Agent sich das Fehlende nicht an den Werkzeugen vorbei zurueckholt.
Rueckfall = Read/Grep/Bash auf docs/graph/*.json, .graphcode/audit.jsonl oder docs/views/.
Kein Rueckfall = Suchen im Quellcode waehrend der Code-Phase (macht der freie Arm auch).
Grauzone = mehr graph_help/graph_authoring_guide als vorher: dann ist die Information verschoben, nicht gespart.
Nulllinie gemessen 2026-09-22: opus5-14 0, opus5-15 0, opus5-16 0, Code-Test gefuehrt-0 1, gefuehrt-1 0.
Kippt bei: >1 Rueckfall je Lauf, oder wenn Rueckfall + zusaetzliche Nachschlage-Aufrufe die Ersparnis auffressen. Die ehrliche Zahl ist die Differenz, nicht die Ersparnis.
Blinder Fleck: merkt der Agent das Fehlen gar nicht, gibt es keinen Rueckfall, sondern ein schlechteres Modell — die Kennzahl steht immer neben Steuerwert und Abnahme, nie allein.
Messung gehoert ins Rig (Bericht + messen.mjs) — nicht nebenbei anfassen, dort arbeitet eine parallele Sitzung.

NICHT HIER DRIN:
- Antwortgroessen von graph_realize: CR-GC-611, erledigt (eine Bindung 842 statt ~4.600 Zeichen, Batch mit drei 374).
- Werkzeuge antworten ueber das ganze Modell statt ueber die Scheibe (rules_get_violations 32.630, graph_test_report 25.602, graph_context je ~9.300 Zeichen): eigener Befund, eigenes Item.
- Denkbloecke im Kontext, ~58 % in Lauf 15: ITEM-2026-474, Executor.

## Akzeptanzkriterien

- [ ] `GRAPHCODE.md` unter 6.000 Zeichen (heute 15.150) und ohne Werkzeug- oder Regelsemantik.
- [ ] Keine Werkzeugbeschreibung über 800 Zeichen; was darüber hinausgeht, steht in `graph_help`
      (heute: `graph_readiness` 3.556, `graph_metrics` 3.491, `rules_evaluate` 2.500).
- [ ] Marker-Überlappung zwischen `GRAPHCODE.md` und den Werkzeugbeschreibungen von 15 auf 0.
- [ ] Der Ablauf-Befund aus dem Code-Test ist mit erledigt: der Skill ruft `graph_test_report` nicht mehr nach dem Export
      (Lauf `gefuehrt-1`: 25.602 Zeichen kurz vor dem Commit, ohne jede Folge).
- [ ] **Kipp-Kriterium:** im Bestätigungslauf 0 Rückfälle (Read/Grep/Bash auf `docs/graph/*.json`, `.graphcode/audit.jsonl`,
      `docs/views/`) und nicht mehr `graph_help`/`graph_authoring_guide`-Aufrufe als vorher.
      Nulllinie 2026-09-22: opus5-14/15/16 je 0, Code-Test `gefuehrt-0` 1, `gefuehrt-1` 0.
- [ ] Testsuite grün.
