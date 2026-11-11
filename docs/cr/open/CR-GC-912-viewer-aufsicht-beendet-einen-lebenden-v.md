# CR-GC-912: Viewer-Aufsicht beendet einen lebenden Viewer, der 750 ms nicht antwortet

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1301 (bug)
**Erstellt:** 2026-11-11
**Item:** bok/items/ITEM-2026-1301.json (Lane: code)

---

## Befund

Am 2026-11-10 um 14:50:10 hat der Host (pid 74603) den Viewer des Repos beendet und einen neuen
gestartet. Der alte Viewer lebte noch und hielt Port 43354; der neue wich auf 43355 aus, der
offene Browser-Tab blieb tot. Am 2026-11-11 nachgestellt: ein Aufruf von `/api/flightrecorder`
blockiert den Viewer 38,8 s (synchrone History-Messung über 497 Graph-Stände, CR-GVE-401), in der
Zeit antwortet auch `api/config` nicht. Die nächste Umfrage von `attachGve` (alle 10 s, Probe mit
750 ms) las das als „kein Viewer“, `retireOrphanViewer` schickte SIGTERM an den lebenden Viewer,
`spawnViewer` startete einen neuen.

**Root Cause:** `ensureViewer` setzt „antwortet nicht“ gleich „ist nicht da“. Für einen Prozess,
der lebt und nur beschäftigt ist, ist das falsch — und die Reaktion (beenden) ist nicht umkehrbar.

## Zielbild

- Antwortet die Probe nicht und **lebt** der vermerkte Viewer (`.graphcode/gve.pid`), wird weder
  beendet noch gestartet. Die Session meldet einmal auf stderr, dass der Viewer lebt, aber nicht
  antwortet.
- Gestartet wird nur, wenn kein vermerkter Viewer lebt (keine `gve.pid` oder Prozess tot).
- `retireOrphanViewer` entfällt: Mit der neuen Regel startet niemand mehr, solange der vermerkte
  Viewer lebt — die Waisen aus CR-GC-452 entstehen nicht mehr.
- `graphcode status` nennt denselben Zustand: „läuft, antwortet nicht (pid N)“ statt „läuft nicht“.
- Ein Viewer, der dauerhaft hängt, bleibt stehen. Das ist Absicht: ein Neustart würde den Fehler
  im Viewer verdecken.

Bekannte Grenze: wird die PID eines toten Viewers vom Betriebssystem neu vergeben, gilt der fremde
Prozess als lebender Viewer, bis die letzte Session `gve.pid` räumt. Entschieden: hinnehmen; die
Alternative (Prozessname prüfen) ist plattformabhängig.

## Umfang

| Datei | Änderung |
|---|---|
| `src/surface/gve.ts` | `ensureViewer`: Zustand `unresponsive`; `retireOrphanViewer` gelöscht |
| `src/surface/status.ts` | Dashboard-Zustand `unresponsive` |
| `tests/gve-supervision.test.ts` | lebender, stummer Viewer wird nicht beendet, nicht ersetzt |
| `tests/gve-autostart.test.ts` | Probe-Ausfall mit lebendem Viewer startet nicht |
| Test von `status.ts` | Zustand `unresponsive` |
| dieser CR | — |

Modell: `FUNC-gve-supervise`, `REQ-viewer-owned-by-repo` (Text um die Regel ergänzen),
`TEST-gve-supervision`.

## Abnahme

1. Unit: Probe schlägt fehl, vermerkter Viewer lebt → kein Spawn, kein Kill, eine stderr-Zeile.
2. Unit: Probe schlägt fehl, vermerkter Viewer tot → Spawn wie bisher.
3. Unit: `graphcode status` meldet `unresponsive` mit pid.
4. Validierung: Viewer des Repos läuft, `/api/flightrecorder` aufrufen (blockiert ~39 s mit
   graph-view-edit 0.19.0) → `gve.pid` und Port bleiben gleich.
