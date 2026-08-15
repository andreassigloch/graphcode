# CR-GC-354 — Der Trail trägt Urheber und Prompt

**Status:** open · **Angelegt:** 2026-08-15 · **Max Files:** 6 (dieser CR: **5**, **zwei Repos**)
**Vorbedingung:** CR-GC-346 (Use Case + Projektionsfix) — dieser CR erweitert den Record, den 346
projiziert; andersherum kollidiert die Projektionsänderung mit den neuen Feldern.
**Governance:** **kein Drift-Lock** auf `AuditEntry` — Prüfung gegen
`aise-family/DRIFT-LOCKS.md` ergibt keinen Treffer. Additive optionale Felder = **Minor-Bump**
(`@sigloch/graph-api-core` 3.0.0 → 3.1.0), kein Familie-Review.
**Ziel:** der Audit-Trail beantwortet die Grundfrage vollständig — *wer, mit welchem Prompt, zu
welchem Ergebnis*.

---

## 1. Problem — gemessen am echten Trail (2026-08-15, 123 Records, 798,4 KB)

`AuditEntry` ([graph-api-core/dist/audit.d.ts:4](../../../node_modules/@sigloch/graph-api-core/dist/audit.d.ts))
trägt heute: `id, timestamp, consumerId, consumerType, operation, diff, commands, result,
violations, graphVersion, rulesPassed, rulesetVersion`.

Damit ist die Grundanforderung zu **einem Drittel** erfüllt:

| Frage | Stand | Beleg |
|---|---|---|
| **welches Ergebnis** | ✅ vollständig | `result` + `violations` + `commands` + `graphVersion` |
| **wer** | ⚠️ selbstdeklarierter Freitext | 123 Records, >20 Werte; **49 (40 %)** tragen die anonymen Defaults `mcp-client` (31) und `claude-code` (18) |
| **mit welchem Prompt** | ❌ **existiert nirgends** | nicht im Record, nicht in `trajectory.jsonl`, nirgends im Executor |

Die Folge ist bereits eingetreten und steht in CR-GC-346 §1: CR-GC-284 und CR-GC-290 haben
*Prompt-Templates* korrigiert — abgeleitet aus `consumerId`, weil ein Mensch wusste, welches Modell
und welches Template hinter `claude-fable-cr-234` stand. Werkzeuggestützt ist keine dieser Analysen
reproduzierbar, und die Modell-Aufschlüsselung, auf der CR-GC-284 ruht (*„Haiku 26/29, Opus 17/18,
devstral 10/23"*), ist aus dem Record allein nicht herstellbar — **`model` steht nirgends**.

**Die Asymmetrie, die diesen CR jetzt fällig macht.** CR-GC-346 §2.1 hat die Vorhersage-Hälfte mit
dem Argument gestrichen, es gebe keinen Konsumenten. Das Argument trägt für CR-DRAFT-GC-348 (ein
Format-Bump an einem Feed mit null Lesern) und es trägt **nicht** hier:

- Eine **Aggregation** (CR-GC-347) lässt sich jederzeit nachträglich über gespeicherte Records rechnen.
- Ein **Prompt, der nicht mitgeschrieben wurde, ist unwiederbringlich weg.** Jeder Tag ohne
  Erfassung ist ein Tag Trainingsdaten, den ein späterer Konsument nie bekommt.

Erfassen ist deshalb *jetzt* fällig, Auswerten nicht. Dieser CR erfasst und wertet nichts aus.

**Warum nicht einfach das Claude-Log — nachgemessen 2026-08-15.** Drei Gründe, alle gemessen:

1. **Es gibt es nur für einen Client.** Für `graphcode run` mit lokalem oder fremdem LLM
   (CR-GC-278/279) existiert kein Transkript. Genau dort entstehen die Rejections, aus denen
   kalibriert wird.
2. **Es verfällt.** `~/.claude/projects` ist ein rollendes ~30-Tage-Fenster (Default
   `cleanupPeriodDays`, in `settings.json` nicht gesetzt). Ältestes erhaltenes Transkript über
   **alle** Projekte: 2026-07-12. **23 der 128 Audit-Records (18 %) sind bereits älter als jedes
   überlebende Transkript** — ihre Prompts sind heute schon weg, darunter die der vier
   Kalibrier-Analysen aus CR-GC-346 §1.
3. **Es ist zu 98 % nicht das Gesuchte.** Das graphcode-Transkript umfasst **74,1 MB** in 51
   Sessions; die echten User-Prompts darin sind **1359 KB = 1,79 %**. Der Rest sind 35,4 MB
   Tool-Results und 30,8 MB Assistant-Ausgabe. Ein Trail-Stempel dupliziert also nicht das Log,
   sondern rettet den 2-%-Anteil, der die Frage beantwortet — für 35 KB (§3).

Die verbleibende Dopplung für Claude Code ist der bewusst gezahlte Preis für *einen* Erfassungsort
statt zwei Halben, von denen eine nach 30 Tagen verschwindet.

---

## 2. Warum Selbstdeklaration nicht die Lösung ist

Der naheliegende Entwurf — ein `intent`-Feld im Tool-Input, das der Agent füllt — ist der falsche,
und der Trail beweist es bereits: `consumerId` **ist** genau dieses Feld, seit dem ersten Record,
und ist zu 40 % der Default. Dazu kommt ein zweiter Fehler, den `consumerId` nicht hat:

> Was ein Modell über seinen eigenen Prompt schreibt, ist eine **Paraphrase**, kein Volltext.
> Als Trainingsdatum für Prompt→Ergebnis ist eine Paraphrase des Prompts wertlos — sie enthält
> bereits die Interpretation, die vorhergesagt werden soll.

Der Entscheid „Volltext mit Kappung" schließt Selbstdeklaration damit aus. Beide Stempel müssen
**abgeleitet** werden, an der Stelle, an der der Harness den echten Text ohnehin in der Hand hält:

| Pfad | Wo der Volltext liegt | Erfassung |
|---|---|---|
| **Executor** (`graphcode run`, lokales/fremdes LLM) | `config.model` + `gen.prompt` — beide im Prozess, beide werden bei `registry['graph_mutate'].handler(input)` ([executor.ts:542](../../../src/executor.ts) und [:1074](../../../src/executor.ts)) **weggeworfen** | direkt, kein Hook (→ CR-GC-355) |
| **MCP** (Claude Code, OpenCode) | nur beim Client — der Harness sieht den User-Prompt nie | `UserPromptSubmit`-Hook schreibt ihn session-lokal, `recordAudit` liest ihn (→ CR-GC-356) |

Kein Pfad braucht eine Änderung an den **11 Skill-Dateien**, die heute `graph_mutate` aufrufen
(`.claude/commands/se-*.md`, `se/*.md`). Ein pflichtiges `intent`-Argument hätte sie alle
angefasst — und hätte trotzdem nur Paraphrasen geliefert.

---

## 3. Entwurf — vier optionale Felder

```ts
export interface AuditEntry {
  // … unverändert …

  /** Session, die diesen Record erzeugt hat — gruppiert die Records EINES Gesprächs.
   *  Harness-seitig vergeben, nicht vom Konsumenten deklarierbar. */
  sessionId?: string;

  /** Das LLM, das die Kommandos emittiert hat (`config.model` im Executor-Pfad).
   *  Die Größe, gegen die CR-GC-284 aufgeschlüsselt hat — heute nicht aufgezeichnet. */
  model?: string;

  /** Der auslösende Prompt IM WORTLAUT, gekappt bei INTENT_MAX_CHARS.
   *  Abwesend heisst NICHT AUFGEZEICHNET, nie „leerer Prompt" (Muster: `rulesPassed`, CR-GC-314). */
  intent?: string;

  /** true, wenn `intent` gekappt wurde. Kein stiller Schnitt (Muster: CR-GC-347 §2.4). */
  intentTruncated?: boolean;
}
```

**Kappung:** `INTENT_MAX_CHARS = 4000`, eine Konstante in graphcode, nicht im Vertrag — der Vertrag
sagt „gekappt", die Politik sagt „wo". **Nachgerechnet an 379 echten Prompts** aus 51 Claude-Code-
Sessions dieses Repos (2026-07-10 … 08-15): Median **126 Zeichen**, nur **7 von 379** über 4000;
gekappt schrumpfen alle 379 von 1359 KB auf **107 KB** (der Rohwert ist von einem einzelnen
616-KB-Einfügen dominiert). Mittelwert gekappt: **288 B/Prompt** ⇒ 128 Audit-Records kosten
**≈ 35 KB**, der Trail wächst von 798 KB auf ~833 KB (**+4 %**, 8,1 % der 10-MB-Compaction-Schwelle).
Die Aufbewahrungsfrage (CR-GC-346 F4) wird davon **nicht** dringender — CR-GC-349 bleibt, wo es ist.

**Warum vier Felder und nicht ein `origin`-Objekt:** `consumerId`/`consumerType` liegen top-level.
Ein Objekt daneben, das denselben Sachverhalt zweitens beschreibt, wäre ein zweiter Wahrheitsort im
Record. Additiv top-level ist der Schnitt ohne Dopplung.

**Was hier NICHT hin gehört:** keine Zeile in `@sigloch/learning-core` (CR-GC-346 §2.1 gilt
unverändert), kein Lernmechanismus, keine Aggregation über die neuen Felder (die kommt aus
CR-GC-347, das sie automatisch mitnimmt, sobald sie da sind).

---

## 4. Umfang **dieses** CR

1. **Vertrag:** die vier Felder in `graph-api-core/src/audit.ts`, Version 3.0.0 → **3.1.0**,
   **publiziert** — die Range in graphcodes `package.json` (`^3.0.0`) nimmt sie ohne Änderung auf,
   aber `package-lock.json` muss die 3.1.0 nachweisen (kein Stale-Dist-False-Green, CR-GC-262).
2. **Stempel-Pfad:** `ctx.setOrigin({ model?, intent? })` in
   [tool-context.ts](../../../src/tool-context.ts); `recordAudit`/`recordPreview` stempeln daraus.
   Die Kappung passiert **hier**, an genau einer Stelle. `sessionId` wird beim Boot einmal vergeben.
3. **Zugriff auf den Kontext:** `bindToolsWithContext()` gibt Registry **und** Kontext zurück;
   `bindToolsToHarness()` bleibt und delegiert — eine Bindung, zwei Sichten, kein Parallelpfad.
4. **Test rot zuerst** (`se-test`): Kappung + `intentTruncated`, und Abwesenheit ≠ leerer String.

### 4.1 Korrektur am Entwurf — Origin ist **ambient**, kein Parameter

Der erste Entwurf reichte ein `origin`-Objekt durch `recordAudit(origin, …)` und hätte sieben
Aufrufstellen angefasst. Beim Bauen zeigte sich, dass das der falsche Schnitt ist:

- **Es ist keine Eigenschaft des Kommandos, sondern des Aufzeichnungs-Kontexts.** Wer gerade
  schreibt und auf welchen Prompt hin, ändert sich nicht je Batch, sondern je Runde/Turn.
- **Durchreichen hätte einen Selbstdeklarations-Kanal geöffnet.** Sobald der Wert an der
  Tool-Grenze ankommt, muss ihn irgendwer ins Input-Schema schreiben — und damit könnte das
  Modell ihn setzen. Genau das schließt §2 aus. Ambient ist strukturell unerreichbar für das Modell.
- **Null Churn:** die sieben Aufrufstellen bleiben unverändert, was den verhaltensneutralen Teil
  dieses CR auf null Zeilen reduziert.

Preis, offen benannt: ambient heißt **eine schreibende Session je Kontext**. `graphcode run` erfüllt
das per Konstruktion; der MCP-Pfad tut es nicht, wenn der Host-Shim mehrere Sessions bündelt
(CR-GC-235) — deshalb entscheidet CR-GC-356 dort *pro Write* anhand des Relays und zeichnet bei
Mehrdeutigkeit lieber **nichts** auf.

**Nicht-Ziele:** die eigentliche Erfassung. Nach diesem CR trägt der Record die Felder und niemand
füllt sie — das ist Absicht: der Vertrag muss publiziert sein, bevor zwei Pfade darauf schreiben.
CR-GC-355 und 356 füllen sie.

---

## 5. Akzeptanzkriterien

- [ ] `@sigloch/graph-api-core` **3.1.0 publiziert**; `npm view @sigloch/graph-api-core versions`
      zeigt sie, `package-lock.json` in graphcode weist sie aus.
- [ ] Die vier Felder sind **optional** — jeder der 123 bestehenden Records parst unverändert
      gegen den neuen Typ, `npm test` ohne Fixture-Änderung grün.
- [ ] Ein Prompt von 5000 Zeichen wird auf 4000 gekappt **und** trägt `intentTruncated: true`;
      ein Prompt von 3999 Zeichen trägt das Feld **nicht** (nicht `false` — Abwesenheit ist die Aussage).
- [ ] Kein `intent` geliefert ⇒ Feld **fehlt** im Record. Nicht `""`, nicht `null` — red-first
      nachgewiesen, dieselbe Asymmetrie wie `rulesPassed` (CR-GC-314 REQ-A05).
- [ ] `sessionId` ist über alle Records eines Harness-Prozesses **identisch** und über zwei
      Prozesse **verschieden**.
- [ ] Die alte `recordAudit(consumerId: string, …)`-Signatur existiert nicht mehr — `grep` beweist
      es, alle sieben Aufrufstellen umgestellt.
- [ ] `tests/mcp.symmetry.test.ts` unverändert grün — die Werkzeug-Oberfläche hat sich nicht bewegt.
- [ ] Disk-Kuzu, keine Mocks. `npm run build` + `npm test` grün.

---

## 6. Folge-CRs — die Erfassung selbst

| CR | Inhalt | Warum getrennt |
|---|---|---|
| **CR-GC-355** | Der Executor stempelt `model` + `gen.prompt` (Volltext, verbatim) auf jeden Record | der Pfad **ohne** Fremd-Transkript — lokale/fremde LLMs. Der eigentliche Anlass. `executor.ts` + Test |
| **CR-GC-356** | `UserPromptSubmit`-Hook schreibt den Volltext session-lokal; `recordAudit` stempelt ihn | anderer Mechanismus, anderes Repo-Areal (`.claude/hooks/` + `scaffold-templates.ts`) — der Hook-Pfad ist in diesem Repo etabliert (drei PreToolUse-Hooks) |
| **CR-GC-349** | Aufbewahrungsregel für den Trail | unverändert dringend, **nicht** dringender: die Prompts kosten +4 % (§3). Der Grund bleibt derselbe wie in CR-GC-346 F4 |

Reihenfolge: **346 → 354 → 355 → 356**, mit **349** parallel entscheidbar (Governance, kein Code).
CR-GC-347 ist unabhängig und nimmt die neuen Felder automatisch mit, sobald sie im Record stehen —
`byModel` wird dort zur dritten Gruppierung neben `byRule`/`byConsumer`, ohne eigenen CR.

---

## 7. Verhältnis zu CR-GC-346

346 modelliert `UC-loop-closure` + `REQ-rule-calibration` — die **Kalibrier**-Hälfte, und die ist
richtig geschnitten. Was 346 §2.1 gestrichen hat, war `REQ-prompt-prediction` als *Vorhersage*-
Anforderung; das bleibt gestrichen. Was hier zurückkommt, ist die **Aufzeichnungs**-Anforderung:

| uid | Inhalt |
|---|---|
| `REQ-prompt-provenance` | Jede Gate-Entscheidung ist ihrem Urheber (Session, Modell) und ihrem auslösenden Prompt im Wortlaut zuordenbar — die Grundlage jeder späteren Auswertung, gleich welcher. |

Diese REQ hat einen Abnehmer, der heute existiert: `REQ-rule-calibration` selbst. Die
Modell-Aufschlüsselung aus CR-GC-284 ist ohne `model` nicht herstellbar — die Kalibrier-REQ ist
ohne diese REQ nur zur Hälfte erfüllbar. Kein Feature ohne Auftraggeber (CR-GC-339).

**Modelliert wird sie in CR-GC-355**, zusammen mit dem ersten Pfad, der sie erfüllt — ein Vertrag
ohne Schreiber ist keine erfüllte Anforderung.

---

## 8. Betroffene Dateien (5, zwei Repos)

| Repo | Datei | Änderung |
|---|---|---|
| sigloch-modules | `packages/graph-api-core/src/audit.ts` | vier optionale Felder an `AuditEntry` |
| sigloch-modules | `packages/graph-api-core/package.json` | 3.0.0 → 3.1.0 |
| graphcode | `src/tool-context.ts` | `AuditOrigin` + `setOrigin`/`sessionId`, Kappung an einer Stelle |
| graphcode | `src/mcp-tools.ts` | `bindToolsWithContext` — zweite Sicht auf dieselbe Bindung |
| graphcode | `tests/audit.origin.test.ts` | **neu** — Kappung, `intentTruncated`, Abwesenheit ≠ leer, `sessionId`-Stabilität, Rejection-Fall |
| graphcode | `docs/cr/open/CR-GC-354-trail-traegt-urheber-und-prompt.md` | dieser CR |

`src/tools/write.ts` und `src/tools/testreport.ts` bleiben **unverändert** — die Folge von §4.1.

@author andreas@siglochconsulting
