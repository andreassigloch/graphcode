# CR-GC-475 — Die Composition Root gehört der Oberfläche (B1)

**Status:** done · **Angelegt:** 2026-09-03 · **Abgeschlossen:** 2026-09-03 · **Herkunft:** CR-GC-467, Strang B (Barrel-Importe
von innen); erster von zwei Schritten

## Root Cause

Sieben Dateien importieren `../index.js` — das Paket-Barrel — von innen: sechs aus `surface`, eine
aus `kernel`. Sie holen dort nicht „das Paket", sondern drei Dinge, die im Barrel **definiert**
statt nur re-exportiert sind: `createHarness` (index.ts:189), `KUZU_DIR` (index.ts:173) und den
Typ `GraphCodeHarness` (der eigentlich aus `kernel/harness` kommt).

`createHarness` verdrahtet Kuzu-Adapter, Hook-System **und** die Live-Update-Emitter aus
`surface/emit` — eine Composition Root. Sie liegt in der Wurzel, weil das Barrel zuerst da war,
nicht weil sie dort hingehört: sie komponiert Kern **mit** Oberfläche, also ist sie Oberfläche.
`KUZU_DIR` ist der Store-Pfad — Kern.

## Änderung

- `src/surface/create-harness.ts` (neu): `createHarness` verbatim aus `index.ts`, mit Docblock.
- `src/kernel/workspace.ts` (neu): `KUZU_DIR`. (`GRAPHCODE_DIR`/`TRAJECTORY_FILE` aus
  `surface/scaffold-templates` folgen in C3 — hier nur, was B braucht; kein Doppel.)
- `index.ts`: die zwei Definitionen raus, **Re-Export** beider aus ihrer neuen Quelle — das Barrel
  bleibt die Paket-Oberfläche (12 Tests und externe Konsumenten importieren `createHarness` dort);
  ein Re-Export im Barrel ist dessen Aufgabe, kein paralleler Pfad.
- `surface/scaffold.ts`: `KUZU_DIR` aus `../kernel/workspace.js`.
- `surface/host.ts`: `GraphCodeHarness` als Typ aus `../kernel/harness.js`.
- Ratchet **25 → 23**. Gate: `FUNC-create-harness` — `realRef.file` → `src/surface/create-harness.ts`,
  `allocate` von `MOD-kernel` nach `MOD-surface`.

**Nicht hier (B2, CR-GC-476):** `kernel/own-kuzu.ts` und die vier Verben. `own-kuzu` bleibt im Kern
— CR-GC-446/447 haben die Ein-Besitzer-Invariante bewusst dorthin gelegt; der Kern darf nur nicht
selbst zur Composition Root greifen. B2 injiziert `createHarness` aus `surface/host.ts`.

## Akzeptanzkriterien

- [x] `index.ts` definiert keine Funktion und keine Konstante mehr, nur Re-Exporte (225 → 171 Zeilen).
- [x] Build grün; `cli.scaffold` (44), `host-shim`, `host.bridge-attach`, `bootstrap`, Ratchet grün (60/60);
      volle Suite im Pre-Commit grün.
- [x] Gate: dryRun 0 Blocker, apply (graphVersion 238 → 239), Export — Diff = ein `realRef.file` + eine
      `allocate`; Fit-Advisory `coherence −0,020`, `modifiability −0,007` (die Root wandert ins größere Modul).

## Dateien

1. `src/surface/create-harness.ts` (neu)
2. `src/kernel/workspace.ts` (neu)
3. `src/index.ts`
4. `src/surface/scaffold.ts`
5. `src/surface/host.ts`

Folgen: `tests/import-boundaries.test.ts`, SSOT-Export, dieser CR.
