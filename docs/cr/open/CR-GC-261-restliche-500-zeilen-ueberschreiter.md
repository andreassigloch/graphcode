# CR-GC-261: Restliche 500-Zeilen-Überschreiter — readiness-Config + harness-Query-Pfad

**Status:** postponed (2026-07-26) · **Max Files:** 6
**Herkunft:** Folge-CR aus CR-GC-260. Zwei der vier dort geschnittenen Module blieben über der
500-Zeilen-Grenze, weil der jeweils **nächste** Schnitt mehr kostet, als ein Verschiebe-CR tragen
darf. Nicht offengelassen, sondern hier mit eigenem Budget geführt.

## Problem (Why)

| Modul | Nach CR-GC-260 | Warum nicht weiter geschnitten |
|---|---|---|
| `src/readiness.ts` | 505 | Nächster Schnitt = Gate-Tabellen + Report-Typen. Deren Importeure: `src/viewer/help.ts`, `src/viewer/panels.ts` **und vier Testdateien** → 9 Dateien gegen das harte 6-Dateien-Limit. |
| `src/harness.ts` | 712 | Import-/Seed-Pfad ist heraus (`harness-import.ts`). Näher an 500 kommt nur, wer `applyMutation` verschiebt — das **ist** das Apply-Gate (L1). |

## Decision

1. **`readiness.ts` → `readiness-gates.ts`** (zuerst, risikolos): `PHASE_GATE_RULES` /
   `PHASE_GATE_LABELS` / `PHASE_GATE_CREATIONS` / `CREATION_LABELS` / `IMPL_GATE_PHASE` /
   `IMPL_GATE_MILESTONES` / `IMPL_GATE_RULES` + die Creation-Currency-Typen. Reine Konfiguration,
   getrennt von der Scoring-Logik (`CLAUDE.md`: Config getrennt von Business Logic). Kein Zyklus —
   das Config-Modul importiert nichts aus `readiness.ts`. Importeure ziehen mit: 2 src + 4 Tests,
   jeweils nur die Import-Zeile.
2. **`harness.ts` → `harness-queries.ts`** (danach): `impact` / `subgraph` / `testImpact` /
   `listElements` — rund 125 Zeilen read-only Cypher, kein Gate-Bezug, gleiches `ImportTarget`-
   Muster wie CR-GC-260 (schmaler Port statt ganzer Harness).
3. **Das Apply-Gate wird NICHT verschoben.** Nach §2 liegt `harness.ts` bei ~590 Zeilen. Die 500
   sind dort ohne Gate-Umbau nicht erreichbar — das wird als **bewusste, dokumentierte Ausnahme**
   in `CLAUDE.md`/`src/README.md` festgehalten, nicht als offener Rest weitergeschleppt. Ein
   Fehler im Gate ist ein Governance-Fehler, kein Formatierungsfehler.

## Akzeptanz

- [ ] Reines Verschieben: keine Signatur-, Ausgabe- oder Semantik-Änderung.
- [ ] Keine Test-**Assertion** geändert (Import-Zeilen dürfen mitziehen, s. CR-GC-260).
- [ ] `readiness.ts` < 500 und `readiness-gates.ts` < 500; `readiness-gates.ts` bleibt
      browser-safe (kein `node:*`) — die Panels-Schicht baut darauf.
- [ ] `harness-queries.ts` < 500; `harness.ts` ~590 mit der Ausnahme dokumentiert.
- [ ] `npm run build` + `npm run bundle` + `npm test` vollständig grün.

## Nicht in diesem CR

- Der Apply-Gate selbst (`applyMutation`), der Store-Lock (O2), der Write-Mutex (O3).
- `src/mcp-tools.ts` und `src/exporter-views.ts` — mit CR-GC-256 / CR-GC-260 erledigt.

## Strukturupdate 2026-07-26 (nach CR-228 + CR-GC-262/267)

Zurückgestellt, nicht verworfen — der Schnitt bleibt richtig, aber die Zahlen und ein Teil der
Begründung haben sich unter dem CR bewegt:

- **Stand jetzt:** `src/readiness.ts` 506 Zeilen (war 505), `src/harness.ts` 712 (unverändert).
  Der Zuwachs in readiness kommt aus CR-228 D (`RULE_TO_DIMENSION`-Zuordnung) — die Gate-Tabellen
  haben zugleich R-24/R-25 verloren, also ist netto fast nichts passiert.
- **Der geplante `readiness-gates.ts`-Schnitt wird billiger:** CR-228 A hat zwei Regeln aus
  `PHASE_GATE_RULES.CDR` entfernt und CR-GC-262 hat den Bundler abgeräumt, der die Datei
  browser-safe halten musste. Die Bedingung „kein `node:*` in `readiness-gates.ts`" bleibt
  trotzdem — GVE liest die Panels weiterhin client-seitig.
- **Neuer Importeur beachten:** `@sigloch/graphcode-client` (CR-GC-267) hält jetzt den
  View-Katalog. Wer `readiness.ts` schneidet, prüft zuerst, ob ein Stück davon eigentlich in
  dieses dependency-freie Paket gehört, statt ein drittes lokales Modul aufzumachen.
- **Unverändert gültig:** das Apply-Gate wird nicht verschoben; `harness.ts` bleibt die
  dokumentierte Ausnahme.

**Trigger zum Ziehen:** wenn `readiness.ts` das nächste Mal fachlich angefasst wird — nicht als
Sammel-Refactor neben einem Release.
