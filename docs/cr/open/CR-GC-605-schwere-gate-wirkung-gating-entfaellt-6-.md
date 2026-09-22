# CR-GC-605: Gate und Fokus ohne `gating`, Smeagol Stufe (e) Empfehlungskonsistenz, Regel-Matrix ohne abgeleitete Spalten

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-461 (idea)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-461.json (Lane: graph)
**Partner-CR:** sigloch-modules CR-SM-353 (Schwere = Gate-Wirkung: 11 Regeln → warning, darunter ND-01/02 und RC-01..03) und CR-SM-354 (Phase, R-27). Diese CR
importiert die neuen contracts/graph-api-core und hebt den Peer-Floor im selben Commit.
**Umfang:** ausnahmsweise bis 10 Dateien (Entscheidung Auftraggeber 2026-09-22) — Smeagol muss
**parallel** zur Schwere-Verschmelzung kommen, nicht danach.

---

## Warum (Analyse der Regel-Matrix, 2026-09-22)

Die Matrix (`scripts/regel-matrix.mjs`, CR-GC-600) hat 13 Spalten; vier tragen keine eigene
Information, eine ist falsch belegt, eine ist die falsche Quelle:

| Spalte | Befund |
|---|---|
| blockt am Gate | abgeleitet aus Schwere + verstecktem Flag `gating` — das Flag faellt mit CR-SM-353 |
| im Kern-Fokus | vollstaendig abgeleitet (Task = kern ∧ Katalog ∈ {Gate, ND} ∧ Schwere ≠ info) |
| Eintritt fuer | `TASK_ENTRY` invertiert, 5 Zeilen |
| Katalog | die Klasse `Code (RC)` ist toter Zweig: RC steht in `ALL_RULE_DEFS`, der Steuerungs-Zweig greift zuerst — 7 RC-Zeilen stehen falsch als „nur Steuerung" |
| Skills | Text-Grep ueber Skill-Prosa. 45 von 74 leer, AF-01..05 „ohne Skill", obwohl `RULE_HELP.prompt` und `TASK_SKILL` beide se-conops usw. nennen |

Die Empfehlung einer Regel liegt an **drei** Stellen, die niemand gegeneinander prueft:
`fix_hint` (Regeldefinition, Werkzeugnamen in Prosa), `RULE_HELP.prompt` (contracts, 22 Regeln,
nur die Form geprueft — ob der Skill existiert, kann contracts nicht wissen) und in graphcode
`TASK_SKILL` / `SKILL_FOR_DIMENSION`. `TASK_SKILL` dupliziert `RULE_HELP[AF-0x].prompt` woertlich.
Widersprueche heute: UC-01 → se:author-req, Dimension uc → se:author-uc; R-04 → se-view:arch, obwohl
`SKILL_FOR_DIMENSION` Views ausdruecklich ausschliesst; R-01/RD-01 → se:close-violations, das der
Generator aus der Skills-Spalte filtert.

## Aenderung

### Gate und Fokus (Folge von CR-SM-353)

| Datei | Aenderung |
|---|---|
| `src/kernel/gate.ts` | `hasNewError` prueft nur `severity === 'error'`; Typ `GatedViolation` und `gating:` im Protokoll entfallen |
| `src/kernel/measure/focus-set.ts` | das Task-Mapping `error → warning` entfaellt (nach CR-SM-353 traegt keine Task-Regel mehr `error`); Kopfkommentar: `blockingErrors` = error-Funde der Fokusmenge = Gate-Schulden, keine zweite Definition mehr |
| `src/kernel/measure/steering-snapshot.ts` | Kommentar zu FM-03/`gating` streichen |
| `tests/focus-set.test.ts` | Fixtures: UC-01/FM-03/ND-01 als `warning`; der Task-Fall prueft, dass die Fokusmenge die Schwere **unveraendert** durchreicht |
| `tests/mcp.mutate-violations.test.ts` | `gating`-Feld aus dem Violation-Typ |
| `tests/evaluation.rule-catalog.test.ts` | die Liste `['ND-01','ND-02','RC-01','RC-02','RC-03']` der errors ausserhalb des Gates wird **leer** — der Drift-Waechter prueft dann: kein error ausserhalb des Gate-Katalogs, ohne Ausnahmegrund |

Risiko, am Golden messen: `generate.ts` rangiert Fokus-Fenster nach Schwere (error vor warning).
UC-01/UC-02 rutschen damit in der Reihenfolge — Golden-Lauf vor/nach vergleichen und die Differenz im
Abschluss benennen.

### Smeagol Stufe (e) — Empfehlungskonsistenz (`tests/skill-rule-ids.test.ts`)

Vorbild: rustc `lint-docs` (jedes Beispiel muss den Lint wirklich ausloesen), Clippy
`cargo dev update_lints --check` (generierte Tabelle ≠ Quelle → CI rot), Roslyn
`FixableDiagnosticIds` (Fix→Regel-Bindung im Code, nicht in Prosa).

1. **Jeder `RULE_HELP.prompt` nennt einen ausgelieferten Skill** — Namen aus `.claude/commands`
   (`se-view/fmea.md` → `se-view:fmea`). contracts prueft nur die Form; die Existenz kann nur das
   Repo pruefen, das die Skills ausliefert.
2. **`TASK_SKILL[t] === RULE_HELP[TASK_ENTRY[t]].prompt`** fuer jeden Task mit Eintrittspunkt. Die
   Tabelle bleibt in `generate.ts` (zwei Tasks haben keinen Eintritt), der Test bindet sie.
3. **Kern-Regel mit `prompt` und Dimension:** `prompt === SKILL_FOR_DIMENSION[dim].name`, sonst in
   einer **benannten Ausnahmeliste** im Test — Ratsche wie `import-boundaries`: eine gelistete
   Ausnahme, die nicht mehr abweicht, laesst den Test fallen. Startliste beim Implementieren aus
   dem ersten Lauf, jede mit einem Satz Grund (UC-01: „UC ohne REQ" wird durch REQ-Autorieren
   geloest; R-04 Views: entscheiden, nicht listen).
4. **Werkzeugnamen in `fix_hint`** (`graph_*`, `rules_*`, `audit_*`) existieren in der
   MCP-Registry (`src/surface/mcp-tools.ts`).
5. **`error` nur im Gate-Katalog:** jede Regel aus `ALL_RULE_DEFS` mit `severity: 'error'` steht in
   `SE_DESCRIPTOR.rules` — **ohne Ausnahmeliste** (ND-01/02 und RC-01..03 sind warning, Entscheidung 2026-09-22).
6. **Steuerregel nie `info`:** `STEER_RULES` ∩ info = ∅. Faellt heute an MT-02 — deshalb als
   `it.todo` mit Verweis auf das Zeilen-Item, **kein** stiller Skip.

### Regel-Matrix (`scripts/regel-matrix.mjs`)

- Spalten `blockt am Gate` und `im Kern-Fokus` entfallen; `Eintritt fuer` wird in `Task` gefaltet
  („kern, Eintritt conops"); Katalog-Klasse aus dem Bedarf abgeleitet: `Gate` / `Aehnlichkeit (ND)` /
  `CodeFacts (RC)` / `nur Steuerung (BQ)` — kein toter Zweig.
- `Skills` wird zu drei Spalten: `Hilfe-Prompt` (`RULE_HELP.prompt`), `Task-/Dimensions-Skill`
  (`TASK_SKILL` bzw. `SKILL_FOR_DIMENSION`), `Konflikt` (ja, wenn beide gesetzt und verschieden);
  die Prosa-Nennungen bleiben als vierte Spalte `nennt`.
- `docs/research/regel-matrix.{md,csv}` neu generiert (kein Handedit, zaehlt nicht als Datei).

Dateien: 8 fest (oben) + `scripts/regel-matrix.mjs` = 9. Reserve 1 fuer Tests, deren Erwartung an
der alten Schwere haengt — Kandidaten `tests/readiness.model.test.ts`, `tests/zugverlauf.replay.test.ts`,
`tests/help.test.ts` (grep `'error'` neben UC-01/FM-03/MS-02); mehr als einer → stoppen und splitten.

## Akzeptanzkriterien

- [ ] `grep -rn gating src tests scripts` leer.
- [ ] `unevaluatedRuleIds` enthaelt keine error-Regel mehr; `LOCALLY_EVALUATED_RULE_IDS` (ND) bleibt, ND-Funde erscheinen als warning im Kern-Fokus (`STEERING_ONLY_KERN` unveraendert).
- [ ] Smeagol (e) 1–5 gruen, 6 als `it.todo` mit Item-Verweis; die Ausnahmeliste zu (3) hat je Eintrag einen Grund.
- [ ] `node scripts/regel-matrix.mjs`: 74 Zeilen, keine Zeile „nur Steuerung" mit RC-Praefix, AF-01..05 mit Hilfe-Prompt, `Konflikt`-Spalte zeigt genau die im Test gelisteten Ausnahmen.
- [ ] Golden: Kern-Fokusmenge vor/nach CR-SM-353 verglichen, Reihenfolge-Differenz (UC-01/02) benannt.
- [ ] `verify:code` fuer den Changeset, `npm test` vor Abschluss; Peer-Floor contracts/graph-api-core im selben Commit gehoben.
- [ ] Kongruenz: CR-Knoten CR-GC-605 mit `relation`-Kanten auf FUNC gate / focus-set / regel-matrix / skill-rule-ids; RC-07 gruen.

---

## Umsetzung (2026-09-22)

**Gate und Fokus.** `gate.ts`: `hasNewError` prueft nur noch `severity === 'error'`; `GatedViolation` und der
`gating`-Stempel sind weg. `focus-set.ts`: das Task-Mapping error → warning entfaellt — die Schwere wird
durchgereicht; die eine Task-Regel mit error ist R-29 (Gate-Blocker der Realisierung), Smeagol (e) haelt
das fest. `evaluation.rule-catalog.test.ts`: die Ausnahmeliste `['ND-01','ND-02','RC-01','RC-02','RC-03']`
der errors ausserhalb des Gates ist **leer**.

**Gemessene Nebenwirkung, behoben:** die Schwere trug die Fokus-Reihenfolge mit (CR-GC-563: UC-01/UC-02
als error vor FC-02). Mit UC-01/UC-02 als warning stand FC-02 wieder vorn — exakt der Rig-Lauf-4-Fall.
Jetzt ordnet innerhalb einer Schwere die **Klausel** (`RULE_CLAUSE`: UC-01, UC-02, R-15 — eine Regel mit
Bauanweisung vor einer, die nur meldet). Tests CR-GC-563/564/566 laufen unveraendert durch, die
Begruendung im Kommentar ist die neue.

**Smeagol Stufe (e)** (`tests/skill-rule-ids.test.ts`): (1) jeder `RULE_HELP.prompt` nennt einen
ausgelieferten Skill; (2) `TASK_SKILL[t] === RULE_HELP[TASK_ENTRY[t]].prompt`; (3) Kern-Regel: Prompt gegen
`SKILL_FOR_DIMENSION`, Abweichungen als Ratsche benannt — UC-01 (REQ-Autorieren), RD-01 (satisfy-Kante),
R-04 (Sicht vor Schnitt); (4) jeder Werkzeugname in Hilfe und Skills steht in der MCP-Registry; (5) error nur
im Gate-Katalog, ohne Ausnahmeliste; (6) Task-Regel mit error = genau R-29; (7) `it.todo` Steuerregel nie info
(MT-02, ITEM-2026-462).

**Regel-Matrix** (`scripts/regel-matrix.mjs`): Spalten `blockt am Gate`, `im Kern-Fokus`, `Eintritt fuer`
entfallen (abgeleitet bzw. im Task gefaltet); `Katalog` → `Bedarf` (Gate / Aehnlichkeit / CodeFacts / nur
Steuerung, kein toter Zweig); `Skills` → `Hilfe-Prompt`, `Skill` (TASK_SKILL / Eintritt / SKILL_FOR_DIMENSION
wie generate.ts), `Konflikt`, `nennt`. Stand: 76 Regeln, 62 im Gate-Katalog, 5 blocken, 3 Konflikte = die
drei benannten Ausnahmen.

**Golden-Vergleich:** Kern-Fokus am sigllm-Golden und den Fixtures: gleiche erste Fenster (UC-01 → UC-02 →
FC-02 …); `blockingErrors` sinkt ueberall, wo UC-01/UC-02/FM-03/ND als error zaehlten — das war die
Klasse aus Rewind opus5-12. Golden rule-output in contracts: nur sha bewegt, keine Zahl.

Weitere Tests nachgezogen (Schwere-Erwartungen): `nd-similarity`, `evaluation.near-duplicate`,
`conformance` (RC-01 offen statt blockend am TRR-Gate), `readiness-conformance-skip`,
`steering.process-ratchet` (Netto-Fortschritt an der Gate-Abdeckung), `steering.artifact-coupling`
(R-26 TRR), `claims.conformance` + drei Artikel (67 → 69 engine rules). Dateien: 8 Kern + 10 Tests +
Matrix + Artikel — die Reserve von einer Datei hat nicht gereicht, die Schwere-Erwartung stand in mehr
Tests als gegrept (bewusst nicht gesplittet: alles dieselbe Ursache, im selben Zug).
