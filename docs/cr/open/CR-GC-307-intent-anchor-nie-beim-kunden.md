# CR-GC-307 — Intent-Anker sind Steuerungsinternes: raus aus der Kundenfrage, rein in gezielte Fachfragen

**Status:** open · **Angelegt:** 2026-08-07 · **Max Files:** 5
**Herkunft:** Folge-CR zu CR-GC-295 (Zielprofil), Nutzer-Feedback 2026-08-07 aus einem
Frontier-LLM-Lauf.

## Problem

`src/generate.ts:182-189` schiebt dem Menschen in Runde 1 die Anker-Bestätigung hin:

> „Intentions-Anker (Default, aus der Intention extrahiert): … — vom Menschen
> bestätigen/korrigieren lassen und über den Skill `se:target-profile` in
> `.graphcode/target-profile.json` persistieren (Feld `intentAnchors`)."

Und `.claude/commands/se/target-profile.md` §2 macht daraus einen eigenen
Dialogschritt („Confirm the intent anchors").

Der Kunde kann damit nichts anfangen. „Intent-Anker" ist kein Begriff seiner Domäne,
sondern **unser Hilfskonstrukt**, um die App-Targets richtig einzustellen. Beobachtet:
das Frontier-LLM hat die vorgeschlagenen Anker später ohnehin stillschweigend
korrigiert — die Rückfrage hat also weder Information gewonnen noch Kontrolle
gegeben, nur Jargon in den Erstkontakt getragen. Bei einem lokalen/schwächeren Modell
ist derselbe Schritt zusätzlich eine Fehlerquelle.

Die Anker selbst sind richtig und bleiben: `graph_readiness.intentCoverage` misst an
ihnen, ob jedes Thema der Intention irgendwo in UC/REQ/FUNC ankommt. Falsch ist nur,
**wer** sie zu sehen bekommt.

## Entscheidung (2026-08-07, Nutzer, wörtlich)

> „der kunde kann und soll das Konzept hinter der steuerung gar nicht verstehen, er
> kann mit einem intent anchor nix anfangen. das ist dein hilfskonstrukt, um die
> richtigen app targets einzustellen. wenn der erste Kundeninput das nicht oder
> schlecht eindeutig hergibt, gezielte fragen stellen, dann die target konfig im
> hintergrund einstellen"

Daraus drei bindende Regeln:

1. **Der Begriff „Intent-Anker" erscheint nie in einer an den Menschen gerichteten
   Ausgabe.** Weder im Runde-1-Prompt noch im Skill-Dialog.
2. **Kein Bestätigungsschritt.** `extractIntentAnchors()` (`src/target-profile.ts:142`)
   setzt sie; die Config wird im Hintergrund geschrieben.
3. **Wenn die Intention zu dünn ist, wird gefragt — aber fachlich.** Nicht „bestätige
   diese Anker", sondern Fragen über das System in der Sprache des Kunden
   („Was passiert, wenn ein Kunde eine Bestellung storniert?", „Wer darf Preise
   ändern?"). Aus den Antworten werden die Anker abgeleitet, ohne dass der Begriff fällt.

### Wann gilt „zu dünn"? (deterministisch, nicht nach Gefühl)

Auslöser für die Fachfragen ist ein messbarer Zustand von
`extractIntentAnchors(intent)`, nicht eine Modell-Einschätzung:

- **< 3 Anker** — die Intention trägt nach Stopword-Filter keine 3 Inhaltswörter.
  `intentAnchors` ist per Schema `min(3)` (`src/target-profile.ts:46`), es gäbe also
  gar keine gültige Config.
- **Anker ohne Trennschärfe** — nur generische Tokens (`system`, `app`, `tool`,
  `daten`, `verwalten`). Die Stopword-Liste wird um diese Klasse erweitert; was danach
  übrig bleibt, ist die Messgröße.

Genau **einer** dieser beiden Zustände löst die Fachfragen aus. Trifft keiner zu,
wird nicht gefragt — die Anker werden still gesetzt.

### Was der Mensch weiterhin sieht

Die **Wirkung**, nie den Mechanismus. Die Coverage-Zeile in späteren Runden
(`generate.ts:211-220`) formuliert um — von

> „Unadressierte Intentions-Anker: bestellung, ersatzteile — in passenden UC/REQ/FUNC adressieren."

nach Klartext:

> „Noch nirgends beschrieben: Bestellungen, Ersatzteile. Fehlt dazu ein Use Case?"

`se:target-profile` bleibt als expliziter Skill für den, der die Steuerung *bewusst*
anfassen will — dort darf der Begriff stehen, weil ihn dort nur jemand aufruft, der
ihn sucht. Das ist kein Parallelpfad: die Config bleibt **eine** Datei, mit **einem**
Loader und **einem** Konflikt-Check (CR-GC-295-Invariante), egal wer schreibt.

## Umsetzung

1. `src/generate.ts` — `anchorNote` ersetzen: keine Bestätigungsbitte mehr. Bei
   ausreichenden Ankern **stiller** Config-Write; bei zu dünner Intention stattdessen
   eine Instruktion an das generierende Modell, 2–3 **fachliche** Rückfragen zu
   stellen (Muster + Verbot des Begriffs im Prompt-Text). Coverage-Zeile auf Klartext.
2. `src/target-profile.ts` — Stopword-Liste um die generische Klasse erweitern;
   `extractIntentAnchors` unverändert in der Signatur. Neue Hintergrund-Persistenz
   (Anker schreiben, ohne bestehende `weights` zu überschreiben — Merge, kein
   Überschreiben; ein hand-gepflegtes Zielprofil darf nicht verloren gehen).
3. `.claude/commands/se/target-profile.md` — `version: 2`. §2 („Confirm the intent
   anchors") wird zum Experten-Abschnitt mit explizitem Hinweis, dass der Begriff
   nicht in den Erstkontakt gehört.
4. `tests/target-profile.test.ts` + `tests/generate.test.ts` — s. AC.

## Akzeptanzkriterien

- [ ] **red-first** für jeden neuen Test nachgewiesen
- [ ] grep über jede an den Menschen gerichtete Ausgabe (`generate.ts`-Prompts,
      `report.ts`-Texte): **kein** „Intentions-Anker" / „intent anchor" / „intentAnchors"
      mehr. Test, nicht Review — sonst kriecht der Begriff zurück
- [ ] Unit: Intention mit ≥3 trennscharfen Inhaltswörtern → Anker werden still in
      `.graphcode/target-profile.json` geschrieben, **keine** Rückfrage im Prompt
- [ ] Unit: Intention mit <3 Ankern → Prompt enthält die Fachfragen-Instruktion und
      **keine** Anker-Liste
- [ ] Unit: Intention nur aus generischen Tokens („ein System zum Verwalten von Daten")
      → gilt als zu dünn, Fachfragen-Pfad
- [ ] Unit: Hintergrund-Write **merged** — bestehende `weights` in einer vorhandenen
      Config überleben das Schreiben der Anker (Regression gegen Datenverlust)
- [ ] Unit: Coverage-Zeile in Runde n enthält Klartext, keinen Begriff aus dem
      Steuerungsmodell
- [ ] `intentCoverage` in `graph_readiness` bleibt **funktional unverändert** — es ist
      ein Maschinen-Read-out, kein Kundentext (Regressionstest aus CR-GC-295 grün)
- [ ] Determinismus: gleiche Intention → gleiche Anker, gleicher Prompt (N=1-Test aus
      CR-GC-295 unverändert grün)
- [ ] `npm run build` + volle Suite grün

## Dateien (5)

1. `docs/cr/open/CR-GC-307-intent-anchor-nie-beim-kunden.md` (dieses Dokument)
2. `src/generate.ts`
3. `src/target-profile.ts`
4. `.claude/commands/se/target-profile.md`
5. `tests/target-profile.test.ts` + `tests/generate.test.ts`

## Abhängigkeiten

- **CR-GC-295 — aufgelöst (2026-08-07).** Lag als Lifecycle-Drift in `open/`, obwohl alle
  10 AC abgehakt waren; ist nach `docs/cr/done/` verschoben und trägt dort die
  Folge-CR-Notiz auf dieses CR. Damit editieren nicht mehr zwei offene CRs dieselben
  vier Dateien mit gegenläufiger Absicht.
- **Reihenfolge gegen den `generate.ts`-Hotspot:** `src/generate.ts` +
  `tests/generate.test.ts` stehen auch im Scope von **CR-GC-302** (Auto-SYS) und
  **CR-GC-303** (Steering-Blindheit). Dieses CR läuft **zuletzt** — es ändert nur
  Prompt-Text und Config-Persistenz, während 302/303 die Regel-/Anker-Semantik
  darunter bewegen. Umgekehrte Reihenfolge hieße, die Formulierungen zweimal zu machen.
