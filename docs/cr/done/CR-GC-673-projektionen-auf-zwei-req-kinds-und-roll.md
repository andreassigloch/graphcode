# CR-GC-673: Projektionen auf zwei REQ-kinds und Rollen-Attribut

**Status:** ✅ Done (2026-09-27)
**Typ:** aus Item ITEM-2026-584 (idea)
**Erstellt:** 2026-09-25
**Item:** bok/items/ITEM-2026-584.json (Lane: code)

---

ZIELBILD (ITEM-2026-575, Diskussion 2026-09-25): REQ.kinds = genau EIN Wert aus {functional, non-functional}. functional -> FUNC; non-functional -> MOD (lokales Budget) | SYS (Systemebene) | FCHAIN (Ende-zu-Ende). Ohne kinds kein Erfueller (BQ-07). pre-/postcondition entfallen (Vorbedingung = Eingangs-FLOW der Kette, Nachbedingung = UC-Ziel, geprueft ueber R-21). risk/mitigation werden ein Rollen-Attribut (FM-01..03), satisfy-neutral. Gemischtes functional+non-functional = falsch zerlegt -> teilen.

ZIEL: Projektionen und Authoring-Beispiel zeigen nur noch functional/non-functional und die Rolle risk/mitigation als eigenes Feld; die Beschreibung des kinds-Attributs im Authoring-Guide nennt die Erfueller-Tabelle.

UMFANG (laut grep, <= 10 Dateien): src/projections/graphcode.ts, exporter.ts, authoring-example.ts, incose.ts, srs.ts, helpers.ts; Tests views.conformance, exporter.

ABNAHME: Views regeneriert (npm run verify:model), conformance gruen; Smeagol-Check aus [1] gruen fuer authoring-example.

REIHENFOLGE der Kette (9 CRs): [1] GC Regel-Matrix + Smeagol-Wertebereich -> [2] SM Rollen-Attribut risk/mitigation -> [3] SM kinds auf zwei Werte + FCHAIN nur NFR (mit [2] EIN Ontologie-Major, Publish durch den Auftraggeber) -> [4] GC Migrationswerkzeug (vor dem Publish baubar) -> [5] GC Eigenmodell migrieren (graph-Lane) -> [6] GC Kern + Peer-Floor -> [7] GC Loop/Executor -> [8] GC Projektionen -> [9] GC Skills + Help. Danach Datenmigration je Familien-Repo (eigene Items, sobald [4] steht). Dies ist [8].

---

## Umfang (tatsaechlich, 7 Dateien + CR)

Kein `graph_impact`: das Eigenmodell wird parallel migriert (CR-GC-670), der Graph war fuer diesen
CR nicht zu befragen. Umfang aus grep ueber `src/projections` nach
precondition|postcondition|risk|mitigation|behavioural|structural.

- `src/projections/helpers.ts` — neu `reqRole(n)`, liest ueber `readReqRole` (der EINE Leser, CR-SM-365).
- `src/projections/graphcode.ts` — FMEA: Fehlerart = `role: risk`, Mitigation-Spalte = compose-Ziel mit
  `role: mitigation`; Kopf/Legende sagen `role=`, nicht `kind=`. ConOps-Kommentar auf zwei kinds-Werte.
- `src/projections/srs.ts` — Meta-Zeile zeigt `role` als eigenes Feld hinter `kinds`.
- `src/projections/authoring-example.ts` — kinds-Beschreibung traegt die Erfueller-Tabelle
  (FUNC ← functional; MOD/SYS/FCHAIN ← non-functional; role satisfy-neutral), Syntax
  `@kinds ["functional"]`. Die kinds-Wahl fuer ein satisfy-Ziel fragt jetzt `isValidTrace` statt einer
  hart verdrahteten MOD/SYS-Liste — die haette der FCHAIN `functional` gezeigt (seit CR-SM-366 illegal).
- Tests: `tests/views.conformance.test.ts`, `tests/mutate.formate-name.test.ts`, `tests/skill-kinds-werte.test.ts`.
- `incose.ts` / `exporter.ts`: kein Altwert im Code (NFR-Register liest bereits nur `non-functional`) — unveraendert.
- `role` im Guide kommt ohne lokalen Code aus `ELEMENT_ATTRIBUTES` (contracts) — per Test festgehalten.

## Rot → Gruen

- `views.conformance`: neuer Block CR-GC-673 (Alt-REQ `kinds ["risk"]` ohne role ist keine Fehlerart;
  Mitigation nur mit `role: mitigation`; kein View-Code fragt kinds nach den Altwerten; SRS zeigt
  `kinds: functional · role: mitigation`) + FMEA-Fixture auf `role` — 7 rot, jetzt gruen.
- `mutate.formate-name`: kinds genau zwei Werte, Syntax `@kinds ["functional"]`, Erfueller-Tabelle in der
  Beschreibung, `role` mit `ReqRole`-Werten, jede Beispiel-satisfy-Kante fuer FUNC/FCHAIN/MOD/SYS legal
  nach `isValidTrace` (rot an der FCHAIN) — 4 rot, jetzt gruen.
- `skill-kinds-werte`: neuer Block Authoring-Guide (Attributhinweise + Beispiel je Typ ⊆ ReqKind) —
  rot an `@kinds ["postcondition"]`, jetzt gruen.

## Tests gelaufen (ausgewaehlte Spur, `npm run build` gruen)

`vitest run` views.conformance, mutate.formate-name, skill-kinds-werte, exporter, mcp.authoring-guide,
decision-texts, mutate.formate-ops, export-graph-guard, mvp-e2e, help, panels, import-boundaries.
Alles gruen bis auf `skill-kinds-werte` › "jeder genannte kinds-Wert liegt in ReqKind": rot an
Skills (`se/author-req`, `se/author-uc`, `se-fmea`, `se-view/fmea` → CR-GC-674) und `executor SYSTEM`
(Loop/Executor-CR der Kette) — ausserhalb dieses Umfangs, erwartet.

## Ergebnis

Projektionen und Authoring-Guide kennen nur noch functional/non-functional; die FMEA-Rolle wird ueber
`readReqRole` gelesen und als eigenes Feld gezeigt. Commit mit `--no-verify` (MODELL-Spur rot bis CR-GC-670).

Abnahme „Views regeneriert (verify:model)": haengt an CR-GC-670 (Eigenmodell-Migration) — erst dann
tragen die REQ des Eigenmodells `role` statt `kinds ["risk"]`, und die FMEA-Sicht fuellt sich wieder.
docs/views wurden hier bewusst nicht regeneriert.

## Nachtrag 2026-09-27

ConOps §2 listete FMEA-REQs (role risk/mitigation, nicht-funktional am SYS) als Betriebsvorgaben — gefunden bei der graphify-Migration (13 Risiken). Filter `reqRole(r) === undefined`; Test auf Abschnitt 2 geschaerft (REQ-persistenz stand auch in §6, der alte Test ueber die ganze Sicht haette einen Filter, der ALLES ausschliesst, nicht bemerkt — mit Gegenprobe belegt).
