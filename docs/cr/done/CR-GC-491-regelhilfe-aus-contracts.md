# CR-GC-491 — Die Regelhilfe kommt aus contracts

**Status:** erledigt · **Angelegt:** 2026-09-09 · **Abgeschlossen:** 2026-09-09 · **Art:** Umzug (kein neuer Pfad)
**Gegenstück:** `CR-SM-300` (sigloch-modules) — dieser CR ist dessen Consumer-Hälfte
**Voraussetzung:** `@sigloch/contracts` ≥ 10.1 (`RULE_HELP`)

---

## 1. Root Cause

Die Plain/SE-Hilfe zu **Regeln** lag in `src/projections/help-content.ts`, der Regelkatalog in
contracts. CR-GC-227 hat das bewusst so entschieden — Tempo, kein Bump, kein Familien-Review —
und die Verschiebung ausdrücklich als spätere Entscheidung notiert.

Die Trennung ist in **beide Richtungen** gedriftet, gemessen am 2026-09-08: **11** Einträge zu
Regel-IDs, die es nicht mehr gab (`AO-D03` seit drei Wochen), und **8** Katalogregeln ganz ohne
Eintrag — darunter `BW-02`, eine der vier Steuerdimensionen: eine Regel, die rankt und sich nicht
erklärt.

`tests/help-content.test.ts` hätte beides gemeldet. **Sie war rot und blieb es**, weil vier
Releases lang niemand die Suite dieses Repos gelesen hat (CR-GC-488). Hinter dem Symlink gilt kein
Versionsbereich — nichts hat die zwei Hälften je zusammengezwungen.

## 2. Impact

**Bricht:** nichts an der Oberfläche. `graph_help` liefert dieselben 100 Einträge, `HELP_CONTENT`
bleibt derselbe Export mit derselben Signatur, alle Leser (`help.ts`, `src/index.ts`) sind
unverändert.

**Behebt:** die Möglichkeit der Drift. Eine Regelstreichung nimmt ihren Hilfeeintrag jetzt mit,
eine Neuanlage kann ohne ihn nicht landen — erzwungen in contracts
(`tests/unit/se-rule-help.test.ts`, beidseitig) und im Golden-File als Oberfläche `ruleHelp`
an `RULES_VERSION` gehängt.

## 3. Änderung

- `src/projections/help-content.ts`: die **69** regel-keyed Paare (63 Katalog- + 6
  Conformance-Regeln) entfallen; `...RULE_HELP` aus `@sigloch/contracts/se` tritt an ihre Stelle.
  Datei 718 → 349 Zeilen.
- Hier **bleibt**, was an graphcodes Oberfläche hängt und nicht am Regelkatalog: 8 Phasen-Gates,
  5 Panels, die 3 Readiness-Zahlen, 15 Artefakte, `HELP_VOCAB`, `HELP_ELEMENT_STATES` und
  `METRIC_HELP` (CR-GC-458, die sechs ℝ⁶-Dimensionen — graphcodes Messschicht, nicht contracts').
- `package.json`: `@sigloch/contracts` `>=10 <11` → `>=10.1 <11` — der Floor folgt dem Import.

## 4. Akzeptanzkriterien

- [x] `HELP_CONTENT` trägt weiterhin genau 100 Schlüssel, davon 69 Regeln.
- [x] `tests/help-content.test.ts` grün — sie prüft weiter gegen die **lebenden** Registraturen,
      jetzt inklusive der aus contracts gespeisten Hälfte.
- [x] `tests/help.test.ts` grün — die Projektion mischt Abgeleitetes unverändert dazu.
- [x] Keine zweite Wahrheit: `grep -c "plain:" src/projections/help-content.ts` zählt nur noch
      die Nicht-Regel-Einträge.
- [x] Volle Suite: **1037 / 1039**. Die zwei roten sind `lockfile-sync` und `distribution`, und
      beide sagen dasselbe: `@sigloch/contracts >=10.1 <11` ist noch nicht in der Registry, also
      kann weder das Lock aufloesen noch ein Tarball in ein fremdes Repo installieren. Das ist
      die Zug-Reihenfolge (Peers zuerst), kein Defekt — beide werden gruen, sobald contracts
      10.1.0 publiziert ist, und bleiben bis dahin der Beweis, dass der Floor ehrlich ist.
- [x] Nach dem Release-Zug (`contracts@10.1.0` publiziert): Lock nachgezogen, beide Tests grün.
      Volle Suite **1047 / 1047**.
