# CR-GC-670: graphcode-Eigenmodell auf zwei REQ-kinds migrieren

**Status:** ✅ Done (2026-09-27)
**Typ:** aus Item ITEM-2026-581 (idea)
**Erstellt:** 2026-09-25
**Item:** bok/items/ITEM-2026-581.json (Lane: graph)

---

ZIELBILD (ITEM-2026-575, Diskussion 2026-09-25): REQ.kinds = genau EIN Wert aus {functional, non-functional}. functional -> FUNC; non-functional -> MOD (lokales Budget) | SYS (Systemebene) | FCHAIN (Ende-zu-Ende). Ohne kinds kein Erfueller (BQ-07). pre-/postcondition entfallen (Vorbedingung = Eingangs-FLOW der Kette, Nachbedingung = UC-Ziel, geprueft ueber R-21). risk/mitigation werden ein Rollen-Attribut (FM-01..03), satisfy-neutral. Gemischtes functional+non-functional = falsch zerlegt -> teilen.

BEFUND: Im graphcode-Modell tragen 32 REQ pre/postcondition (17 an FUNC, 15 an FCHAIN), 14 functional-REQ haengen an einer FCHAIN, dazu risk/mitigation-REQ. Nach dem Ontologie-Major bootet der Host nicht mehr auf dem Alt-SSOT.

ZIEL: das Eigenmodell mit dem Werkzeug aus [4] migrieren, Entscheidung je REQ (Stichprobe: REQ-no-extraction, REQ-code-governed-quality, REQ-graph-snapshot-per-commit -> non-functional; REQ-doc-export, REQ-graph-state-recall -> an eine FUNC). Nur ueber graph_mutate; danach SSOT und Views re-exportieren.

UMFANG: docs/graph/graphcode.graph.json + Views (Modell-Lane, verify:model).

ABNAHME: rules_evaluate unter den neuen contracts ohne kinds-bedingte R-18/BQ-07; RC-* kongruent oder benannt offen, Bindungsquote ausgewiesen; die umgehaengten functional-REQ haben einen FUNC-Erfueller mit realRef.

REIHENFOLGE der Kette (9 CRs): [1] GC Regel-Matrix + Smeagol-Wertebereich -> [2] SM Rollen-Attribut risk/mitigation -> [3] SM kinds auf zwei Werte + FCHAIN nur NFR (mit [2] EIN Ontologie-Major, Publish durch den Auftraggeber) -> [4] GC Migrationswerkzeug (vor dem Publish baubar) -> [5] GC Eigenmodell migrieren (graph-Lane) -> [6] GC Kern + Peer-Floor -> [7] GC Loop/Executor -> [8] GC Projektionen -> [9] GC Skills + Help. Danach Datenmigration je Familien-Repo (eigene Items, sobald [4] steht). Dies ist [5], graph-Lane; laeuft zwischen Publish von [2]/[3] und [6].

---

## Umfang laut `graph_impact`

Umfang = die 46 REQ, die `migrate-req-kinds propose` auf dem committeten SSOT meldet (32 pre/post,
14 functional an FCHAIN), plus deren satisfy-Kanten. `graph_impact` am laufenden Host nicht befragt
(alter Code, alte contracts).

## Mechanik

- Bootet neuer Code auf dem Alt-SSOT? **Ja** — der Major entfernt kein Pattern, der Seed haelt nur
  `no-pattern`-Kanten zurueck (`noPatternFor`), kinds-Verstoesse laden und erscheinen als R-18.
  Der Alte-contracts-Trick der Memory war nicht noetig. Aber: `graph_readiness` wirft auf dem
  Alt-SSOT (Steuerraum-Snapshot parst den Element-Vertrag, ZodError) — eine Vorher-Readiness gibt es
  deshalb nicht, nur `rules_evaluate`.
- Der Repo-Store gehoert dem laufenden MCP-Host (alter Code, PID mit Puls). Also: Harness mit
  `repoRoot` = Hauptbaum (Config, realRef-Aufloesung, SSOT) und `storeRoot` = Wegwerf-Verzeichnis
  (CR-GC-496), geseedet aus `docs/graph/graphcode.graph.json`; Werkzeug CR-GC-669 `applyDecisions` →
  `graph_mutate` (EIN Batch) → `graph_export`, danach `scripts/export-graph.mjs`.
  **Folge:** Audit und Trajektorie der zwei Batches liegen im Wegwerf-Store; `graph_export` meldet es
  selbst ("1 applied gate mutation(s) have no entry in the repo's learning feed"). Der laufende Host
  haelt einen veralteten Store — Neustart (`/mcp` reconnect) noetig, sein naechster Export verweigert
  sonst per Clobber-Guard.

## Entscheidungen je REQ

Datei: `CR-GC-670-entscheidungen.json` (46 Eintraege, Grund je REQ).

- **mechanisch (17)** pre/post nur an FUNC → functional: REQ-model-exchange-pre, REQ-pre/post-
  {emit-trajectory, emit-update-event, export-markdown, harness-cli, import, merge-nodes,
  migrate-schema}, REQ-steering-pre/-post.
- **Stichprobe → non-functional (3):** REQ-no-extraction (an FCHAIN-model-import; satisfy von
  FUNC-import-code/-import-code-verb/-import-doc entfaellt), REQ-code-governed-quality (an
  FCHAIN-apply-gate; FUNC-test/-test-ui entfallen), REQ-graph-snapshot-per-commit (an
  FCHAIN-snapshot-freshness; FUNC-export-marker/-graph-export-snapshot/-mutate entfallen).
- **Stichprobe → an FUNC (2):** REQ-doc-export (FUNC-export-markdown, -render-views, view-* mit
  realRef), REQ-graph-state-recall (FUNC-rewind/-reseed/-apply-reseed) — FCHAIN-satisfy entfaellt.
- **functional, FUNC erfuellt schon, FCHAIN-satisfy entfaellt (6):** REQ-conflict-free-merge,
  REQ-greenfield-systemtest-dod, REQ-session-leaves-nothing-behind, REQ-skill-authors-through-gate,
  REQ-skill-reads-only, REQ-steering-from-metrics.
- **functional, umgehaengt (1):** REQ-impact-based-testing → FUNC-deduce-tests (realRef, Glied der
  Kette).
- **non-functional an der Kette (2):** REQ-interface-change-escalation (Governance-Regel fuer
  Agenten, keine FUNC realisiert sie allein); REQ-interactive-capture-suggest — zuerst an
  FUNC-decode gehaengt, zweiter Batch korrigiert: die `verify:code`-Auswahl fuer
  `src/loop/format-e-commands.ts` zog damit drei fremde Tests (intent-anchors, se-author-uc;
  `test-selection.audit` rot) — FUNC-decode war der falsche Erfueller.
- **pre/post an FCHAIN → non-functional an der Kette (15):** REQ-model-exchange-post,
  REQ-pre/post-{agent-query, apply-gate, capture, codec-roundtrip, impact-testing,
  interface-escalation, modelfree-gate}. Aufloesen in Eingangs-FLOW/UC-Ziel ist Modellarbeit, nicht
  Migration — offen.

## Ergebnis

| Messgroesse (`rules_evaluate`, neuer Build) | vorher | nachher |
|---|---|---|
| R-18 error (alle kinds) | 46 | **0** |
| error gesamt | 46 | 0 |
| R-21 warning | 12 | 89 |
| R-02 warning | 2 | 7 |
| CR-R05 warning | 27 | 29 |
| Befunde gesamt | 377 | 415 |
| RC-* | RC-04 14, RC-07 9 | RC-04 14, RC-07 9 |

- Altwerte im SSOT 0; REQ mit satisfy ohne kinds 0 (BQ-07-Fall; BQ-07 selbst steht in `skipped`,
  der Steuerpfad wertet es aus); REQ mit mehr als einem kind 0.
- Die umgehaengten functional-REQ haben je einen FUNC-Erfueller mit realRef (Liste oben).
- **RC-Zustand: gedriftet, unveraendert** — RC-04 14 / RC-07 9 standen vorher genauso da, keine davon
  aus dieser Migration. importCoverage 104/105 Endpunkte (offen: src/index.ts). **Bindungsquote**
  108/128 FUNC mit realRef (84,4 %), 2 concept/external.
- **Benannte Verschlechterung R-21 +77:** acht Ketten verlieren ihren Integrationstest-Anker —
  R-21 zaehlt eine Kette als geprueft, wenn sie eine verifizierte REQ erfuellt; FCHAIN darf seit dem
  Major nur non-functional erfuellen, und ihre einzige verifizierte REQ war functional:
  FCHAIN-doc-export, -merge-branches, -recall, -repo-lifecycle, -skill-authoring, -skill-report,
  -steering-loop, -systemtest-run. Behebung: je Kette eine Ende-zu-Ende-NFR, die ihr
  Integrationstest verifiziert — oder R-21 ueber die Kettenglieder verankern (Familien-Frage, contracts).
- **R-02 +5:** FUNC-test, -test-ui, -import-code, -import-doc, -export-marker erfuellten nur die jetzt
  nicht-funktionalen Querschnitts-REQ; ihnen fehlt eine eigene functional-REQ. **CR-R05 +2**: REQ-no-extraction und
  REQ-code-governed-quality — ohne FUNC-Erfueller deckt sie keine gebaute FUNC mehr, und kein CR haengt daran.
- `npm run verify:model`: 46/49 Dateien gruen. Rot, nicht aus diesem CR: `evaluation.rule-catalog`
  (3) und `readiness.model` (1) — neue Regel RC-10 (CR-SM-344) nicht im Katalog/Readiness-Modell,
  ohne CR; `executor.preflight` (2) → CR-GC-672. Durch diesen CR gruen geworden:
  `smoke.create-harness`, `readiness.steer`, `steering.convergence-witness.spike`,
  `repository-style.spike`, `rig-measured`, `readiness-conformance-skip`, `evaluation.reconciliation`.
- Weiter rot, fremde Ursache: `generate.statemachine`/`generate.task`/`generate`,
  `read-tools.scope`, `working-set.spezlauf` lesen den rig-Korpus (sigllm-v98-Golden, opus5-Laeufe)
  mit Altwerten → Korpus-Migration/CR-GC-672; `claims.conformance` (Regelzahl 66 → 68, RC-10);
  `steering.divergence-two-profiles`, `arch.optimization-dry-run.spike`, `steer-optimum` (waren vorher
  schon rot); `channel-rank` (seit den master-Commits CR-GC-673/674/684).
