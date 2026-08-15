# CR-GC-347 — `audit_stats` aggregiert je Regel und je Konsument

**Status:** open · **Angelegt:** 2026-08-15 · **Max Files:** 6 (dieser CR: **4**)
**Vorbedingung:** CR-GC-346 — dort steht der Use Case (`REQ-rule-calibration`), den dieses Werkzeug
bedient. Ohne ihn ist das hier ein Feature ohne Auftraggeber.
**Ziel:** die Tabelle, auf der CR-GC-284 ruht, kommt aus einem Werkzeug statt aus `jq`.

---

## 1. Problem

`audit_stats` liefert heute vier Zahlen:

```ts
{ totalEntries: number, applied: number, rejected: number, graphVersion: number }
```

Die Auswertung, die CR-GC-284 ausgelöst hat — *„R-01 dominierte die Gate-Rejections aller Modelle:
Haiku 26/29, Opus 17/18, devstral 10/23"* — ist damit nicht herstellbar. Sie ist eine `jq`-Zeile,
und genau so ist sie damals entstanden:

```bash
jq -r 'select(.result=="rejected") | .violations[]? | select(.severity=="error") | .ruleId' \
  .graphcode/audit.jsonl | sort | uniq -c | sort -rn
```

Auf dem aktuellen Trail (108 Records seit 2026-07-03):

| Regel | Rejections | | Konsument | Rejections |
|---|---|---|---|---|
| R-29 | 16 | | mcp-client | 4 |
| SCHEMA-01 | 8 | | cr-gc-334 | 1 |
| R-08 | 2 | | cr-gc-311 | 1 |
| OCC | 2 | | (4 weitere) | je 1 |

Das ist keine exotische Abfrage. Es ist **die** Frage, die man an einen Audit-Trail stellt, wenn man
Schwellen kalibrieren will — und ein Agent, der nur MCP-Werkzeuge hat, kann sie nicht stellen.

Die positive Hälfte fehlt genauso: `rulesPassed` (CR-GC-314) liegt auf 28 der 108 Records und wird
von keinem Werkzeug aggregiert. Ohne sie gibt es keine Grundgesamtheit — „R-08 hat 2 mal geblockt"
ist ohne „und 87 mal durchgelassen" keine Rate, sondern eine Anekdote.

---

## 2. Entwurf

### 2.1 Ausgabe

```ts
{
  window:  { since: string | null, until: string | null, entries: number },
  totals:  { applied: number, rejected: number, partial: number },
  byRule: Array<{
    ruleId: string,
    blocked: number,       // Records mit result 'rejected' UND dieser Regel als error
    occurrences: number,   // Auftreten insgesamt, jede Severity
    bySeverity: { error: number, warning: number, info: number },
    passed: number | null, // aus rulesPassed — null heisst NICHT AUFGEZEICHNET
    passRate: number | null,
  }>,
  byConsumer: Array<{
    consumerId: string,
    applied: number,
    rejected: number,
    topBlockingRule: string | null,
  }>,
  graphVersion: number,
}
```

### 2.2 Zählregeln — ausgeschrieben, weil sie sonst falsch gelesen werden

- **Ein Record kann mehrere Regeln verletzen.** `sum(byRule[].blocked) > totals.rejected` ist der
  Normalfall, kein Fehler. Wer eine Prozentzahl daraus bildet, bildet sie gegen `totals.rejected`,
  nicht gegen die Summe.
- **`blocked` zählt Records, nicht Violations.** Zwanzig R-29-Violations in einem abgelehnten Batch
  sind **eine** Blockade dieser Regel. `occurrences` zählt die Violations — beide Zahlen stehen da,
  weil beide gebraucht werden und die Verwechslung sonst still passiert.
- **`passed: null` heisst „nicht aufgezeichnet", nie „null mal bestanden".** Auf diesem Trail gilt
  das für 80 der 108 Records: sie sind älter als CR-GC-314. Dieselbe Asymmetrie, die dort schon
  entschieden wurde (REQ-A05) — `passRate` ist deshalb `null`, sobald die Grundgesamtheit
  unvollständig ist, und nicht etwa optimistisch gerechnet.
- **`byConsumer.topBlockingRule` ist `null` bei Gleichstand**, nicht der alphabetisch erste. Ein
  erfundener Sieger ist schlechter als kein Sieger.

### 2.3 Eingabe

`since` und `consumerId` — beides kann `AuditLog.query()` bereits, es wird nur durchgereicht. Kein
`groupBy`-Schalter: die drei Gruppierungen kommen zusammen zurück, weil die Datenmenge klein ist
(108 Records, 20 Regeln, 30 Konsumenten ≈ 5 KB) und ein Schalter drei Aufrufe erzwingen würde, wo
einer reicht.

### 2.4 Größe

Die Ausgabe wächst mit Regeln × Konsumenten, nicht mit Records — das ist die ganze Pointe der
Aggregation. Obergrenze: `ALL_RULE_DEFS.length` (72) Zeilen `byRule`, die Konsumentenliste ist
unbeschränkt. Wenn `byConsumer` je die Antwort sprengt, ist der Filter `consumerId` der Ausweg,
**kein stiller Top-N-Schnitt** — ein abgeschnittener Konsument liest sich sonst als „hat nie
geschrieben".

---

## 3. Das Werkzeug zieht um — die 500-Zeilen-Grenze ist schon überschritten

[`src/tools/report.ts`](../../../src/tools/report.ts) hat **570 Zeilen**. Die Grenze aus CLAUDE.md
liegt bei 500, und der Header der Datei hat den Fall vorweggenommen:

> *„Size guard (CR-GC-256 §6): with nine tools this is the group that will hit the 500-line limit
> first — the next reporting tool splits it, it does not grow."*

Dieser CR ist dieser Fall. `audit_trail`, `audit_stats`, `projectAuditEntries` und `opSummary`
ziehen nach `src/tools/audit.ts` (Zeilen 56–160 + 250–317, rund 174 Zeilen) — `report.ts` landet bei
etwa 396 Zeilen. Reines Verschieben plus die neue Aggregation; `bindReportTools` gibt die beiden
Werkzeuge unverändert weiter an dieselbe Registry, damit `tests/mcp.symmetry.test.ts` und die
Werkzeugzahl aus CR-GC-205 unangetastet bleiben.

`projectAuditEntries` bleibt exportiert — CR-GC-346 fasst sie an, dieser CR verschiebt sie. **Deshalb
346 zuerst:** andersherum kollidiert eine Änderung an einer Funktion mit ihrem Umzug.

---

## 4. Akzeptanzkriterien

- [ ] `audit_stats` liefert `byRule` und `byConsumer` über den **echten** Repo-Trail, und die Werte
      sind **identisch** zur `jq`-Zeile aus §1 — der Test vergleicht gegen die Zeile, nicht gegen
      abgeschriebene Zahlen (sonst driftet die Erwartung mit den Daten).
- [ ] Ein Record mit 20 Violations derselben Regel zählt `blocked: 1`, `occurrences: 20`.
- [ ] Auf einem Trail ohne ein einziges `rulesPassed` ist `passed` und `passRate` **`null`**, nicht
      `0` — red-first nachgewiesen.
- [ ] Gleichstand bei `topBlockingRule` ⇒ `null`.
- [ ] `since`/`consumerId` filtern nachweislich; ein Filter, der nichts trifft, liefert leere
      Listen und `entries: 0`, keinen Fehler.
- [ ] `src/tools/report.ts` ist wieder **unter 500 Zeilen**; `src/tools/audit.ts` ebenfalls.
- [ ] Keine `tests/mcp.symmetry.test.ts`-Änderung nötig — das ist der Beweis, dass der Umzug
      verhaltensneutral war.
- [ ] Disk-Kuzu, keine Mocks. `npm run build` + `npm test` grün.

---

## 5. Betroffene Dateien (4)

| Datei | Änderung |
|---|---|
| `src/tools/audit.ts` | **neu** — `audit_trail`, `audit_stats` (aggregiert), `projectAuditEntries`, `opSummary` |
| `src/tools/report.ts` | die vier Symbole raus, Re-Bind der zwei Werkzeuge in dieselbe Registry |
| `tests/audit.stats.test.ts` | **neu** — Aggregation, Zählregeln, Absence-≠-Null, Filter |
| `docs/cr/open/CR-GC-347-audit-stats-aggregation.md` | dieser CR |

`tests/audit.trail-projection.test.ts` importiert `projectAuditEntries` — der Import-Pfad ändert
sich, der Testinhalt nicht. Das zählt als Folgeänderung, nicht als fünfte Datei.

---

## 6. Reihenfolge

1. **CR-GC-346** (Use Case + Projektionsfix) — sonst fasst dieser CR eine Funktion an, die parallel
   geändert wird.
2. Umzug nach `audit.ts`, Tests grün, **ohne** neue Funktionalität — der verhaltensneutrale Schritt
   zuerst, damit ein späterer Fehlschlag zuordenbar ist.
3. Aggregation dazu.

@author andreas@siglochconsulting
