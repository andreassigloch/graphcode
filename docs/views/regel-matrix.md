# Regel-Matrix

> GENERIERT von `scripts/regel-matrix.mjs` aus contracts, graph-api-core, se-engine und graphcode — nicht von Hand bearbeiten.
> 78 Regeln · 61 im Gate-Katalog · 5 blocken (Schwere error) · 11 Existenz-Regeln · 6 Analysen · 9 abnehmbar · 3 Prompt/Skill-Konflikte (Ausnahmen in tests/skill-rule-ids.test.ts).
> Fix-Vorlagen: 18 Regeln tragen eine · 17 schliessen den Fund · 1 Teil-Fix · 0 tot (CR-SM-357).

## Stufen und Marken

> Fällig ist eine Regel, sobald ihre Menge nicht leer ist (Stufen 11 und 12: sobald es einen offenen Auftrag oder eine Bindung gibt). Eine Marke liegt hinter ihrer Stufe und ist erreicht, wenn kein Befund sie hält — gerechnet in `@sigloch/graphcode-client` (`computeMarks`).

| Stufe | Menge | Existenz-Regeln | Marke danach | Regeln |
|---|---|---|---|---:|
| immer | (alle Elemente) |  |  | 3 |
| 1 | System | R-33 |  | 1 |
| 2 | Anwendungsfall | R-17, UC-02 |  | 6 |
| 3 | Anforderung | UC-01 |  | 11 |
| 4 | Wirkkette | UC-03 | SRR | 1 |
| 5 | Funktion | R-15 |  | 9 |
| 6 | Datenfluss | R-31 |  | 5 |
| 7 | Modul | R-22 | PDR | 13 |
| 8 | Schema |  | CDR | 3 |
| 9 | Test | R-01, R-32 | TRR | 5 |
| 10 | Plan | AF-05 |  | 8 |
| 11 | Bindung |  |  | 5 |
| 12 | Abgleich |  | Bau | 8 |

## Tasks

> Seit contracts 11 nimmt nur noch die Textqualität der Anforderungen dem Kern Regeln ab. Eine Analyse hat einen Eintrittspunkt; ihre übrigen Regeln führt der Kern, und der Schritt nennt an ihnen den Skill der Analyse.

| Task | Regeln | Eintrittspunkt im Kern | Skill |
|---|---:|---|---|
| kern | 73 | — | — |
| conops | 0 | AF-01 | se-conops |
| trade | 0 | AF-02 | se-trade |
| irr | 0 | AF-03 | se-irr |
| fmea | 0 | AF-04 | se-fmea |
| plan | 0 | AF-05 | se-plan |
| anforderungsqualitaet | 5 | ausdruecklich | se:author-req |

## Erfueller × kinds

> `X -satisfy-> REQ` ist legal (✓), wenn die REQ genau diese kinds traegt — gefragt bei `isValidTrace` (R-18). Smeagol prueft die in Skills und Prompts genannten Werte dagegen (tests/skill-kinds-werte.test.ts).

| kinds | FUNC | FCHAIN | MOD | SYS |
|---|:---:|:---:|:---:|:---:|
| functional | ✓ |  |  |  |
| non-functional |  | ✓ | ✓ | ✓ |
| (ohne kinds) |  |  |  |  |

## Alle Regeln

| Regel | Name | Stufe | Rolle | Marke | Schwere | Bedarf | Task | Dimension | Steuerregel | abnehmbar | Hilfe-Prompt | Vorschlag | Skill | Konflikt | nennt | Fix | Folge-Regeln |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CR-R03 | No concurrent mutation | immer |  | – | warning | Gate | kern | cr |  |  |  | Kläre, welcher der offenen Änderungsaufträge an {n} zuerst ändert. |  |  |  |  |  |
| R-08 | Trace consistency | immer |  | – | error | Gate | kern | arch |  |  |  | Repariere oder entferne die Verbindungen an {n}, deren Ziel fehlt. | se:top-level |  |  |  |  |
| R-18 | Valid trace pattern | immer |  | – | error | Gate | kern | arch |  |  |  | Korrigiere die unzulässigen Verbindungen an {n}. | se:top-level |  | se:author-actor se:author-req se:import-doc se-fmea se-plan se-view:fmea | schliesst |  |
| R-33 | Graph must have a SYS | 1 System | existence | SRR | warning | Gate | kern | uc |  |  |  | Lege zuerst das System an und benenne, was gebaut wird. | se:author-uc |  |  |  |  |
| R-17 | SYS must have a use case | 2 Anwendungsfall | existence | SRR | warning | Gate | kern | uc |  |  |  | Lege die Abläufe des Systems {n} an. | se:author-uc |  | se:top-level |  |  |
| UC-02 | UC has actor | 2 Anwendungsfall | existence | SRR | warning | Gate | kern | uc |  |  |  | Lege für die Abläufe {n} die Funktionen an, die der Nutzer über einen Datenfluss auslöst. | se:author-uc |  | se:author-actor se:author-uc | schliesst |  |
| CL-01 | ConopsCompleteness | 2 Anwendungsfall |  | SRR | warning | Gate | kern | uc |  | ja — Ein Akteur, der das System in nur einer Betriebsart nutzt, ist ein gueltiger Befund des Einsatzkonzepts — ob eine zweite fehlt, entscheidet der Auftraggeber. | se-conops | Ordne den Akteuren {n} Abläufe in mindestens zwei Betriebsarten zu. | se-conops |  |  |  |  |
| FC-02 | Leaf UC has FCHAIN | 2 Anwendungsfall |  | SRR | warning | Gate | kern | uc |  |  | se:author-uc | Beschreibe die Abläufe {n} als Kette von Funktionen. | se:author-uc |  | se:author-uc se-fmea |  |  |
| R-16 | ACTOR must have io | 2 Anwendungsfall |  | SRR | warning | Gate | kern | uc |  |  |  | Verbinde den Nutzer {n} über Datenflüsse mit den Funktionen. | se:author-uc |  | se:author-actor |  |  |
| UC-04 | UC has goal | 2 Anwendungsfall |  | SRR | warning | Gate | kern | uc |  |  | se:author-uc | Beschreibe das Ziel der Abläufe {n}. | se:author-uc |  |  |  |  |
| UC-01 | UC has requirements | 3 Anforderung | existence | SRR | warning | Gate | kern | uc |  |  | se:author-req | Lege für die Abläufe {n} Anforderungen mit Test an: fachliche je Funktion, Ende-zu-Ende-Vorgaben an der Kette. | se:author-uc | ja | se:author-uc |  |  |
| AF-01 | ConOps freshness stamp present | 3 Anforderung | analysis | SRR | warning | Gate | kern, Eintritt fuer conops | req |  | ja (Analyse) | se-conops |  | se-conops |  | se-conops se-irr |  |  |
| BQ-01 | Unambiguous | 3 Anforderung |  | SRR | warning | nur Steuerung | anforderungsqualitaet | req |  |  | se:author-req |  | se:author-req |  |  |  |  |
| BQ-02 | Verifiable | 3 Anforderung |  | SRR | warning | nur Steuerung | anforderungsqualitaet | req |  |  | se:author-req |  | se:author-req |  |  |  |  |
| BQ-04 | Necessary | 3 Anforderung |  | SRR | warning | nur Steuerung | anforderungsqualitaet | req |  |  |  |  | se:author-req |  |  |  |  |
| BQ-06 | Conforming | 3 Anforderung |  | SRR | warning | nur Steuerung | anforderungsqualitaet | req |  |  | se:author-req |  | se:author-req |  |  |  |  |
| BQ-07 | Complete | 3 Anforderung |  | SRR | warning | nur Steuerung | anforderungsqualitaet | req |  |  | se:author-req |  | se:author-req |  |  |  |  |
| FM-01 | RiskReqFmeaAttributes | 3 Anforderung |  | SRR | warning | Gate | kern | req |  |  | se-fmea | Bewerte die Risiken {n} nach Schwere, Auftreten und Entdeckung. | se-fmea |  | se-fmea |  |  |
| FM-02 | RiskReqMitigation | 3 Anforderung |  | SRR | warning | Gate | kern | req |  |  | se-fmea | Gib den Risiken {n} eine Gegenmaßnahme. | se-fmea |  | se-fmea se-view:fmea |  |  |
| RD-01 | Unresolved requirement | 3 Anforderung |  | SRR | warning | Gate | kern | req |  |  | se:close-violations | Lege an, was die Anforderungen {n} erfüllt. | se:author-req | ja | se:author-req se-plan se-umbau | schliesst |  |
| RD-02 | Decomposition consistency | 3 Anforderung |  | SRR | warning | Gate | kern | req |  |  |  | Lass die Anforderungen {n} nur über ihre Teilanforderungen erfüllen. | se:author-req |  |  |  |  |
| UC-03 | UC has scenario | 4 Wirkkette | existence | SRR | warning | Gate | kern | uc |  |  | se:author-uc | Beschreibe die Abläufe {n} als Kette von Funktionen. | se:author-uc |  | se:author-uc |  |  |
| R-15 | FCHAIN completeness | 5 Funktion | existence | PDR | warning | Gate | kern | uc |  |  |  | Gib den Funktionsketten {n} ihre Funktionen und ordne sie ihrem Ablauf zu. | se:author-uc |  |  |  |  |
| BW-02 | Whitebox boundary width | 5 Funktion |  | PDR | warning | Gate | kern | arch | ja |  |  | Bündle die Datenformate an der Grenze von {n} oder teile den Block. | se:top-level |  |  | schliesst |  |
| FC-03 | FCHAIN is flat | 5 Funktion |  | PDR | warning | Gate | kern | uc |  |  |  | Hebe die inneren Schritte der Funktionen {n} auf die Ebene ihrer Kette. | se:author-uc |  | se-fmea |  |  |
| IO-01 | FuncPairIOCompleteness | 5 Funktion |  | PDR | warning | Gate | kern | arch |  |  |  | Ergänze den Datenfluss zwischen den Schritten {n}. | se:top-level |  | se:top-level | schliesst |  |
| MT-04 | Whitebox cohesion (LCOM4) | 5 Funktion |  | PDR | info | Gate | kern | arch |  |  |  |  | se:top-level |  |  |  |  |
| ND-01 | FuncNearDuplicate | 5 Funktion |  | PDR | warning | Aehnlichkeit (ND) | kern | arch |  |  |  | Führe die doppelten Funktionen {n} zusammen oder grenze sie ab. | se:top-level |  |  |  |  |
| R-02 | FUNC must satisfy REQ | 5 Funktion |  | PDR | warning | Gate | kern | arch |  |  |  | Ordne die Funktionen {n} den Anforderungen zu, die sie erfüllen. | se:top-level |  | se-fmea | schliesst |  |
| R-12 | No circular dependencies | 5 Funktion |  | PDR | warning | Gate | kern | arch |  |  |  | Löse die zyklische Abhängigkeit um {n} auf. | se:top-level |  |  |  |  |
| R-30 | FUNC leaf must belong to a function chain | 5 Funktion |  | PDR | warning | Gate | kern | arch |  |  |  | Ordne die Funktionen {n} der Kette ihres Ablaufs zu. | se:top-level |  | se:top-level | schliesst |  |
| R-31 | FUNC must be wired (io input + output) | 6 Datenfluss | existence | PDR | warning | Gate | kern | arch |  |  |  | Verbinde die Funktionen {n} auf der fehlenden Seite mit einem Datenfluss. | se:top-level |  |  | Teil-Fix |  |
| FC-04 | FCHAIN actor-bounded (trigger+consumer) | 6 Datenfluss |  | PDR | warning | Gate | kern | uc |  |  |  | Verbinde Anfang und Ende der Funktionsketten {n} mit dem Nutzer. | se:author-uc |  | se:author-actor se-fmea |  |  |
| FC-05 | FCHAIN is connected (producer -> consumer) | 6 Datenfluss |  | PDR | warning | Gate | kern | uc |  |  |  | Verbinde die Schritte der Funktionsketten {n} über Datenflüsse. | se:author-uc |  |  |  |  |
| IO-02 | FLOW single producer | 6 Datenfluss |  | PDR | error | Gate | kern | arch |  |  |  | Gib jeder Quelle der Datenflüsse {n} einen eigenen Datenfluss. | se:top-level |  |  |  |  |
| R-10 | FLOW completeness | 6 Datenfluss |  | PDR | warning | Gate | kern | arch |  |  |  | Vervollständige die Datenflüsse {n}: woher sie kommen und wohin sie gehen. | se:top-level |  |  |  |  |
| R-22 | FUNC must be allocated to MOD | 7 Modul | existence | PDR | warning | Gate | kern | alloc |  |  |  | Ordne die Funktionen {n} Modulen zu. | se:top-level |  | se:top-level | schliesst | RD-05 |
| AF-02 | Trade Study freshness stamp present | 7 Modul | analysis | PDR | warning | Gate | kern, Eintritt fuer trade | arch |  | ja (Analyse) | se-trade |  | se-trade |  | se-trade |  |  |
| AF-03 | Assumption Review freshness stamp present | 7 Modul | analysis | PDR | warning | Gate | kern, Eintritt fuer irr | req |  | ja (Analyse) | se-irr |  | se-irr |  |  |  |  |
| CR-01 | CrossingFlowCount | 7 Modul |  | PDR | warning | Gate | kern | arch | ja |  |  | Prüfe den Schnitt zwischen {n}, dort fließen ungewöhnlich viele Daten. | se:top-level |  | se:top-level | schliesst |  |
| IR-01 | Assumption review requirements exist | 7 Modul | analysis | PDR | warning | Gate | kern | req |  | ja (Analyse) | se-irr | Lege die Anforderungen an, die das Annahmen-Review für {n} nennt. | se-irr |  | se-irr |  |  |
| MT-01 | Module instability | 7 Modul |  | PDR | warning | Gate | kern | alloc |  |  |  | Prüfe die Abhängigkeiten des Moduls {n}. | se:top-level |  |  |  |  |
| MT-02 | Module cohesion (LCOM4) | 7 Modul |  | PDR | warning | Gate | kern | alloc | ja |  |  | Teile das Modul {n}, seine Teile arbeiten nicht zusammen. | se:top-level |  | se:top-level |  |  |
| NFR-01 | BudgetOvershoot | 7 Modul |  | PDR | warning | Gate | kern | arch |  |  |  | Bringe {n} unter sein Budget oder ändere das Budget bewusst. | se:top-level |  |  |  |  |
| R-04 | Module boundary width | 7 Modul |  | PDR | warning | Gate | kern | alloc | ja |  | se-view:arch | Verringere die Datenformate an der Grenze des Moduls {n}. | se:top-level | ja | se:top-level | schliesst |  |
| R-23 | MOD must have allocated FUNC | 7 Modul |  | PDR | warning | Gate | kern | alloc |  |  |  | Gib den Modulen {n} Funktionen oder entferne sie. | se:top-level |  |  | schliesst | RD-05 |
| RD-04 | Decomposition breadth | 7 Modul |  | PDR | warning | Gate | kern | arch | ja |  |  | Gruppiere die Teile unter {n}, es sind zu viele auf einer Ebene. | se:top-level |  | se:top-level | schliesst |  |
| RD-05 | Decomposition too narrow | 7 Modul |  | PDR | warning | Gate | kern | arch |  |  |  | Löse die Ebene {n} in die Ebene darüber auf oder sammle unter ihr, was zusammengehört. | se:top-level |  |  |  |  |
| TR-01 | Trade decision recorded as CR | 7 Modul | analysis | PDR | warning | Gate | kern | arch |  | ja (Analyse) | se-trade | Halte die Entscheidung des Variantenvergleichs für {n} als Änderungsauftrag fest. | se-trade |  | se-trade |  |  |
| AF-04 | FMEA freshness stamp present | 8 Schema | analysis | CDR | warning | Gate | kern, Eintritt fuer fmea | ver |  | ja (Analyse) | se-fmea |  | se-fmea |  | se-fmea se-irr |  |  |
| ND-02 | SchemaNearDuplicate | 8 Schema |  | CDR | warning | Aehnlichkeit (ND) | kern | schema |  |  |  | Führe die doppelten Datenformate {n} zusammen oder grenze sie ab. |  |  |  |  |  |
| SC-02 | Schema referenced by FLOW | 8 Schema |  | CDR | warning | Gate | kern | schema |  |  |  | Verbinde das Datenformat {n} mit seinem Datenfluss oder entferne es. |  |  |  | schliesst |  |
| R-01 | REQ must have verification | 9 Test | existence | TRR | error | Gate | kern | ver |  |  | se:close-violations | Ergänze Tests für die Anforderungen {n}. |  |  | se:author-req se:author-uc se-conops se-fmea se-test-ui se-umbau se-view:fmea |  |  |
| R-32 | SCHEMA must have contract TEST | 9 Test | existence | TRR | warning | Gate | kern | ver |  |  |  | Gib den Datenformaten {n} einen Vertragstest. |  |  |  | schliesst | R-19 |
| FM-03 | HighRiskVerification | 9 Test |  | TRR | warning | Gate | kern | ver |  | ja — Verlangt einen BESTANDENEN Testlauf (`result: passed`); den gibt es erst mit Code, die Regel ist aber faellig, sobald es ein hohes Risiko gibt. | se-fmea | Gib den hohen Risiken {n} einen Test. | se-fmea |  | se-fmea se-plan se-view:fmea |  |  |
| R-05 | TEST must verify REQ | 9 Test |  | TRR | warning | Gate | kern | ver |  |  |  | Ordne die Tests {n} den Anforderungen zu, die sie prüfen. |  |  |  |  |  |
| R-21 | FUNC↔FUNC handover needs a shared chain covered by member REQs or an integration test | 9 Test |  | TRR | warning | Gate | kern | ver |  |  |  | Bringe die Übergaben an {n} in eine Funktionskette, deren Funktionen Anforderungen erfüllen oder die ein Integrationstest prüft. |  |  | se:author-req se:author-uc | schliesst | R-19 |
| AF-05 | Unbuilt elements have an open CR | 10 Plan | existence | Bau | warning | Gate | kern, Eintritt fuer plan | ms |  | ja (Eintritt einer Analyse) | se-plan |  | se-plan |  | se-plan |  |  |
| CR-R01 | CR must track | 10 Plan |  | Bau | warning | Gate | kern | cr |  |  |  | Verbinde die Änderungsaufträge {n} mit dem, was sie ändern. |  |  |  | schliesst |  |
| CR-R02 | Done requires commit | 10 Plan |  | Bau | warning | Gate | kern | cr |  |  |  | Trage bei den erledigten Änderungsaufträgen {n} den Commit nach. |  |  |  |  |  |
| MS-01 | Milestone empty scope | 10 Plan |  | Bau | warning | Gate | kern | ms |  |  |  | Ordne den Meilensteinen {n} ihren Umfang zu. |  |  |  |  |  |
| MS-02 | Milestone dangling dependency | 10 Plan |  | Bau | warning | Gate | kern | ms |  |  |  | Korrigiere die Abhängigkeiten der Meilensteine {n}. |  |  |  |  |  |
| MS-03 | CR without milestone | 10 Plan |  | Bau | info | Gate | kern | ms |  |  | se-plan |  | se-plan |  |  | schliesst |  |
| RC-05 | cross-module import drift | 10 Plan |  | Bau | warning | CodeFacts (RC) | kern |  |  |  |  | Trage die Abhängigkeit der Module {n} ins Modell ein oder entferne den Import. |  |  |  |  |  |
| RC-07 | CR node agrees with docs/cr | 10 Plan |  | Bau | warning | CodeFacts (RC) | kern |  |  |  |  | Gleiche die Änderungsaufträge {n} mit ihren Dateien ab. |  |  |  |  |  |
| R-19 | Runnable TEST binding | 11 Bindung |  | Bau | warning | Gate | kern | ver |  |  |  | Verbinde die Tests {n} mit ihren Testdateien. |  |  | se-irr se-plan se-retro se-test |  |  |
| R-20 | FUNC realRef binding | 11 Bindung |  | Bau | warning | Gate | kern | arch |  |  |  | Verbinde die Funktionen {n} mit ihrem Code. | se:top-level |  | se:import-code se-irr se-plan se-retro |  |  |
| R-26 | SCHEMA must have realRef | 11 Bindung |  | Bau | warning | Gate | kern | schema |  |  |  | Verbinde die Datenformate {n} mit ihrem Schema im Code. |  |  | se-plan |  |  |
| R-29 | Test file exclusivity | 11 Bindung |  | Bau | error | Gate | kern | ver |  |  |  | Gib jede Testdatei von {n} nur einem Test. |  |  | se:author-req |  |  |
| VR-01 | TestNoResult | 11 Bindung |  | Bau | info | Gate | kern | ver |  |  |  |  |  |  |  |  |  |
| RC-01 | FUNC realRef resolves to a declared symbol | 12 Abgleich |  | Bau | warning | CodeFacts (RC) | kern |  |  |  |  | Korrigiere die Code-Verweise der Funktionen {n}, sie zeigen ins Leere. |  |  | se-review se-umbau |  |  |
| RC-02 | testRefs entries resolve to runnable tests | 12 Abgleich |  | Bau | warning | CodeFacts (RC) | kern |  |  |  |  | Korrigiere die Testverweise von {n}, die Testfälle gibt es nicht. |  |  | se-review |  |  |
| RC-03 | SCHEMA realRef resolves to a declared export | 12 Abgleich |  | Bau | warning | CodeFacts (RC) | kern |  |  |  |  | Korrigiere die Code-Verweise der Datenformate {n}, sie zeigen ins Leere. |  |  | se-review |  |  |
| RC-04 | SCHEMA realRef is parsed at its interface | 12 Abgleich |  | Bau | warning | CodeFacts (RC) | kern |  |  |  |  | Lies die Datenformate {n} im Code an der Schnittstelle, an der das Modell sie führt. |  |  |  |  |  |
| RC-06 | external realRef names a declared dependency | 12 Abgleich |  | Bau | warning | CodeFacts (RC) | kern |  |  |  |  | Trage die Pakete, auf die {n} verweisen, als Abhängigkeit ein. |  |  |  |  |  |
| RC-08 | SCHEMA realRef is a Zod schema | 12 Abgleich |  | Bau | warning | CodeFacts (RC) | kern |  |  |  |  | Binde die Datenformate {n} an ein Schema statt an einen Typ. |  |  |  |  |  |
| RC-09 | SCHEMA is parsed only at its modelled interface | 12 Abgleich |  | Bau | warning | CodeFacts (RC) | kern |  |  |  |  | Prüfe, wo die Datenformate {n} außerhalb ihrer Schnittstelle gelesen werden. |  |  |  |  |  |
| RC-10 | MOD has resolvable files | 12 Abgleich |  | Bau | warning | CodeFacts (RC) | kern |  |  |  |  | Gib den Modulen {n} ihren Quellordner. |  |  |  |  |  |
