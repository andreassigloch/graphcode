# CR-GC-342 — Das eigene Modell reparieren: die Ableitungskette der Anforderungen

**Status:** done (Block 1) · **Abgeschlossen:** 2026-08-15 · **Angelegt:** 2026-08-15 · **Max Files:** 6 (dieser CR: **2 Dateien, aber
~70 Gate-Mutationen — s. §6 zur Schnittfrage**)
**Ziel:** graphcode's eigenes Modell erfüllt die Ableitungs- und Stilregeln, die graphcode
Kunden auferlegt.
**Herkunft:** Claim-Audit 2026-08-15, gemessen auf `docs/graph/graphcode.graph.json`
(497 Elemente / 1041 Traces).

---

## 1. Problem

Beim Aufbau des eigenen Modells sind wir gegen die eigenen Vorsätze gelaufen. Vier Befunde,
alle nachgemessen.

### 1.1 Das Modell ist invers zu dem populiert, was wir verteidigen wollen

| UC | REQ | davon mit verify-TEST | FCHAIN | FUNC unter FCHAIN |
|---|---|---|---|---|
| UC-live-graph-view | 11 | 11 | 1 | 5 |
| UC-code-quality | 5 | 5 | 4 | 10 |
| UC-graph-time-travel | 2 | 2 | 2 | 5 |
| UC-efficient-testing | 2 | 2 | 1 | 1 |
| **UC-deterministic-steering** | **1** | 1 | 1 | 6 |
| **UC-reduced-llm** | **1** | 1 | 3 | 8 |

Die beiden UCs, die die **publizierten** Claims tragen — deterministische Steuerung
(`07-the-scoring-landscape.md`, der längste Artikel) und „going local" (`06-claims.md`, der
zentrale Beweis) — haben **je eine** Anforderung. Die interne Viewer-Anbindung hat elf.

Konsequenz: Claim b) und c) lassen sich heute nicht auf Anforderungen zurückführen, also auch nicht
auf verifizierende Tests. Sie sind **per Konstruktion nicht verteidigbar** — unabhängig davon, wie
gut die Implementierung ist.

### 1.2 64 von 113 REQ haben keinen `compose`-Elternteil

Weder UC noch SYS. Sie hängen ausschließlich von unten dran:

```
eingehende Kanten der 64 elternlosen REQ:
  verify  ← TEST    72
  relation← CR      53
  satisfy ← FUNC    47
  satisfy ← FCHAIN  20
  satisfy ← MOD      5
```

Beispiele: `REQ-advisory-roundtrip-latency`, `REQ-audit-trail`, `REQ-auto-persist-merge`,
`REQ-batch-seed-performance`, `REQ-bootstrap-through-gate`, `REQ-cache-layering`,
`REQ-codec-validation`, `REQ-confidence-tier`.

[`06-claims.md:126`](../../articles/06-claims.md) behauptet: „Traceability is guaranteed by the same
graph rules." Im eigenen Graphen ist die Ableitungskette bei **57 %** der Anforderungen nach oben
offen. Keine Regel feuert darauf — genau der Fall, den
[`docs/MESSGROESSEN.md`](../../MESSGROESSEN.md) benennt: **„Regeln sehen keine Abwesenheit."**
Hier fehlt die Layer-Presence-Frage, nicht die Regel.

**Positiv:** `0 von 113` REQ ohne verify-TEST. R-01 hält sauber. Die Verifikationsseite trägt, die
Ableitungsseite nicht.

### 1.3 Zwei UC-Beschreibungen verletzen `se:author-uc`

`se:author-uc` verlangt: Actor–Verb–Objekt–Ergebnis, ≤ 25 Wörter, ≤ 2 geerdete Fachbegriffe.

**UC-live-graph-view** (~40 Wörter, kein Actor, 5+ interne Begriffe):

> „Read-only Live-Dashboard: jede Mutation aktualisiert die Ansicht ohne Reload (SSE invalidate),
> Readiness/INCOSE-Gates gegen contracts V3_RULES (nicht BQ-2.0.0). Über den Host
> (Single-Kuzu-Owner), kein 2. DB-Handle."

Dazu der Name: „Live-Graph-View (**Ziel b**)" — interne Referenz im Namen.

**UC-graph-time-travel** trägt CR-IDs in der Beschreibung („CR-GC-217 Approach A, Operation
CR-GC-311") und ist der **einzige** UC ohne `SYS compose` und ohne MS-Zuordnung — er steht außerhalb
des Plans.

### 1.4 Ein Test nennt einen UC, den es nicht gibt

Der Kopf von [`tests/mvp-e2e.test.ts`](../../../tests/mvp-e2e.test.ts) weist `UC-token-efficiency`
als validierten Use Case aus (Schritte 4 und 5). Im Graphen existieren nur sechs UCs, dieser ist
nicht darunter. Ein E2E-Test, der eine nicht existierende Abnahme behauptet.

---

## 2. Lösung

**Alles über das Gate.** Kein Hand-Edit an `docs/graph/graphcode.graph.json` — der Deny-Hook
`.claude/hooks/deny-graph-write.sh` blockt das ohnehin. Ablauf je Schritt: `graph_mutate` →
`graph_export`.

### 2.1 Die Claim-tragenden UCs bekommen ihre Anforderungen

Unter **UC-deterministic-steering**, je REQ zusammen mit einem `verify`-TEST im selben Batch (R-01):

| REQ (Inhalt) | verifiziert durch |
|---|---|
| Der Fokus folgt der schwächsten anwendbaren Dimension | T-B1 (CR-GC-341) |
| Ein Phasen-Gate ist nicht überspringbar, auch bei erreichter Schwelle | T-B2 (existiert: `generate.test.ts:228`) |
| Wiederholte Steuerung konvergiert monoton in den Handoff | T-B3 (CR-GC-341) |
| Eine Änderung der Zielrichtung verschiebt das Suggestion-Ranking | T-C1 (CR-GC-340) |
| Eine angewandte Suggestion bewegt ℝ⁶ in die Zielrichtung | T-C2 (CR-GC-340) |
| Urteilsschwellen kommen aus der Config, nicht aus dem Regelcode | T-C3 (CR-GC-340) |

Unter **UC-reduced-llm**: mindestens die zwei Claims, die `06-claims.md` nach der Korrektur durch
CR-GC-339 noch trägt — „derselbe Treiber fährt local und frontier ohne Code-Verzweigung" und
„präziser Graph-Kontext ersetzt Dokumentenlesen".

Das ist **T-D2** aus dem Testkonzept (CR-GC-340 §2): *jeder publizierte Claim braucht einen
UC/REQ im Graphen, sonst ist er nicht verteidigbar.* Die Tests dafür entstehen ohnehin in
CR-GC-340/341 — die Anforderungen zu schreiben kostet fast nichts mehr.

### 2.2 Die 64 elternlosen REQ anhängen

Je REQ die zutreffende Ableitung setzen: `UC compose REQ` wo ein Use Case sie fordert,
`SYS compose REQ` wo es eine echte Systemanforderung ohne UC ist (das ist ein legales
TRACE_PATTERN, kein Notausgang — aber es muss die Wahrheit sein, nicht die bequeme Kante).

Kandidaten für `SYS`: `REQ-advisory-roundtrip-latency`, `REQ-batch-seed-performance`,
`REQ-cache-layering` (Querschnitt/NFR). Kandidaten für einen UC: `REQ-bootstrap-through-gate`,
`REQ-codec-validation`, `REQ-audit-trail` (gehören unter UC-code-quality).

**Reihenfolge-Falle:** delete+add derselben uid im **selben** Batch ist verboten — `persist`
schreibt Deletes zuletzt, das divergiert den Store. Nur `add-edge`, keine Umhänge-Batches.

### 2.3 UC-Beschreibungen auf `se:author-uc` ziehen

`UC-live-graph-view` und `UC-graph-time-travel` neu formulieren: Actor–Verb–Objekt–Ergebnis,
≤ 25 Wörter, ohne CR-IDs, ohne „Ziel b", ohne `BQ-2.0.0`/`SSE invalidate`/`Single-Kuzu-Owner`.
Der technische Inhalt gehört in die REQs darunter, nicht in den Use Case.
`UC-graph-time-travel` zusätzlich an `SYS compose` und an einen Milestone hängen.

### 2.4 `mvp-e2e.test.ts` korrigieren

Kopf-Kommentar auf die tatsächlich existierenden UCs ziehen — oder `UC-token-efficiency` anlegen,
wenn er fachlich fehlt. Nicht beides offen lassen.

---

## 3. Nicht in diesem CR: die fehlende Regel

Der eigentliche Root Cause von §1.2 ist eine **fehlende Layer-Presence-Regel**: „eine REQ ohne
`compose`-Elternteil ist nicht abgeleitet." Dieselbe Kategorie wie R-28 (Flow + Datenvertrag in
einer Prüfung), mit dem `07-the-scoring-landscape.md` bereits argumentiert.

Eine neue Regel ist **Familie-Review + Version-Bump in `@sigloch/contracts/se`** (Drift-Lock L1/L2)
— kein lokaler Regel-Parser, kein Fork. Gehört als **CR-SM-xxx** nach `sigloch-modules`. Dieser CR
repariert die Daten; die Regel verhindert den Rückfall. Ohne sie wächst der Befund wieder nach.

---

## 4. Akzeptanzkriterien

- [ ] `UC-deterministic-steering` trägt ≥ 6 REQ, jede mit `verify`-TEST.
- [ ] `UC-reduced-llm` trägt ≥ 2 REQ, jede mit `verify`-TEST.
- [ ] **0** REQ ohne `compose`-Elternteil (UC oder SYS). Nachweis: die Zählung aus §1.2 reproduzieren,
      Ergebnis 0/113 (bzw. 0/N nach den neuen REQs).
- [ ] Weiterhin 0 REQ ohne `verify`-TEST — R-01 darf nicht kippen.
- [ ] `UC-live-graph-view` und `UC-graph-time-travel` erfüllen `se:author-uc`
      (≤ 25 Wörter, Actor–Verb–Objekt–Ergebnis, keine CR-IDs, keine internen Kürzel).
- [ ] `UC-graph-time-travel` hat `SYS compose` und eine MS-Zuordnung.
- [ ] `mvp-e2e.test.ts` nennt nur existierende UCs.
- [ ] Jede Änderung ging durchs Gate (`graph_mutate`), kein Hand-Edit am SSOT; `graph_export`
      danach gelaufen.
- [ ] `npm run build` + `npm test` grün.

---

## 5. Betroffene Dateien (2)

| Datei | Änderung |
|---|---|
| `docs/graph/graphcode.graph.json` | **erzeugt** durch `graph_export` nach den Gate-Mutationen — nie direkt editiert |
| `tests/mvp-e2e.test.ts` | Kopf-Kommentar auf existierende UCs |

`docs/views/*.md` ziehen als generierte Artefakte automatisch nach und zählen nicht als
Hand-Änderung.

---

## 6. Schnittfrage (vor dem Start entscheiden)

Zwei Dateien, aber ~70 Gate-Mutationen in drei fachlich unterschiedlichen Blöcken. Die 6-Dateien-Regel
greift hier nicht als Schutz — das Risiko ist die **Menge der Einzelentscheidungen**, nicht die Dateizahl.
64 REQ die richtige Ableitung zuzuordnen ist Fachurteil, nicht Mechanik.

Empfohlener Schnitt in drei Läufe, in dieser Reihenfolge:

1. **§2.1** — die Claim-tragenden REQs (~8 REQ + 8 TEST). Blockiert CR-GC-339's Publikation nicht,
   aber macht sie erst verteidigbar.
2. **§2.3 + §2.4** — UC-Stil und der Test-Kopf. Klein, sofort erledigt.
3. **§2.2** — die 64 Ableitungen. Der große Block; braucht einen eigenen Chat und pro REQ eine
   bewusste Entscheidung UC vs. SYS. **Nicht** mit einer Heuristik durchschieben — eine falsche
   `SYS compose`-Kante ist schlimmer als eine fehlende, weil sie die Lücke unsichtbar macht.

Wenn drei Läufe: dieser CR bleibt der Kopf, die Blöcke 2 und 3 werden Folge-CRs, dieser wird
geschlossen wenn Block 1 steht.

## 7. Selbstkritik, die hier hingehört

Der Befund ist nicht „ein paar Kanten fehlen". Wir haben das eigene Modell dort dicht gebaut, wo wir
implementiert haben (Viewer: 11 REQ), und dort dünn gelassen, wo wir argumentieren
(Steuerung: 1 REQ) — also genau umgekehrt zu dem, was `se:author-req` und die
REQ-mit-Test-Invariante bezwecken. Die Regeln haben das nicht verhindert, weil keine Regel
Abwesenheit sieht. Das ist kein Werkzeugfehler, sondern die Bestätigung des Satzes aus
MESSGROESSEN — und der Grund, warum §3 (die Regel) wichtiger ist als §2 (die Daten).

@author andreas@siglochconsulting

---

## 8. Abschluss 2026-08-15 — was wirklich drin ist

Geschlossen nach dem Schnitt aus §6: **Block 1 (§2.1) + §2.3 + §2.4**, alles durchs Gate
(`graph_mutate` → `graph_export`), kein Hand-Edit am SSOT.

| Kriterium | Stand |
|---|---|
| `UC-deterministic-steering` ≥ 6 REQ, je mit verify-TEST | **7** ✅ |
| `UC-reduced-llm` ≥ 2 REQ, je mit verify-TEST | **3** ✅ |
| Weiterhin 0 REQ ohne verify-TEST | **0 von 123** ✅ |
| `UC-live-graph-view` / `UC-graph-time-travel` auf `se:author-uc` | ✅ (Actor–Verb–Objekt–Ergebnis, ≤ 25 Wörter, keine CR-IDs, keine internen Kürzel) |
| `UC-graph-time-travel` mit `SYS compose` + Milestone | ✅ (`SYS-graphcode`, `MS-6-adoption`) |
| `mvp-e2e.test.ts` nennt nur existierende UCs | ✅ (`UC-token-efficiency` entfernt) |

Zusätzlich, weil der Nutzen fast null kostete: **`UC-code-quality`** hat zwei weitere REQ mit Test
bekommen (`REQ-published-counts-match-code`, `REQ-single-write-door`) — die beiden Zusagen, die
CR-GC-339/340/341 neu erzwingen. Und die fünf CRs dieses Satzes stehen als CR-Knoten im Graphen,
mit `commitRef`, `relation`→REQ, `relation`→FUNC und Milestone-Zuordnung.

**Nicht drin, bewusst:** §2.2 — die Ableitungskanten der elternlosen REQ (Messung nach diesem CR:
**75 von 123**). Das ist der Block, den §6 ausdrücklich in einen eigenen Lauf schneidet: pro REQ eine
bewusste Entscheidung UC vs. SYS, keine Heuristik. → **CR-GC-350**.
