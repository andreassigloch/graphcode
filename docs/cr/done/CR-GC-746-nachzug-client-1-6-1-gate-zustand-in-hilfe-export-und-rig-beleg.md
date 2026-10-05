# CR-GC-746: Nachzug graphcode-client 1.6.1 — der Zustand des Gates in Hilfe und Export, Beleg am Rig

**Status:** ✅ Done (2026-10-05)
**Typ:** aus Item ITEM-2026-757 (finding)
**Erstellt:** 2026-10-05
**Item:** bok/items/ITEM-2026-757.json (Lane: code)
**Deckt:** sigloch-modules CR-SM-394 (Commit 6dff232, unveröffentlicht).
**Schnitt:** Teil 2 von 2, baut auf CR-GC-745 (`749fa70`: Messung, `stateLabel` am Werkzeug).

---

## Befund

Nach CR-GC-745 trägt `graph_readiness` den Zustand. Drei Stellen beschreiben oder lesen ein Gate noch
zweiwertig:

- `graph_help` ohne Token (`contextualHelp`): liest je Gate `blocking` und sonst die Befunde. Ein nicht
  durchschrittenes Gate hat ein leeres `blocking` — ein sauberer Entwurf ergibt `{"measures":[]}`. Eine
  leere Maßnahmenliste liest wie „alles bestanden".
- `graph_help({token:"TRR"})`: „**Pass** / **Red**" — zwei Zustände.
- `graph_help({token:"graph_readiness"})`: beschreibt `phaseGates` und `phase_readiness` ohne Zustand.

## Umsetzung

- `src/projections/help.ts`: `contextualHelp` führt jedes Gate mit `state === 'not-reached'` als eigene
  Maßnahme — `blockerKind: 'not-reached'` (dritter Wert neben `rule` und `creation`), `severity: 'info'`,
  `gateId`, `entry` = der Hilfe-Eintrag des Gates, `message` = Gate-Name und Anzeigetext
  (z. B. „Test Readiness Review: nicht durchschritten"). `info`, weil es kein Befund ist: dort ist noch
  nichts zu tun. Der Zustand wird am Gate gelesen, nicht aus `blocking`/`completeness` abgeleitet.
- `src/projections/help-content.ts`, Eintrag `TRR`: dritter Absatz „Not reached" mit dem Anzeigetext aus
  `GATE_STATE_LABELS` und der Bedingung in Alltagssprache. SRR/PDR/CDR bleiben zweiwertig — an ihnen
  gibt es kein Bein mit Vorbedingung (CR-SM-394, Zählung).
- `src/projections/tool-help.ts`, `graph_readiness`: `phaseGates` nennt `state`, `stateLabel` (die drei
  Texte aus `GATE_STATES`/`GATE_STATE_LABELS` gebildet, nicht abgeschrieben) und dass `score` 1 und
  `completeness` 0/0 kein Bestehen sind; `phase_readiness` nennt denselben `state`. Die
  Werkzeug-BESCHREIBUNG (tools/list-Budget) ist unverändert — die Semantik steht auf Abruf (CR-GC-612).
- `src/index.ts`: `GATE_STATES`, `GATE_STATE_LABELS`, `type GateState` im öffentlichen Export, neben
  `GatePanel`, das den Zustand seit 1.6.1 trägt.
- `CLAUDE.md`: „A concept-only TEST" → „An unbound TEST" — das Attribut `concept` gibt es seit
  CR-GC-744 nicht mehr.

## Rig und Auswertung — geprüft, nichts umgebaut

`auswertung/nachspielen.mjs:87` (`[x.id, x.passed]`), `rig/simulator.mjs` (`ZIEL.modellieren`:
`gates.SRR && gates.PDR`), `rig/treiber.mjs` (Protokoll, Konsolenzeile SRR/PDR),
`auswertung/kennzahlen.mjs` (`gateZug` für SRR und PDR), `auswertung/auswerten.mjs` (Gates des letzten
Zugs) lesen den Boolean. `passed` ist aus `state` abgeleitet, SRR und PDR tragen kein Bein mit
Vorbedingung — das Ende der Modellierstufe ändert sich nicht.

Als Test festgehalten (`auswertung.test.ts`, Nachbau des Referenzgraphen todo/lokal am echten Gate):
der Graph ist ein Entwurf, `gates.SRR`/`gates.PDR` sind `true`, `ZIEL.modellieren` meldet `srr+pdr`,
`gates.TRR` ist `false`, `phaseGates` liest `SRR passed · PDR passed · TRR not-reached`.

Folge, ausgewiesen: neue Läufe schreiben `TRR: false` ins Protokoll; die eingefrorenen
(`rig/aufgaben/*/referenz/*/lauf.json`, `docs/messung/benchmark.jsonl`) tragen `TRR: true` nach altem
Stand und sind nicht angefasst. Keine Kennzahl liest TRR.

## Tests

| Datei | Fall |
|---|---|
| `help` | **neu**, drei Fälle: Entwurf → genau eine Maßnahme `not-reached` an TRR mit Anzeigetext · Positivkontrolle mit einer Bindung → keine · Eintrag `TRR` und Werkzeug-Hilfe tragen die Texte der Tabelle, SRR/PDR/CDR nicht. Rot zuerst: Fall 1 (`[]` statt `['TRR']`) und Fall 3 vor der Änderung rot. |
| `auswertung` | Fall „leeres Audit auf der Basis" um den Rig-Beleg erweitert (s. o.). |

## Nicht Teil dieses CR

- **graph-view-edit** `src/dashboard/Dashboard.jsx:58` rechnet `g.passed ? 'passed' : 'open'` selbst und
  zeigt an einem nicht durchschrittenen Gate „offen" ohne Eintrag — dort auf `g.state` und
  `GATE_STATE_LABELS` umstellen (eigenes Repo).
- `.claude/commands/se-review.md` nennt das Phasenmodell SRR/PDR/CDR/TRR „not yet defined" — älterer
  Stand, unabhängig von diesem Nachzug.
- Modell: der CR-Knoten und das Feld `state` an `SCHEMA-phase-readiness` fehlen (laufender Host tabu).

## Verifikation

- `npm run build` / `type-check` grün gegen die verlinkte Arbeitskopie (graphcode-client 1.6.1, Stand 6dff232).
- `npm run verify:code`: fiel auf die volle Spur (`src/index.ts` hat keinen Modellknoten).
- `npm run verify:full CR-GC-746` (2026-10-05): 202 Dateien, 1781 Tests grün, 2 rot —
  `tests/lockfile-sync.test.ts` und `tests/distribution.test.ts`, beide im Link-Modus erwartet. Spur VOLL,
  Schlupf 0, Folge 0/10 (zurückgesetzt durch den Schlupf in CR-GC-745).
- CR von Hand angelegt, nicht über `aise dispatch prepare` (laufender Host); `crRefs` im Item und der
  CR-Knoten im Modell fehlen — nachzuziehen.
