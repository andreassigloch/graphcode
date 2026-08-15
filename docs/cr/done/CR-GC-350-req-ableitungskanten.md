# CR-GC-350 — Die elternlosen REQ an ihre Ableitung hängen

**Status:** done · **Angelegt:** 2026-08-15 · **Abgeschlossen:** 2026-08-15 · **Max Files:** 6
(dieser CR: **1 Datei, 64 Gate-Mutationen in 4 Batches**)
**Ziel:** 0 REQ ohne `compose`-Elternteil — die Ableitungskette des eigenen Modells ist nach oben
geschlossen.
**Herkunft:** CR-GC-342 §2.2 + §6 (Block 3 des dort empfohlenen Schnitts). CR-GC-342 ist mit Block 1
geschlossen; dies ist der ausgeschnittene Rest.

---

## 1. Problem

Gemessen nach CR-GC-342 (2026-08-15): **75 von 123 REQ** haben keinen `compose`-Elternteil — weder
UC noch SYS. *(Beim Bau nachgemessen: **64**. CR-GC-345 hatte die Differenz schon geschlossen; die 75
sind der Stand bei Anlage des CR, nicht bei Beginn der Arbeit.)* Sie hängen ausschließlich von unten dran (`verify` ← TEST, `satisfy` ← FUNC/FCHAIN/MOD,
`relation` ← CR).

Die Verifikationsseite trägt sauber (0 von 123 REQ ohne verify-TEST, R-01 hält). Die
**Ableitungsseite** trägt nicht. `06-claims.md` behauptet „Traceability is guaranteed by the same
graph rules" — für 61 % der Anforderungen ist die Kette nach oben offen, und **keine Regel feuert
darauf**. Genau der Fall aus `docs/MESSGROESSEN.md`: *Regeln sehen keine Abwesenheit.*

---

## 2. Umfang

Je REQ die zutreffende Ableitung setzen, durchs Gate (`graph_mutate` → `graph_export`):

- `UC compose REQ` wo ein Use Case sie fordert,
- `SYS compose REQ` wo es eine echte Systemanforderung ohne Use Case ist.

`SYS compose REQ` ist ein legales TRACE_PATTERN und kein Notausgang — aber es muss die **Wahrheit**
sein, nicht die bequeme Kante. Eine falsche `SYS`-Kante ist schlimmer als eine fehlende, weil sie die
Lücke unsichtbar macht.

**Nicht mit einer Heuristik durchschieben.** Der Aufwand ist ~75 Fachurteile, nicht 75 Edits. Das ist
der Grund, warum dieser Block einen eigenen Lauf bekommt.

**Reihenfolge-Falle:** `delete`+`add` derselben uid im **selben** Batch ist verboten — `persist`
schreibt Deletes zuletzt, das divergiert den Store. Nur `add-edge`, keine Umhänge-Batches.

---

## 2a. Die getroffenen Fachurteile (64)

Leitfrage je REQ: **welcher Use Case fordert sie** — und wenn keiner, ist es wirklich eine
Systemanforderung? Die Ableitung folgt dem `satisfy`-Pfad nach oben (REQ ← FUNC/FCHAIN ← UC), aber
sie *entscheidet* ihn nicht: wo der Pfad mehrdeutig war (bis zu vier UC über `FUNC-mutate`), zählt
die Aussage der REQ, nicht die Topologie.

| Elternteil | n | Was dort landet |
|---|---|---|
| `UC-code-quality` | 25 | Alles, was den **einen Gate-Pfad** ausmacht: Apply-Gate + Capture + Codec-Roundtrip + Interface-Eskalation (Pre/Post), `REQ-one-gate-per-repo`, `REQ-rule-enforcement`, `REQ-confidence-tier`, `REQ-mcp-gate-symmetry`, `REQ-audit-trail`, die Trajectory-Emission — und die Import-Trias, weil „Erstbefüllung **ausschliesslich** über `mutate()`, kein Direct-Write" wörtlich die UC-Aussage ist |
| `UC-reduced-llm` | 9 | Agent-Query + modelfree-Gate (Pre/Post), `REQ-query-precision` (R6/R12, Anti-grep), `REQ-progressive-expansion` (R13), `REQ-subgraph-slicing` (`pruneToFit(maxTokens)` = Token-Budget des kleinen Modells), `REQ-cache-layering`, `REQ-advisory-roundtrip-latency` |
| `UC-graph-time-travel` | 4 | Die Merge-Familie: `REQ-pre/post-merge-nodes`, `REQ-conflict-free-merge`, `REQ-auto-persist-merge` — Branch-/Multi-Dev-Merge des **committeten** Artefakts ist genau „Modell und Code passen zu jedem Zeitpunkt zusammen" |
| `UC-efficient-testing` | 3 | `REQ-pre/post-impact-testing`, `REQ-graph-tests-operational` |
| `UC-live-graph-view` | 2 | `REQ-pre/post-emit-update-event` |
| `SYS-graphcode` | 21 | Was **kein** Use Case fordert: Distribution/Installation (8, inkl. `REQ-pre/post-harness-cli`), `REQ-mcp-tool-registry` (der verriegelte Transport), das Hook-/Cache-Subsystem (4), der Doku-Export (3), `REQ-responsiveness` (familienbindende NFR), `REQ-batch-seed-performance`, die Schema-Migration (3) |

**Zwei Urteile, die anders ausfielen als die Topologie nahelegte:**

- **Import → `UC-code-quality`, nicht `UC-graph-time-travel`.** Der Restore-Gedanke lag nahe, aber
  `REQ-post-import` sagt „Graph durchs Gate befüllt; kein Direct-Write" — das ist die
  Gate-Anforderung, nicht die Wiederherstellungs-Anforderung.
- **`REQ-responsiveness` → SYS, obwohl `FCHAIN-apply-gate` sie erfüllt.** Sie ist als
  familienbindende NFR formuliert (§6b) und gilt für die erste Reaktion überhaupt; sie an
  `UC-code-quality` zu hängen hätte sie auf einen Ablauf verengt.

**Nebenbefund, nicht behoben (out of scope):** `FCHAIN-doc-export` ist die einzige FCHAIN **ohne**
UC-Elternteil. Deshalb landeten die drei Export-REQ bei SYS. Ob der Doku-Export einen eigenen Use
Case verdient oder dauerhaft Systemfunktion bleibt, ist eine Modell-Entscheidung — kein Kantenzug.

---

## 3. Akzeptanzkriterien

- [x] **0** REQ ohne `compose`-Elternteil (UC oder SYS) — nachgezählt am exportierten SSOT:
      `REQ total 123 | ohne compose-Parent 0`. Sichtbarer Beleg: die RTM hat die Gruppe
      **„ohne Anker (unassigned)" verloren**, alle 123 REQ stehen jetzt unter einer Ebene.
- [x] Weiterhin **0** REQ ohne `verify`-TEST — R-01 ist nicht gekippt.
- [x] Jede Änderung ging durchs Gate (`graph_mutate`, 4 Batches, je `tier: auto-apply`,
      `violations: []`, OCC-`baseVersion` 93→97); `graph_export` danach gelaufen.
- [x] `npm run build` grün · `npm test`: **719/720**. Der eine Fehlschlag
      (`tests/audit.trail-projection.test.ts`) ist **vorbestehend und fremd** — CR-GC-346 §3 F3.

**Stolperstein, der eintrat (bekannt aus dem Gedächtnis, hier bestätigt):** der laufende MCP-Server
rendert die Views mit dem Code **von seinem Boot**. Sein `graph_export` hat die frisch gebaute
R-22-Fehlmarkierung aus CR-GC-353 in `docs/views/architecture.md` still zurückgesetzt. Fix wie
gehabt: danach `node scripts/export-graph.mjs` gegen das aktuelle `dist`.

---

## 4. Betroffene Dateien (1)

| Datei | Änderung |
|---|---|
| `docs/graph/graphcode.graph.json` | **erzeugt** durch `graph_export` nach den Gate-Mutationen — nie direkt editiert |

`docs/views/*.md` ziehen als generierte Artefakte automatisch nach.

---

## 5. Der eigentliche Root Cause gehört woanders hin

Die fehlende **Layer-Presence-Regel** („eine REQ ohne `compose`-Elternteil ist nicht abgeleitet")
verhindert den Rückfall; dieser CR repariert nur die Daten. Eine neue Regel ist Familie-Review +
Version-Bump in `@sigloch/contracts/se` (Drift-Lock L1/L2) — kein lokaler Regel-Parser, kein Fork,
also ein **CR-SM-xxx** in `sigloch-modules`. Ohne sie wächst der Befund wieder nach.

@author andreas@siglochconsulting
