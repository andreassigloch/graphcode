# CR-GC-476 — `own-kuzu` bekommt die Composition Root gereicht (B2)

**Status:** done · **Angelegt:** 2026-09-03 · **Abgeschlossen:** 2026-09-03 · **Herkunft:** CR-GC-467, Strang B; zweiter Schritt
nach CR-GC-475

## Root Cause

`kernel/own-kuzu.ts` entscheidet OWN oder ATTACH — die Ein-Besitzer-Invariante
(REQ-single-kuzu-owner). CR-GC-446/447 haben sie **bewusst** in den Kern gelegt: „die
kernel-Invariante, nicht die HTTP-Oberfläche, die zufällig ihr erster Aufrufer war." Das bleibt.
Was nicht bleibt: im OWN-Fall ruft die Datei selbst `createHarness` — seit CR-GC-475 die
Composition Root der Oberfläche. Der Kern greift nach oben, um zu öffnen.

Dazu die vier Verben (`import-code-verb`, `mcp-server`, `rewind`, `run-verb`), die
`createHarness` noch aus dem Barrel holen statt aus `./create-harness.js` — Oberfläche importiert
Wurzel.

## Änderung

- **Injektion statt Import:** `OwnKuzuOptions` bekommt `open: (config, opts) => Promise<GraphCodeHarness>`
  — die Fabrik, mit der im OWN-Fall geöffnet wird. Der einzige Aufrufer, `surface/host.ts`, reicht
  `createHarness` hinein. Die Entscheidung bleibt im Kern, das Öffnen kommt von oben — Dependency
  Inversion in ihrer Lehrbuchform, und die Signatur sagt jetzt, was die Datei braucht.
- Die vier Verben importieren `createHarness` aus `./create-harness.js`.
- Ratchet **23 → 18**. Kein Modell-Batch: `FUNC-own-kuzu-host` bleibt an `MOD-kernel`, sein
  `realRef` ändert sich nicht.

## Akzeptanzkriterien

- [x] `own-kuzu.ts` importiert nichts aus `../index.js`; `grep -rn "from '../index.js'" src`
      liefert nur noch `kernel/own-kuzu` → nichts mehr aus `src/` (Barrel wird nur noch von außen
      gelesen).
- [x] Build grün; `host*`, `cli.run`, `cli.scaffold`, `import-boundaries` grün; volle Suite im
      Pre-Commit grün.
- [x] Ratchet trägt keinen `→ index`-Eintrag mehr (23 → 18).

## Dateien

1. `src/kernel/own-kuzu.ts`
2. `src/surface/host.ts`
3. `src/surface/import-code-verb.ts`
4. `src/surface/mcp-server.ts`
5. `src/surface/rewind.ts`
6. `src/surface/run-verb.ts`

Folgen: `tests/import-boundaries.test.ts`, ggf. ein Test, der `ownKuzu` direkt aufruft, dieser CR.
