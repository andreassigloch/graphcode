# CR-GC-452 — Die Viewer-Probe fragt Identität, nicht Readiness

**Status:** Done
**Datum:** 2026-09-01
**Auslöser:** Gemeldet als „das Dashboard kommt nicht hoch". Es lief — siebenmal.

---

## Root Cause

Die Identitätsprobe hatte ein Budget von 750 ms und fragte einen Endpunkt, der erst rechnet.

`ensureViewer` (`gve.ts`) und `graphcode status` (`status.ts`) stellten beide dieselbe Frage —
„bedient ein laufender Viewer DIESES Repo?" — als `GET <dashboard.url>api/dashboard` mit
`AbortSignal.timeout(750)`. Diese Antwort ermittelt zuerst Readiness über den Host-Socket gegen den
Store. Gemessen am 2026-09-01 in diesem Repo:

| Endpunkt | Antwortzeit |
|---|---|
| `api/dashboard` (graphcode, 135-MB-Store) | **1,10–1,91 s** |
| `api/dashboard` (bok, ohne Host-Rechnung) | 0,066 s |
| `api/config` | **0,0009 s** |

Die Probe lief also in diesem Repo **immer** ins Timeout. Ein Timeout ist im `catch` von
„nicht erreichbar" nicht unterscheidbar und wurde als **Abwesenheit** gehandelt.

## Impact

Zwei Symptome, eine Ursache:

1. **`status` log.** „Dashboard läuft nicht", während `curl` auf genau die Adresse aus
   `docs/views/dashboard.url` sauber `repoRoot: …/graphcode` zurückgab.
2. **Waisen-Leak.** `ensureViewer` las dasselbe Timeout als „kein Viewer da" und startete einen
   weiteren. Vite bumpte vom abgeleiteten Port 43354 hoch, der neue Viewer schrieb seine Adresse in
   `dashboard.url` — und die vorige Instanz blieb stehen. Vorgefunden: **7 Viewer auf 43354–43360
   für ein Repo**, gestartet im 20–30-s-Takt des Polls.

Gate, Host und Store waren nicht betroffen.

## Zweite, unabhängige Ursache im Leck

Auch ohne den Timeout hätte jeder Doppelstart eine Waise hinterlassen: `.graphcode/gve.pid` fasst
EINEN Viewer, `rememberViewer` überschreibt. Wer lebend überschrieben wird, ist ab diesem Moment
unerreichbar — `stopViewerIfLastSession` beendet nur den vermerkten. Deshalb überlebten die sechs
älteren jedes Sitzungsende.

## Änderung

**graph-view-edit (0.7.2 → 0.8.0)**

- `GET /api/config` trägt zusätzlich `repoRoot` — dieselbe Identität wie `api/dashboard`
  (`servedRepoRoot()`, physisch), aber ohne Graph-Rechnung. Bewusst **nicht** in `ConfigSchema`:
  es ist Identität der Instanz, kein Config-Feld. `FALLBACK_CONFIG === ConfigSchema.parse({})`
  bleibt damit unberührt.

**graphcode**

- Beide Proben fragen `api/config` statt `api/dashboard`.
- `PROBE_TIMEOUT_MS` hat EINEN Besitzer (`gve.ts`); `status.ts` importiert ihn. Zwei Kopien
  derselben Zahl hätten Starter und Bericht über „läuft ein Viewer" uneinig werden lassen — genau
  die Uneinigkeit, die Waisen erzeugt. Das Budget bleibt bei 750 ms, weil der Endpunkt jetzt
  nichts kostet — nicht erhöht, sondern überflüssig gemacht.
- `retireOrphanViewer()`: vor jedem Spawn wird ein noch lebender, aber unerreichbarer Vermerk
  beendet. Dass überhaupt gespawnt wird, heißt: unter der vermerkten Adresse antwortet keiner —
  ein trotzdem lebender Vermerk ist per Definition die Waise. Von Hand gestartete Viewer stehen nie
  in dieser Datei und bleiben unangetastet.
- `isAlive(pid)` wird aus `gve-sessions.ts` exportiert; die Kopien in `status.ts` und `upgrade.ts`
  sind gelöscht. Die vierte Fassung in `kernel/store-lock.ts` bleibt bewusst stehen: sie hat eine
  zusätzliche Fail-safe-Regel für nicht-numerische PIDs (CR-GC-420) und ist kein Duplikat.
- Dep-Floor `@sigloch/graph-view-edit` → `^0.8.0` (der Import folgt dem Floor: die Probe braucht
  `repoRoot` aus `/api/config`).

## Nachweis

Rot-zuerst, beide Seiten:

- **GVE:** ohne `config.repoRoot` fallen 3 Tests in `tests/npx-cli.test.mjs` (Identität, Kosten
  < 250 ms, Unterscheidung zweier Repos). Mit: 811/811 grün.
- **graphcode:** die zwei neuen Tests bilden den echten Server nach — rechnend auf `api/dashboard`,
  sofort auf `api/config`. Gegen den alten Endpunkt laufen sie nach 753 ms ins Timeout und der
  Autostart erzeugt die Waise (`calls` ≠ 0); gegen `api/config` grün.

Live am laufenden Viewer verifiziert: `api/config` 0,86 ms mit korrektem `repoRoot`,
`api/dashboard` 1,38 s, `graphcode status` → `Dashboard OK http://localhost:43354/` — auf dem
stabilen abgeleiteten Port, nicht auf einem gebumpten.

## Folgeschritte (nicht Teil dieses CR)

- Der laufende MCP-Host bootet den Code, mit dem er gestartet ist. Bis zum Neustart probt er weiter
  `api/dashboard` — der Fix wirkt für ihn erst danach.
- `@sigloch/graph-view-edit@0.8.0` muss publiziert werden; bis dahin ist der Floor `^0.8.0` nur im
  Link-Modus erfüllbar. Das ist der ehrliche Zustand, kein Range-Problem.
