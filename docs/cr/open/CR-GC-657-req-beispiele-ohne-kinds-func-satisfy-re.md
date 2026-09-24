# CR-GC-657: REQ-Beispiele ohne kinds — FUNC satisfy REQ wird illegal (auch das SYSTEM-Beispiel selbst)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-559 (bug)
**Erstellt:** 2026-09-24
**Item:** bok/items/ITEM-2026-559.json (Lane: code)

---

## Befund

contracts `TRACE_PATTERNS`: `FUNC satisfy REQ` nur fuer REQ-`kinds` aus {functional, precondition,
postcondition}; `MOD`/`SYS satisfy REQ` nur fuer {non-functional, risk, mitigation}; `FCHAIN`
ohne Einschraenkung. Das Format-E-Beispiel im Executor-SYSTEM (CR-GC-650/654) zeigte eine
Latenz-REQ **ohne** kinds und `FUNC -satisfy->` darauf — selbst ein illegales Paar. Der Skill
`author-req` legte REQs ebenfalls ohne kinds an. Im Rig geblockt (Preflight, `FUNC satisfy REQ`,
je drei Laeufe): 8 (vor 649) → 15 (650, 654) → 24 (655).

## Umsetzung

- SYSTEM: Beispiel-REQ mit `@kinds ["functional"]`, legale Beispielkante, ein Satz zur kinds-Regel.
- `author-req`: `@kinds` im Beispiel und die Zuordnung kinds → Erfueller.
- RD-01-Klausel: nennt die kinds-Regel und den Patch (`~ REQ-x|Text` + `@kinds [...]`).

## Dateien (6)

`src/loop/executor-prompt.ts`, `src/loop/generate.ts`, `.claude/commands/se/author-req.md`,
`tests/executor.test.ts`, `tests/executor.round-injection-suggest-skill.test.ts`, diese Datei.

## Akzeptanzkriterien

- [x] Das GANZE SYSTEM-Beispiel (Knoten-Batch, dann reiner Kanten-Batch) geht am echten Store
      durchs Gate — rot auf dem alten Beispiel.
- [x] Der kinds-Patch der RD-01-Klausel macht eine REQ ohne kinds fuer FUNC erfuellbar (am Store).
- [x] Der injizierte author-req-Ausschnitt traegt `@kinds`.
- [ ] Rig (gcrun, N=3) gegen gcrun-70..72 (655): `FUNC satisfy REQ`-Blocks deutlich weniger,
      Ablehnungen nicht mehr, Elemente/Readiness nicht schlechter.
