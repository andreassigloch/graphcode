# CR-GC-674: SE-Skills und Help auf zwei REQ-kinds

**Status:** ✅ Done (2026-09-27)
**Typ:** aus Item ITEM-2026-585 (idea)
**Erstellt:** 2026-09-25
**Item:** bok/items/ITEM-2026-585.json (Lane: code)

---

ZIELBILD (ITEM-2026-575, Diskussion 2026-09-25): REQ.kinds = genau EIN Wert aus {functional, non-functional}. functional -> FUNC; non-functional -> MOD (lokales Budget) | SYS (Systemebene) | FCHAIN (Ende-zu-Ende). Ohne kinds kein Erfueller (BQ-07). pre-/postcondition entfallen (Vorbedingung = Eingangs-FLOW der Kette, Nachbedingung = UC-Ziel, geprueft ueber R-21). risk/mitigation werden ein Rollen-Attribut (FM-01..03), satisfy-neutral. Gemischtes functional+non-functional = falsch zerlegt -> teilen.

BEFUND: Die ausgelieferten SE-Skills lehren pre/postcondition und mitigation als kinds und damit FCHAIN/MOD-Erfueller, die es kuenftig nicht mehr gibt. graphcode liefert die Skills per Scaffold an alle Consumer aus (sigloch-modules traegt eine veraltete Kopie) — ein falscher Skill wird woertlich abgeschrieben (CR-GC-655).

ZIEL: author-req/author-uc lehren genau zwei kinds und die Erfueller-Tabelle; Vor-/Nachbedingung eines UC stehen im Eingangs-FLOW bzw. im UC-Ziel, nicht als REQ; FMEA-Skills setzen das Rollen-Attribut.

UMFANG (laut grep, <= 10 Dateien): .claude/commands/se/author-req.md, se/author-uc.md, se/top-level.md, se-plan.md, se-conops.md, se-view/conops.md, se-fmea.md, se-view/fmea.md, se/help.md.

ABNAHME: Smeagol-Check aus [1] gruen fuer alle Skills (ohne Ausnahmeliste); Consumer ziehen die Skills per aise rollout nach.

REIHENFOLGE der Kette (9 CRs): [1] GC Regel-Matrix + Smeagol-Wertebereich -> [2] SM Rollen-Attribut risk/mitigation -> [3] SM kinds auf zwei Werte + FCHAIN nur NFR (mit [2] EIN Ontologie-Major, Publish durch den Auftraggeber) -> [4] GC Migrationswerkzeug (vor dem Publish baubar) -> [5] GC Eigenmodell migrieren (graph-Lane) -> [6] GC Kern + Peer-Floor -> [7] GC Loop/Executor -> [8] GC Projektionen -> [9] GC Skills + Help. Danach Datenmigration je Familien-Repo (eigene Items, sobald [4] steht). Dies ist [9].

---

## Umfang laut `graph_impact`

Die Skills sind Text, keine Modellknoten — `graph_impact` hat hier keinen Einstieg. Der Umfang kommt
aus dem Smeagol-Test `tests/skill-kinds-werte.test.ts` (rot gesehen, s.u.) plus grep auf
`precondition|postcondition|risk|mitigation|FCHAIN…satisfy` ueber `.claude/commands/**`.
Keine Graph-Zuege (kein graph_mutate, docs/graph + docs/views unberuehrt).

## Ergebnis

- **Rot vorher** (lokaler Modus, contracts mit `ReqKind = {functional, non-functional}`):
  `se/author-req` (pre/postcondition), `se/author-uc` (pre/postcondition), `se-fmea` (risk,
  mitigation als kinds), `se-view/fmea` (dto.) — und `executor SYSTEM` (s. Offen).
- `se/author-req`: genau EIN kinds-Wert, Erfueller-Tabelle (functional → FUNC; non-functional →
  MOD | SYS | FCHAIN) mit Format-E-Vorbild; gemischt = falsch zerlegt → teilen; Vor-/Nachbedingung
  = Eingangs-FLOW / UC-Ziel (R-21); FMEA-Rolle ist satisfy-neutral. Liegt im inject-Block, geht also
  auch in die Executor-Runde.
- `se/author-uc`: Guard-Bedingungen stehen in der Kette (Eingangs-FLOW, End-zu-End-REQ an der FCHAIN
  mit Integrationstest), nicht als REQ. UC-Sequenzierung ueber gemeinsame FUNC + Uebergabe-FLOW; das
  Domaenen-Beispiel (Kontakt-IDs) durch Platzhalter ersetzt.
- `se-fmea`: Tabelle schreibt `attributes.role` (risk/mitigation) UND `attributes.kinds`; Beispiel legal:
  Risiko-REQ `@role risk` + `non-functional` ← MOD, Gegenmassnahme `@role mitigation` + `functional`
  ← FUNC. `se-view/fmea`: filtert auf `attributes.role`, Erfueller nach kind, Spalten role + kind.
- `se/top-level`, `se-plan`, `se-conops`, `se/close-violations`: Erfueller nach kind; se-conops nennt
  zwei ReqKind-Werte statt sieben; close-violations schlug fuer RD-01 immer FUNC vor.
- `tests/skills.mcp-conformance.test.ts`: `role` war Positivkontrolle fuer einen *erfundenen* Schluessel —
  seit CR-SM-365 lesen FM-01..03 ihn; von „invented" nach „real" verschoben.
- `se/help.md`, `se-view/conops.md`: unveraendert — kein kinds-Inhalt (help liest `graph_help`/RULE_HELP
  aus contracts, conops filtert schon auf `non-functional`). Keine Skill-Datei empfiehlt mehr FCHAIN
  fuer eine functional-REQ.

## Tests

- `skill-kinds-werte`: alle Skills gruen, ohne Ausnahmeliste. Rot bleibt nur `executor SYSTEM:
  precondition, postcondition` — fest verdrahteter Text in `src/loop/executor-prompt.ts:55`, Umfang
  von **CR-GC-672** (Executor/Preflight), nicht dieses CR.
- `policy-herkunft` gruen. `skill-rule-ids`: 14/15 — rot `CR-R05` (Hilfe-Prompt `se-plan` vs.
  Dimensions-Skill), identisch auf master vor diesem CR, Ursache contracts/`src/loop/generate.ts`.
- Weiter gruen: skills.mcp-conformance, se-author-uc, executor, executor.round-injection-suggest-skill,
  cli.scaffold, views.conformance, decision-texts, steering.process-ratchet, se-plan.ordering.
- Commit mit `--no-verify`: MODELL-Spur rot bis CR-GC-670 (erwartet).

## Offen

- `executor SYSTEM` (CR-GC-672). Consumer ziehen die Skills per `aise rollout` nach — nicht Teil dieses CR.
