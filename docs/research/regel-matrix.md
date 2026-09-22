# Regel-Matrix

> GENERIERT von `scripts/regel-matrix.mjs` aus contracts, graph-api-core, se-engine und graphcode — nicht von Hand bearbeiten.
> 73 Regeln · 59 im Gate-Katalog · 5 blocken (Stufe error) · 3 Prompt/Skill-Konflikte (Ausnahmen in tests/skill-rule-ids.test.ts).
> Fix-Vorlagen: 11 Regeln tragen eine · 10 schliessen den Fund · 1 Teil-Fix · 0 tot (CR-SM-357).

## Tasks

| Task | Regeln | Eintrittspunkt im Kern | Skill | abnehmbar im Task |
|---|---:|---|---|---|
| kern | 43 | — | — | AF-01, AF-02, AF-03, AF-04, AF-05 |
| conops | 1 | AF-01 | se-conops | CL-01 |
| trade | 1 | AF-02 | se-trade | — |
| irr | 1 | AF-03 | se-irr | — |
| fmea | 3 | AF-04 | se-fmea | FM-03 |
| plan | 6 | AF-05 | se-plan | MS-01, CR-R01 |
| anforderungsqualitaet | 5 | ausdruecklich / Zustand | se:author-req | — |
| realisierung | 13 | ausdruecklich / Zustand | se-test | R-19, R-20, R-26, R-32 |

## Alle Regeln

| Regel | Name | Bedarf | Stufe | Task | Phase | Dimension | Steuerregel | abnehmbar in | Hilfe-Prompt | Skill | Konflikt | nennt | Fix | Folge-Regeln |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AF-01 | ConOps freshness stamp present | Gate | warning | kern, Eintritt fuer conops | SRR | req |  | kern | se-conops | se-conops |  |  |  |  |
| AF-02 | Trade Study freshness stamp present | Gate | warning | kern, Eintritt fuer trade | PDR | arch |  | kern | se-trade | se-trade |  | se-trade |  |  |
| AF-03 | Assumption Review freshness stamp present | Gate | warning | kern, Eintritt fuer irr | PDR | req |  | kern | se-irr | se-irr |  |  |  |  |
| AF-04 | FMEA freshness stamp present | Gate | warning | kern, Eintritt fuer fmea | CDR | ver |  | kern | se-fmea | se-fmea |  |  |  |  |
| AF-05 | Implementation Plan freshness stamp present | Gate | warning | kern, Eintritt fuer plan | PDR | ms |  | kern | se-plan | se-plan |  |  |  |  |
| BQ-01 | Unambiguous | nur Steuerung | warning | anforderungsqualitaet | SRR | req |  |  | se:author-req | se:author-req |  |  |  |  |
| BQ-02 | Verifiable | nur Steuerung | warning | anforderungsqualitaet | SRR | req |  |  | se:author-req | se:author-req |  |  |  |  |
| BQ-04 | Necessary | nur Steuerung | warning | anforderungsqualitaet | SRR | req |  |  |  | se:author-req |  |  |  |  |
| BQ-06 | Conforming | nur Steuerung | warning | anforderungsqualitaet | SRR | req |  |  | se:author-req | se:author-req |  |  |  |  |
| BQ-07 | Complete | nur Steuerung | warning | anforderungsqualitaet | SRR | req |  |  | se:author-req | se:author-req |  |  |  |  |
| BW-02 | Whitebox boundary width | Gate | warning | kern | PDR | arch | ja |  |  | se:top-level |  |  |  |  |
| CL-01 | ConopsCompleteness | Gate | warning | conops | SRR | uc |  | conops | se-conops | se-conops |  | se:author-actor |  |  |
| CR-01 | CrossingFlowCount | Gate | warning | kern | PDR | arch | ja |  |  | se:top-level |  | se:top-level |  |  |
| CR-R01 | CR must track | Gate | warning | plan | SRR | cr |  | plan |  | se-plan |  |  | schliesst |  |
| CR-R02 | Done requires commit | Gate | warning | plan | TRR | cr |  |  |  | se-plan |  |  |  |  |
| CR-R03 | No concurrent mutation | Gate | warning | plan | SRR | cr |  |  |  | se-plan |  |  |  |  |
| FC-02 | Leaf UC has FCHAIN | Gate | warning | kern | SRR | uc |  |  | se:author-uc | se:author-uc |  | se:author-uc se-fmea |  |  |
| FC-03 | FCHAIN is flat | Gate | warning | kern | PDR | uc |  |  |  | se:author-uc |  | se-fmea |  |  |
| FC-04 | FCHAIN actor-bounded (trigger+consumer) | Gate | warning | kern | PDR | uc |  |  |  | se:author-uc |  | se:author-actor se-fmea |  |  |
| FM-01 | RiskReqFmeaAttributes | Gate | warning | fmea | SRR | req |  |  | se-fmea | se-fmea |  | se-fmea |  |  |
| FM-02 | RiskReqMitigation | Gate | warning | fmea | SRR | req |  |  | se-fmea | se-fmea |  | se-fmea |  |  |
| FM-03 | HighRiskVerification | Gate | warning | fmea | TRR | ver |  | fmea | se-fmea | se-fmea |  | se-fmea se-view:fmea |  |  |
| IO-01 | FuncPairIOCompleteness | Gate | warning | kern | PDR | arch |  |  |  | se:top-level |  | se:top-level |  |  |
| IO-02 | FLOW single producer | Gate | error | kern | PDR | arch |  |  |  | se:top-level |  |  |  |  |
| IR-01 | Assumption review promoted to CR | Gate | warning | irr | PDR | req |  |  | se-irr | se-irr |  | se-irr |  |  |
| MS-01 | Milestone empty scope | Gate | warning | plan | SRR | ms |  | plan |  | se-plan |  |  |  |  |
| MS-02 | Milestone dangling dependency | Gate | warning | plan | SRR | ms |  |  |  | se-plan |  |  |  |  |
| MS-03 | CR without milestone | Gate | info | plan | SRR | ms |  |  | se-plan | se-plan |  |  | schliesst |  |
| MT-01 | Module instability | Gate | warning | kern | PDR | alloc |  |  |  | se:top-level |  |  |  |  |
| MT-02 | Module cohesion (LCOM4) | Gate | warning | kern | PDR | alloc | ja |  |  | se:top-level |  | se:top-level |  |  |
| MT-04 | Whitebox cohesion (LCOM4) | Gate | info | kern | PDR | arch |  |  |  | se:top-level |  |  |  |  |
| ND-01 | FuncNearDuplicate | Aehnlichkeit (ND) | warning | kern | PDR | arch |  |  |  | se:top-level |  |  |  |  |
| ND-02 | SchemaNearDuplicate | Aehnlichkeit (ND) | warning | kern | CDR | schema |  |  |  |  |  |  |  |  |
| NFR-01 | BudgetOvershoot | Gate | warning | kern | CDR | arch |  |  |  | se:top-level |  |  |  |  |
| R-01 | REQ must have verification | Gate | error | kern | TRR | ver |  |  | se:close-violations |  |  | se:author-req se-conops se-fmea se-view:fmea |  |  |
| R-02 | FUNC must satisfy REQ | Gate | warning | kern | PDR | arch |  |  |  | se:top-level |  | se-fmea | schliesst |  |
| R-04 | Module boundary width | Gate | warning | kern | PDR | alloc | ja |  | se-view:arch | se:top-level | ja | se:top-level |  |  |
| R-05 | TEST must verify REQ | Gate | warning | kern | TRR | ver |  |  |  |  |  |  |  |  |
| R-08 | Trace consistency | Gate | error | kern | PDR | arch |  |  |  | se:top-level |  |  |  |  |
| R-10 | FLOW completeness | Gate | warning | kern | PDR | arch |  |  |  | se:top-level |  |  |  |  |
| R-12 | No circular dependencies | Gate | warning | kern | PDR | arch |  |  |  | se:top-level |  |  |  |  |
| R-15 | FCHAIN completeness | Gate | warning | kern | PDR | uc |  |  |  | se:author-uc |  |  |  |  |
| R-16 | ACTOR must have io | Gate | warning | kern | SRR | uc |  |  |  | se:author-uc |  | se:author-actor |  |  |
| R-17 | SYS must have compose | Gate | warning | kern | SRR | uc |  |  |  | se:author-uc |  | se:top-level |  |  |
| R-18 | Valid trace pattern | Gate | error | kern | PDR | arch |  |  |  | se:top-level |  | se:author-actor se:import-doc se-fmea se-plan | schliesst |  |
| R-19 | Runnable TEST binding | Gate | warning | realisierung | TRR | ver |  | realisierung |  | se-test |  | se-irr se-retro se-test |  |  |
| R-20 | FUNC realRef binding | Gate | warning | realisierung | TRR | arch |  | realisierung |  | se-test |  | se:import-code se-irr se-retro |  |  |
| R-21 | FUNC↔FUNC handover needs a shared chain and an integration test | Gate | warning | kern | TRR | ver |  |  |  |  |  |  |  |  |
| R-22 | FUNC must be allocated to MOD | Gate | warning | kern | PDR | alloc |  |  |  | se:top-level |  | se:top-level | schliesst | RD-05 |
| R-23 | MOD must have allocated FUNC | Gate | warning | kern | PDR | alloc |  |  |  | se:top-level |  |  | schliesst | RD-05 |
| R-26 | SCHEMA must have realRef | Gate | warning | realisierung | TRR | schema |  | realisierung |  | se-test |  |  |  |  |
| R-29 | Test file exclusivity | Gate | error | realisierung | TRR | ver |  |  |  | se-test |  | se:author-req |  |  |
| R-30 | FUNC leaf must belong to a function chain | Gate | warning | kern | PDR | arch |  |  |  | se:top-level |  | se:top-level | schliesst |  |
| R-31 | FUNC must be wired (io input + output) | Gate | warning | kern | PDR | arch |  |  |  | se:top-level |  |  | Teil-Fix |  |
| R-32 | SCHEMA must have contract TEST | Gate | warning | realisierung | TRR | ver |  | realisierung |  | se-test |  |  |  |  |
| RC-01 | FUNC realRef resolves to a declared symbol | CodeFacts (RC) | warning | realisierung |  |  |  |  |  | se-test |  | se-review |  |  |
| RC-02 | testRefs entries resolve to runnable tests | CodeFacts (RC) | warning | realisierung |  |  |  |  |  | se-test |  | se-review |  |  |
| RC-03 | SCHEMA realRef resolves to a declared export | CodeFacts (RC) | warning | realisierung |  |  |  |  |  | se-test |  | se-review |  |  |
| RC-04 | SCHEMA realRef is parsed at its interface | CodeFacts (RC) | warning | realisierung |  |  |  |  |  | se-test |  |  |  |  |
| RC-05 | cross-module import drift | CodeFacts (RC) | warning | realisierung |  |  |  |  |  | se-test |  |  |  |  |
| RC-06 | external realRef names a declared dependency | CodeFacts (RC) | warning | realisierung |  |  |  |  |  | se-test |  |  |  |  |
| RC-07 | CR node agrees with docs/cr | CodeFacts (RC) | warning | realisierung |  |  |  |  |  | se-test |  |  |  |  |
| RD-01 | Unresolved requirement | Gate | warning | kern | SRR | req |  |  | se:close-violations | se:author-req | ja | se:author-req | schliesst |  |
| RD-02 | Decomposition consistency | Gate | warning | kern | SRR | req |  |  |  | se:author-req |  |  |  |  |
| RD-04 | Decomposition breadth | Gate | warning | kern | PDR | arch | ja |  |  | se:top-level |  | se:top-level |  |  |
| RD-05 | Decomposition too narrow | Gate | warning | kern | PDR | arch |  |  |  | se:top-level |  |  |  |  |
| SC-02 | Schema referenced by FLOW | Gate | warning | kern | CDR | schema |  |  |  |  |  |  | schliesst |  |
| TR-01 | Trade decision recorded as CR | Gate | warning | trade | PDR | arch |  |  | se-trade | se-trade |  | se-trade |  |  |
| UC-01 | UC has requirements | Gate | warning | kern | SRR | uc |  |  | se:author-req | se:author-uc | ja | se:author-uc |  |  |
| UC-02 | UC has actor | Gate | warning | kern | SRR | uc |  |  | se:author-uc | se:author-uc |  | se:author-actor se:author-uc | schliesst |  |
| UC-03 | UC has scenario | Gate | warning | kern | SRR | uc |  |  | se:author-uc | se:author-uc |  | se:author-uc |  |  |
| UC-04 | UC has goal | Gate | warning | kern | SRR | uc |  |  | se:author-uc | se:author-uc |  |  |  |  |
| VR-01 | TestNoResult | Gate | info | realisierung | TRR | ver |  |  |  | se-test |  |  |  |  |
