# CR-GC-311 — Time-Travel: Funktionen modellieren, Wirkkette schließen, `graphcode rewind` bauen

**Status:** done · **Angelegt:** 2026-08-08 · **Abgeschlossen:** 2026-08-08 · **Max Files:** 4
**Herkunft:** ConOps-Review 2026-08-08. `UC-graph-time-travel` rendert in
`docs/views/conops.md` mit „— kein Betriebsablauf beschrieben (keine FCHAIN) —".
**Abhängigkeit:** keine. CR-GC-312 (Regelkatalog-Wiring) macht diese Klasse Befund
künftig sichtbar, ist aber nicht Voraussetzung.

## Problem

Der Time-Travel-Mechanismus ist gebaut und grün getestet
(`tests/graph-timetravel.test.ts`), aber im Graph existiert **kein einziger FUNC-Knoten
dafür**. 41 FUNCs, keiner zeigt auf `reseed`, `graph_export` oder den Drift-Marker:

| Code | Ort | FUNC |
|---|---|---|
| `harness.reseed()` | `src/harness.ts:532` | ✗ |
| `graph_export` | `src/tools/export.ts:124` | ✗ |
| Drift-Marker | `src/export-marker.ts` | ✗ |

Der nächste Nachbar `FUNC-import` bindet `harness.ts#importGraph` — eine andere Funktion
(Format-E-Bulk-Import durchs Gate), allokiert an `UC-code-quality`. Reseed ist
drop+reimport hinter dem Write-Mutex und ruft `importGraph` nicht auf.

Ohne FUNC keine FCHAIN, ohne FCHAIN kein Betriebsablauf: der UC steht zu Recht auf
`in-progress`, und `docs/views/conops.md` zeigt eine leere Zeile statt einer Wirkkette.

Zweiter, davon unabhängiger Befund: **Rewind existiert als Operation nicht.**
`graph_reseed` nimmt einen Pfad und kennt kein git. `src/cli.ts` hat `mcp`, `host`, `run`,
`import-code`, `init|update|remove`, `skills` — kein `rewind`. Ein früherer Stand ist heute
eine Handanweisung: `git checkout <ref>` → `graph_reseed` mit dem richtigen Snapshot-Pfad
→ zurück auf den Ausgangs-Ref.

## Warum hier ein Sammelbefehl gerechtfertigt ist

Eine FCHAIN darf aus vorhandenen FUNCs bestehen, die ein Actor manuell aneinanderreiht —
neuer Code ist dafür ausdrücklich **nicht** nötig (Kriterien: CR-GC-312 §„Manuelle
Wirkketten"). Time-Travel ist die Ausnahme, weil die Sequenz eine Invariante trägt, die
die Einzelschritte nicht garantieren können:

`git checkout` und `reseed` sind zwei unabhängige Zustandsänderungen. Bricht die Sequenz
zwischen ihnen ab, zeigt der Kuzu-Store auf Stand A und der Working-Tree auf Stand B — und
der Drift-Marker fängt das nicht ab, weil er nur un-exportierte **Mutationen** markiert,
nicht einen Store, der zum falschen Commit gehört. Genau diese Klammer ist der Grund für
das Verb; nicht „jede denkbare Aufruf-Kombination braucht einen Befehl".

## Scope (≤ 4 Dateien)

1. **`src/rewind.ts`** (neu) — `rewind(ref, opts)`: Snapshot-Blob aus `<ref>` lesen
   (`git show <ref>:docs/graph/<system>.graph.json`, **kein** Working-Tree-Checkout),
   in eine Temp-Datei materialisieren, `harness.reseed()` darauf, Temp entfernen. Vorher
   `EXPORT_PENDING` prüfen und bei gesetztem Marker **abbrechen** (un-exportierte Mutationen
   würden sonst kommentarlos verworfen); `--force` überschreibt. Bricht ein Schritt ab,
   bleibt der Store auf dem Ausgangsstand.
2. **`src/cli.ts`** — `case 'rewind'` + Hilfetext.
3. **`tests/rewind.test.ts`** (neu) — realer Disk-Kuzu, echtes Temp-Git-Repo.
4. **`src/viewer/help-content.ts`** — Verb im Hilfetext.

Die Modell-Änderung läuft durchs Gate (kein Hand-Edit), `docs/graph/graphcode.graph.json`
und `docs/views/*` entstehen daraus per `graph_export`.

## Modell-Änderung (ein Gate-Batch)

**Neue FUNC** (alle `allocate → MOD-harness`, `FUNC-graph-export-snapshot` →
`MOD-mcp-tools`):

| uid | realRef |
|---|---|
| `FUNC-graph-export-snapshot` | `src/tools/export.ts#graph_export` |
| `FUNC-reseed` | `src/harness.ts#reseed` |
| `FUNC-rewind` | `src/rewind.ts#rewind` |

**satisfy:** `FUNC-graph-export-snapshot → REQ-graph-snapshot-per-commit` ·
`FUNC-reseed → REQ-graph-state-recall` · `FUNC-rewind → REQ-graph-state-recall`

**Zwei FCHAIN** (flach, FC-03), beide `compose → UC-graph-time-travel`:

- `FCHAIN-snapshot-freshness` — Aufzeichnen:
  `FUNC-mutate` → `FUNC-save-graph` → `FUNC-graph-export-snapshot`
- `FCHAIN-recall` — Wiederherstellen: `FUNC-rewind` → `FUNC-reseed`

**Actor-Bindung** (FC-04 verlangt Eintritt *und* Austritt auf FUNC/FLOW-Ebene):

- `ACTOR-developer → FLOW-cli-command → FUNC-rewind` (Eintritt)
- `FUNC-reseed → FLOW-graph-state → ACTOR-developer` (Austritt)
- `ACTOR-developer → FLOW-mutate-cmd → FUNC-mutate` (Eintritt, ggf. vorhanden)
- `FUNC-graph-export-snapshot → FLOW-formatE-artifact → ACTOR-developer` (Austritt)
- `ACTOR-developer → UC-graph-time-travel` io — schließt **UC-02** (error), heute die
  einzige error-Violation dieses UC im vollen Katalog

`FLOW-cli-command`-Beschreibung von „init | update | remove" auf die tatsächliche
Verb-Liste ziehen.

**Status:** `UC-graph-time-travel`, `REQ-graph-snapshot-per-commit`,
`REQ-graph-state-recall` auf `done` — erst nachdem 1–3 grün sind, nicht vorab.

## Akzeptanzkriterien

- [x] `graphcode rewind <ref>` stellt den Graph-Stand von `<ref>` her; `rewind HEAD` nach
      beliebigen Mutationen ist idempotent
- [x] Bei gesetztem `EXPORT_PENDING` bricht `rewind` ab und nennt den Grund; `--force`
      überschreibt; ohne `--force` ist der Store danach unverändert
- [x] Unbekannter Ref / fehlender Snapshot in `<ref>`: Fehlermeldung, Store unverändert
- [x] Der Working-Tree wird nicht angefasst (`git status` vor/nach identisch) — Rewind
      betrifft den Store, nicht den Checkout
- [x] Test läuft gegen echtes Temp-Git-Repo + Disk-Kuzu, kein Mock, kein `:memory:`
- [x] `docs/views/conops.md` zeigt für `UC-graph-time-travel` beide FCHAIN statt
      „kein Betriebsablauf beschrieben"
- [x] `evaluateAllRules` meldet für `UC-graph-time-travel` weder UC-02 noch UC-03/FC-02
      (Nachweis im Test, nicht per Sichtprüfung)
- [x] RC-01 löst für alle drei neuen `realRef` auf
- [x] `npm test && npm run build` grün — 81 Dateien / 582 Tests

## Abweichungen vom Plan

- **`src/viewer/help-content.ts` war der falsche Ort.** Das Modul annotiert Rules/Gates/
  Panels, keine CLI-Verben. Stattdessen `README.md` (die Verb-Liste, die ein Nutzer liest).
- **Zwei eigene FLOW statt geteilter.** Der erste Entwurf band die Actor-Grenzen an
  `FLOW-graph-state` / `FLOW-formatE-artifact` — das erzeugte eine R-12-Zirkularität
  (`ACTOR-developer ↔ FLOW-graph-state`) und zwei R-21-Treffer, weil geteilte FLOWs die
  neuen FUNCs an fremde Konsumenten koppeln. `FLOW-graph-snapshot` (SSOT-at-rest) und
  `FLOW-recalled-state` benennen stattdessen genau die Datenobjekte dieses UC.
- **`FCHAIN -satisfy-> REQ` ergänzt** (im Plan nicht vorgesehen): deckt die
  R-21-Verbindungen innerhalb einer Kette über den Integrations-TEST ab.
- **Ein R-21-Warning bleibt bewusst stehen:** `FUNC-graph-export-snapshot →
  FUNC-reseed`. Die beiden hängen über `FLOW-graph-snapshot` zusammen, liegen aber in
  verschiedenen Ketten — der Snapshot IST das Bindeglied zwischen Aufzeichnen und
  Wiederherstellen. Eine Kette daraus zu machen wäre Modellierung gegen die Regel,
  nicht für die Sache.
- **CR-GC-313 musste vorgezogen werden.** Der laufende MCP-Server exportiert aus seinem
  `dist` vom Startzeitpunkt und hat beim ersten `graph_export` das von CR-GC-305
  entfernte `docs/views/spec.md` wiederbelebt. Ohne den reparierten
  `scripts/export-graph.mjs` war dieser CR nicht verifizierbar.
