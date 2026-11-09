# CR-GC-900: graphcode init installiert die Abhaengigkeit und nennt die naechsten Schritte

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1277 (finding)
**Erstellt:** 2026-11-09
**Item:** bok/items/ITEM-2026-1277.json (Lane: graph)

---

## Befund

Wer `npx @sigloch/graphcode init` in einem leeren Repo ausfuehrt, sieht nur einen JSON-Dump mit etwa
60 Pfaden. `init` traegt `@sigloch/graphcode` in `package.json` ein, installiert es aber nicht. Die
Host-Konfigurationen starten graphcode aus `node_modules`. Wer nur das Terminal liest, startet den
Agenten, und der graphcode-Server startet nicht.

**Root Cause:** `init` gibt sein Ergebnis als JSON fuer Maschinen aus und ueberlaesst `npm install`
dem Menschen, obwohl `.mcp.json` die Abhaengigkeit voraussetzt.

## Zielbild

1. `init` fuehrt nach dem Scaffold die Installation aus. Der Paketmanager folgt der Lockdatei:
   `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, sonst npm.
2. Schlaegt die Installation fehl, endet `init` mit Status 1 und nennt den Befehl, den der Mensch
   selbst ausfuehren muss. Die geschriebenen Dateien bleiben stehen.
3. Die Ausgabe ist Text fuer Menschen: Zahl der geschriebenen Dateien, Ergebnis der Installation,
   dann die naechsten Schritte — `.graphcode/` in `.gitignore`, Host neu laden, der erste Satz an
   den Agenten, Verweis auf `GRAPHCODE-STEERING.md`.
4. `init --json` gibt das bisherige JSON aus, auf stdout.
5. README: der Installationsbefehl wird `npx @sigloch/graphcode init`, ohne `&& npm install`.

## Umfang laut Modell

- `REQ-repo-install` — Beschreibung um Installation und Ausgabe erweitert.
- `FUNC-init-verb` (neu, `src/surface/init-verb.ts` `executeInit`) — allocate `MOD-surface`,
  satisfy `REQ-repo-install`, compose in `FCHAIN-repo-lifecycle`.
- `TEST-init-verb` (neu, `tests/init-verb.test.ts`) — verify `REQ-repo-install`.
- Testspur: `graph_tests({changeSet:[FUNC-init-verb, FUNC-harness-cli]})`.

## Dateien

1. `src/surface/init-verb.ts` (neu)
2. `src/cli.ts`
3. `src/surface/cli-args.ts`
4. `tests/init-verb.test.ts` (neu)
5. `README.md`
6. `docs/cr/open/CR-GC-900-…md`

## Akzeptanz

- `graphcode init` in einem leeren Repo: `node_modules/@sigloch/graphcode` existiert danach, die
  Ausgabe nennt die vier naechsten Schritte.
- `graphcode init --json` gibt gueltiges JSON mit `action: "init"` aus.
- Fehlgeschlagene Installation → Status 1, Meldung nennt den Befehl.

## Ergebnis

- `src/surface/init-verb.ts` (`executeInit`, `formatInit`, `packageManager`): Scaffold, dann
  `npm|pnpm|yarn install` nach Lockdatei, dann der Bericht fuer Menschen mit vier naechsten Schritten.
  Fehlgeschlagene Installation → Status 1 mit Befehl und Fehlertext.
- `src/cli.ts`: `init` gibt den Bericht auf stdout aus, `--json` das Ergebnis als JSON. `remove` unveraendert.
- `src/surface/cli-args.ts`: `init` kennt `--json`.
- README: Installationsbefehl ist `npx @sigloch/graphcode init`.
- Modell: `FUNC-init-verb`, `FLOW-install-result-init` (an `ACTOR-auftraggeber`), `TEST-init-verb`,
  `REQ-repo-install` erweitert, CR-Kanten an REQ und FUNC.
- Test: `tests/init-verb.test.ts`, 5 Faelle; ohne den Installationsaufruf werden 3 davon rot.
- Smoke: leeres Repo, `node dist/cli.js init` → echte Installation aus der Registry,
  `node_modules/@sigloch/graphcode` vorhanden, `graphcode mcp` antwortet auf `initialize`.
- `verify:full CR-GC-900`: 1710/1710 gruen, Schlupf 0.
- Offen: die npm-Seite und `npx` zeigen das neue Verhalten erst nach dem naechsten Release.
