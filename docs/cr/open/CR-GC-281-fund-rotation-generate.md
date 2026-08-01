# CR-GC-281 — Fund-Rotation/Defer in graph_generate (Folge zu CR-GC-278/280)

**Status:** open
**Datum:** 2026-08-01

## Ziel

Ein festgefahrener Fund darf den Executor-Lauf nicht mehr monopolisieren:
`graph_generate` kann Fund-Sets deterministisch zurückstellen (defer) und
fokussiert dann den nächstschwächeren Fund bzw. die nächstschwächere Dimension.
Der Executor stellt nach 3 Stagnations-Runden automatisch zurück.

## Root Cause

`generationStep()` fokussiert IMMER die schwächste Dimension mit Funden und
darin die ersten (deterministisch sortierten) bis zu 3 Violations. Löst das
Modell einen Fund nicht (v11-Befund: UID-Verwechslung bei einer verify-Kante),
wird derselbe Fund ENDLOS refokussiert — im v11-Lauf stagnierten 43 von 48
Runden, ein einzelner Fund fraß 31 Runden. Der bestehende Stagnations-Detektor
im Executor (identischer gen.prompt → Eskalations-Hinweis) wirkt nur über
Prompt-Druck, also stochastisch. Es fehlt ein DETERMINISTISCHES Ausweichen.

## Scope (max 6 Dateien)

1. `docs/cr/open/CR-GC-281-fund-rotation-generate.md` (dieses Dokument)
2. `src/generate.ts` — `GenerationStep.focusKey: string | null` (stabiler
   Identifikator des fokussierten Fund-Sets:
   `${dimension}:${element_ids sortiert, komma-getrennt}`; null ohne Fokus).
   `generationStep(graph, intent?, threshold?, defer?: string[])`: Fokus-Wahl
   überspringt Kandidaten-Fenster (3er-Schritte der sortierten Violations),
   deren focusKey in defer liegt — erst innerhalb derselben Dimension, dann die
   nächstschwächere Dimension. Sind ALLE Kandidaten deferred, wird defer
   ignoriert (kein Dead-End) und das im Prompt kenntlich gemacht.
3. `src/tools/suggest.ts` — `graph_generate`-Input um
   `defer: z.array(z.string()).optional()` erweitern, an `generationStep`
   durchreichen; Tool-Description knapp ergänzen.
4. `src/executor.ts` — `const deferred = new Set<string>()` pro Lauf; erreicht
   der bestehende `stagnation`-Zähler 3, wird `gen.focusKey` (falls vorhanden)
   aufgenommen (`trace: defer: <focusKey>`); jeder folgende
   `graph_generate`-Call trägt `defer: [...deferred]`. stagnation/lastGenPrompt
   resetten sich über den bestehenden Prompt-Vergleich automatisch, sobald der
   Fokus wechselt.
5. `tests/generate.test.ts` — Unit: (a) focusKey stabil/deterministisch,
   (b) defer überspringt den Fund (anderer prompt, anderer focusKey),
   (c) alles deferred → Fallback ohne Dead-End, Hinweis im Prompt.
6. `tests/executor.test.ts` — Integration (Disk-Kuzu, scriptedModel): Modell
   löst den Fund nie → nach 3 identischen Runden enthält der nächste
   `graph_generate`-Call `defer` und der Prompt wechselt.

## Akzeptanzkriterien

- [ ] `generationStep` deterministisch: gleicher Graph + Intention + defer ⇒
      identischer Schritt inkl. focusKey
- [ ] defer rotiert: zurückgestellter focusKey wird übersprungen (nächstes
      Fund-Fenster derselben Dimension, sonst nächste Dimension)
- [ ] Alles deferred ⇒ kein Dead-End: defer wird ignoriert, Prompt sagt es
- [ ] Executor deferred nach Stagnations-Schwelle 3 automatisch, Trace-Zeile
      `defer: <focusKey>`, Folge-Prompt wechselt
- [ ] `npm run build` + betroffene Suiten (generate, executor, cli.run,
      mcp.symmetry) grün

## Out of Scope / Folge-Punkte

- **Keine neue Rule, kein Duplikat-SYS-Guard** — das ist
  `@sigloch/contracts`-Territorium (Familie-Review + Version-Bump, Drift-Lock
  L1/L2). Der v11-Auslöser (UID-Verwechslung/Duplikat-Anlage) bleibt als
  Kandidat für einen contracts-CR notiert.
- Keine Änderungen an `@sigloch/contracts`.
- GATE_PROTOCOL/Template-Texte unverändert bis auf den defer-Hinweis.
- Validierungslauf (v12, lokale Box) steht aus — CR bleibt bis dahin in open/.
