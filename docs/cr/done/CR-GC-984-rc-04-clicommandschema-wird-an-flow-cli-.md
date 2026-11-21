# CR-GC-984: RC-04 in surface: CLI-Verb und Update-Ereignis werden an der Grenze geparst

**Typ:** aus Item ITEM-2026-1474 (finding)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1474.json (Lane: code)

---

## Befund

Folge von CR-GC-982 (Klassifikationstabelle aller 23 dort). Klasse (a) und (c) in surface:

- **cli-command (ITEM-2026-1474).** `CliCommandSchema` ist `init|update|remove`, die Aktion des Installers (`scaffold.ts:87`), und steckt in `InstallResultSchema.action`. Der FLOW `FLOW-cli-command` trägt aber das Verb, das `main` aus `process.argv[2]` liest; die CLI kennt 11 Verben (`cli-args.ts`), und `main` schaltete den rohen String. Das SCHEMA war falsch gebunden (c) und das Verb wurde nirgends geparst (a).
- **update-event.** `makeUpdateEventHook` und `makeResetEventHook` (`emit.ts`) erzeugen das Ereignis, das `broadcast` (`host.ts`) auf den SSE-Draht schreibt; `LiveUpdateEventSchema` wurde nirgends geparst.

## Änderung

- `cli-args.ts`: `CliVerbSchema` (z.enum der 11 Verben); die Verbtabelle `VERBS` ist `Record<CliVerb, …>`, der Compiler hält Schema und Tabelle gleich. `checkVerbArgs` nimmt ein `CliVerb`; die Zeile „unbekanntes Verb → run“ entfällt.
- `cli.ts` `main`: `CliVerbSchema.safeParse(process.argv[2])` vor allem anderen; kein Verb oder `-h`/`--help` → Usage, Exit 0; sonst unbekannt → Meldung und Exit 1 (gleiche Meldung wie vorher). `switch (verb)` ohne `default` und ohne die Fälle `undefined`, `-h`, `--help`.
- `emit.ts`: beide Hooks parsen das Ereignis vor der Senke. Ein Bruch wirft; ein post-apply-Hook blockt nie, der Runner hält den Fehler fest (`hooks.ts`).
- Modell: `SCHEMA-cli-command` bindet `CliVerbSchema` in `cli-args.ts` (vorher `CliCommandSchema`), Beschreibung und `@contract` berichtigt, `external` auf false (ein Verb der eigenen CLI ist kein Fremd-API-Vertrag). `CliCommandSchema` bleibt Aktion des Installers (an `SCHEMA-install-result`).

## Entscheidungen

keine. Offen beim Autor: `SCHEMA-cli-command` hängt weiter an FLOW, die kein Verb tragen (`FLOW-cli-output`, `FLOW-import-summary`, `FLOW-render-file`, `FLOW-gve-attach`, `FLOW-gve-stop`, `FLOW-session-end`, `FLOW-viewer-start`). Welcher Vertrag sie trägt, ist eine Modellfrage je FLOW (CR-GC-959), nicht Teil dieses CR.

## Umfang laut `graph_impact`

`FUNC-cli-dispatch`, `FUNC-emit-update-event`, `SCHEMA-cli-command`, `SCHEMA-update-event`. Verhalten der CLI unverändert (FAQ verhaltensgleichheit): gleiche Meldungen, gleiche Exit-Codes.

## Nachweis rot-zuerst

- Update-Ereignis mit Version `NaN`: vor der Änderung gelangte es in die Senke (3 Fälle rot: Invalidate, Reset und das fehlende Schema), danach wirft der Erzeuger und die Senke bleibt leer.
- `CliVerbSchema` fehlte: 2 Fälle rot (`options`/`safeParse` auf `undefined`). Der Prozesstest (`graphcode bogus` → Exit 1, `unknown command "bogus"`; `graphcode status --help` → Exit 0) war vor der Änderung schon grün bzw. rot nur wegen des fehlenden Schemas; er hält das Verhalten fest (verhaltensgleich).
- Smoke: `node dist/cli.js status` startet; `node dist/cli.js bogus` Exit 1 mit Meldung; `node dist/cli.js init --chek` Exit 1 „unbekanntes Flag“; `node dist/cli.js upgrade --check` läuft.

## Abschluss

RC-04 17 → 15 (cli-command und update-event aus der Liste). `verify:code`: 73 Dateien, 755 Tests grün. ITEM-2026-1474 ist mit diesem CR erledigt. Kein Volllauf je CR (nach CR-GC-982 zehn CODE-CR ohne Schlupf).
