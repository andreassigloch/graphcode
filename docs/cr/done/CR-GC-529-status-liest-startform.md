# CR-GC-529: status urteilt über die Startform statt über einen Pin

**Status:** ✅ erledigt (2026-09-14)
**Typ:** aus Item ITEM-2026-139 (finding)
**Erstellt:** 2026-09-14
**Item:** bok/items/ITEM-2026-139.json (Lane: code)
**Schwester-CRs:** CR-GC-528 (Startzeile = Repo-Install), BOK-CR-056 (doctor H10)

---

## 1. Root Cause

Nach CR-GC-528 gibt es keinen Pin mehr. `readPinnedVersion` und `VersionStatus.pin` hätten
jede neue Startzeile als `managed: false` gelesen: eine alte npx-Zeile mit passender Zahl
wäre `ok`, eine Repo-Startzeile ohne Install ebenfalls — beides bootet nicht, was das Repo hält.

## 2. Änderung

`readHostStart(repoRoot)` → `repo` | `npx` | `foreign` | undefined, ersetzt `readPinnedVersion`
restlos. `VersionStatus.start` ersetzt `pin`. Urteil:
- `npx` (gepinnt, `@latest`, ohne Version) → Drift, Aktion `graphcode upgrade` (schreibt die Zeile neu)
- `repo` ohne Install → Drift, Aktion `npm install` (der Host bräche beim Start ab)
- sonst der bisherige Vergleich CLI/Host/Repo-Install, ohne Pin-Zahl
`formatStatus` zeigt `Start npx` statt `Pin x`.

## 3. Dateien (2 + CR)

- `src/surface/status.ts`
- `tests/status.test.ts` — vier Fälle ersetzen die Pin-Fälle aus CR-GC-378

## 4. Test-Nachweis

Rot gegen den alten status.ts (`git stash`): 3 von 24 Fällen. Grün: status + upgrade 37/37,
`tsc --noEmit` sauber. Volllauf mit CR-GC-528: 139 Dateien, 1121 Tests, 273 s, exit 0.

## 5. Kongruenz

FUNC-collect-status bindet `collectStatus` (unverändert vorhanden), TEST-status-verb bindet
`tests/status.test.ts` — kongruent per Symbolpräsenz. Per MCP nicht geprüft (Host dieser
Session hängt am bok-Store).
