# CR-GC-1034: Modell-Testspur: Ausschlussliste aus gemessenen Lesezugriffen ableiten statt von Hand pflegen

**Typ:** aus Item ITEM-2026-1703 (idea)
**Erstellt:** 2026-11-26
**Item:** bok/items/ITEM-2026-1703.json (Lane: graph)

---

## Befund

Die Änderungs-Heatmap (CR-GC-1028/1029) zählt 39 Änderungen in 6 Monaten an `scripts/model-test-set.mjs`. Jeder neue
Test, dessen Text `docs/graph` oder `RULES_VERSION` nannte, brauchte dort einen Eintrag von Hand, in der Spur oder mit
Grund ausgeschlossen. Die Entscheidung stützte sich auf Textmuster.

Gemessen am 2026-11-26: Je Testdatei lief vitest mit einem Lese-Protokoll in jedem Node-Prozess, also auch in Workern
und Kindprozessen. Ergebnis gegen die Liste von Hand:

- 22 Tests der Spur lesen nichts, was ein reiner Modell- oder Doku-Commit ändert. Sie standen dort wegen
  `RULES_VERSION` im Text. Ein contracts-Sprung ändert aber `package.json` und läuft ohnehin in der vollen Spur.
- 10 Tests lesen die SSOT oder `docs/cr` und fehlten in der Spur, darunter `typbindung`, `mcp.reseed`,
  `verify-code-plan` und `whitebox-messung`. Ein reiner Modell-Commit konnte sie rot machen, während `verify:model`
  grün meldete.
- Rund 40 Tests prüfen Skill-Texte unter `.claude/commands/`. Der pre-commit-Hook ordnete jede `.md`-Änderung der
  Modell-Spur zu, und die fuhr keinen dieser Tests.
- Rund 100 Tests treffen `src/README.md`, aber nur über `statSync` in `build-stamp.ts`. Gelesen wird dabei nur das
  Änderungsdatum, kein Inhalt; diese Treffer sind Rauschen.

## Umsetzung

| Datei | Änderung |
|---|---|
| `scripts/model-test-set.mjs` | `isModelLanePath` als einzige Pfadregel der Spur (Modell, Sichten, CRs, Markdown; nicht `.claude/`). `INCLUDED` = gemessene Leser minus `AUSNAHMEN` (3 Einträge mit Grund). Textmuster und die Liste `EXCLUDED` (31) entfallen. |
| `scripts/model-test-set.trace.cjs` (neu) | Lese-Protokoll: Inhaltszugriffe und git-Aufrufe im Repo, ohne `stat`. |
| `scripts/model-test-set.measure.mjs` (neu) | `npm run verify:model:messen`: misst nur neue oder geänderte Testdateien (Fingerabdruck), `--alle` misst alles neu (12 min). Ein roter Test bricht ab und hinterlässt keinen Eintrag. |
| `scripts/model-test-set.json` (erzeugt) | Die Messung: je Testdatei Fingerabdruck und gelesene Spur-Pfade. |
| `scripts/githooks/pre-commit` | Die Spurwahl ruft `isModelLanePath`, statt ein eigenes `case`-Muster zu führen. Ein Skill-Commit geht in die Spur CODE. |
| `tests/verify-model.completeness.test.ts` | Jede Testdatei ist mit ihrem heutigen Inhalt gemessen. Jede Ausnahme ist ein gemessener Leser mit Grund. Dazu die Fälle der Pfadregel und eine Gegenprobe (channel-model drin, render-verb draußen). Die Parallelitätsprüfung bleibt. |
| `scripts/verify-model.mjs`, `package.json`, `CLAUDE.md` | Ausgabe, Skript `verify:model:messen` und Spur-Tabelle. |

## Entscheidungen

| Frage | Festlegung | Begründung |
|---|---|---|
| Was gehört in die Modell-Spur? | Jeder Test, der beim Lauf eine Datei liest, deren Änderung die Spur auslöst. Gemessen, nicht nach Textmustern. | Entscheidung des Auftraggebers 2026-11-26. Die Textmuster lagen in beide Richtungen daneben, siehe Befund. |
| Skill-Texte unter `.claude/` | Spur CODE, nicht MODELL | Rund 40 Tests prüfen sie; die Modell-Spur führe sonst bei einem Skill-Commit keinen davon. |
| Ausnahmen | Nur ein Leser, der durch eine Änderung an der gelesenen Datei nicht rot werden kann. Jede mit Grund. | Der Vollständigkeits-Test weist eine Ausnahme ab, die nichts liest. |

## Restrisiko

Die Messung hängt am Fingerabdruck der Testdatei. Ändert sich nur der Code unter Test und liest danach die SSOT,
bleibt die alte Messung stehen, bis jemand `--alle` fährt. Diese Lücke fängt die volle Suite in CI.

## Akzeptanz

- [x] Die Messung über alle 252 Testdateien läuft ohne roten Test durch (12 min). Ein geänderter Test braucht danach Sekunden.
- [x] `npm run verify:model` ist grün: 45 Testdateien, 414 Tests, rund 80 s. Vorher waren es 56 Dateien in rund 45 s.
- [x] Positivkontrolle: Ein Test mit geändertem Inhalt macht den Vollständigkeits-Test rot. Eine Harness mit `repoRoot: REPO_ROOT` ohne `lockDir` macht die Parallelitätsprüfung rot.
- [x] Hook: Ein Skill-Text geht in die Spur CODE, ein CR-Text bleibt in der Spur MODELL. Die Tests `flow-contracts` und `commit-pruefung` sind grün.
- [x] Type-check ohne Fehler. `verify:full CR-GC-1034`: 357/357 grün, kein Schlupf.

## Nebenbefunde

- **Prüfung auf Parallelität geschärft.** Sie meldete `claims.conformance` zu Unrecht: Der Test liest das Repo, baut die Harness aber auf einem Temp-Verzeichnis (`repoRoot: tmp`). Verdächtig ist jetzt nur noch eine Harness, deren `repoRoot` auf das Repo zeigt.
- **`distribution` als dritte Ausnahme.** Der Test baut `dist/` neu. Im parallelen Lauf fehlte deshalb einem anderen Test `dist/index.js` (`whitebox-messung`). `README.md` liest er nur als Inhalt des Pakets.
- **Von vier alten Ausschlüssen fahren drei jetzt mit:** `live-feed`, `rig-measured` und `skill-modulebene-felder`. Sie lesen die SSOT, und `live-feed` wird laut seinem eigenen Grund rot, wenn ein Modellwert den Codec bricht. `attributvertraege` liest `docs/cr`.
