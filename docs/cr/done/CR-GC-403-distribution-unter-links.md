# CR-GC-403 — `distribution.test.ts` kann unter verlinkten Siblings nicht prüfen

**Status:** **done** — 2026-08-25 · **Angelegt:** 2026-08-22 · **Umsetzung:** dieses Repo
**Datei:** `tests/distribution.test.ts`
**Herkunft:** Befund beim Abschluss von [CR-GC-399](../done/CR-GC-399-verify-model-spur.md).

## Problem — gemessen

```
FAIL tests/distribution.test.ts > installs each @sigloch package exactly once,
     and none depends on itself
AssertionError: expected 0 to be greater than or equal to 5
```

Der Test läuft `readdirSync(node_modules/@sigloch, { withFileTypes: true })` und überspringt jeden
Eintrag mit `!entry.isDirectory()`. Bei einem **Symlink** ist `isDirectory()` `false` — nach
`npm run link:siblings` sind alle sieben `@sigloch/*` Symlinks, der Walk findet null Manifeste.

Sein eigener Wächter fängt das korrekt ab (*„the guard is worthless if it walked an empty tree"*).
Der Befund ist also nicht „falsches Ergebnis", sondern: **der Test kann in diesem Zustand seine
Aufgabe nicht erfüllen und sagt es als Fehlschlag**, ununterscheidbar von einem echten Regress.

## Warum das mehr ist als ein Schönheitsfehler

`link:siblings` ist ein **normaler Arbeitszustand** der Familie (CLAUDE.local.md: die bewusste
Umschaltung auf Arbeitskopien). Gemessen am 2026-08-22: eine parallel laufende Session hat ihn in
diesem Repo hergestellt, um ein unpubliziertes `contracts@6.2.0` zu testen. In diesem Zustand ist
die volle Suite **dauerhaft rot mit einem Fehler, der nichts bedeutet** — und ein roter Test, der
regelmäßig nichts bedeutet, wird ignoriert. Genau so ist der ETARGET-Fehlschlag vom 2026-08-19
durchgerutscht, obwohl derselbe Test ihn gesehen hatte.

## Änderung (Vorschlag)

Der Test muss die drei Zustände **unterscheiden**, statt zwei davon auf denselben Fehlschlag zu
werfen:

| Zustand | heute | soll |
|---|---|---|
| Registry-Deps, sauber | grün | grün |
| Registry-Deps, Self-Dep/Dublette | rot | rot |
| Verlinkte Siblings | rot (bedeutungslos) | **übersprungen mit Begründung** |

Konkret: Symlinks auflösen (`lstatSync` → `realpathSync`), den Walk auf dem aufgelösten Pfad
fortsetzen, und wenn die Menge **ganz** aus Symlinks besteht, den Test mit `it.skip`-Semantik und
einer Meldung beenden, die den Zustand benennt (`node_modules/@sigloch ist verlinkt — dieser Test
prüft die Registry-Auflösung und ist hier gegenstandslos; `npm install` stellt ihn her`).

Kein stiller Deckel: das Überspringen muss in der Ausgabe stehen.

> **Abweichung bei der Umsetzung (2026-08-25):** der erste Halbsatz — Symlinks auflösen und den
> Walk auf dem aufgelösten Pfad fortsetzen — ist **nicht** umgesetzt. Er wurde schon in CR-GC-404
> verworfen, und die Begründung trägt: der Guard prüft, ob **npm** ein Paket zweimal ausgelegt hat.
> Ein aufgelöstes Workspace-Verzeichnis ist keine Installation; er würde dort etwas anderes messen
> und trotzdem grün melden. Die Forderung dieses CR — die drei Zustände unterscheiden — ist ohne
> das Auflösen erfüllt, s. u.

## Abgrenzung

Nicht Teil dieses CR: ob die Suite überhaupt unter verlinkten Siblings laufen soll. Sie soll — nur
darf ein gegenstandsloser Test nicht wie ein Regress aussehen.

## Umsetzung (2026-08-25)

CR-GC-404 hatte am 2026-08-23 die halbe Strecke gemacht: Symlinks überspringen statt scheitern,
plus einen Fixture-Fall für die Walk-Logik. Was fehlte, war die **Unterscheidung** — und dort saß
ein echter Defekt.

**Root Cause des Rests:** das Überspringen hing an `links.length > 0`, also an *irgendeinem*
Symlink. Damit sind drei verschiedene Lagen auf denselben Ausgang gefallen:

| Baum | vor diesem CR | jetzt |
|---|---|---|
| alle Einträge Symlinks | übersprungen | übersprungen (unverändert) |
| **teilweise** verlinkt (`npm link` auf EIN Schwester-Repo) | **still übersprungen** — der Guard deckelte die echten Verzeichnisse mit ab | geprüft; die Links stehen mit Namen in der Ausgabe |
| leer | rot über den `>= 5`-Boden, ohne Begründung | rot mit eigenem Urteil `empty` und benannter Meldung |
| fehlend | ENOENT-Absturz aus `readdirSync` | rot mit eigenem Urteil `missing` |

Der zweite Fall ist der eigentliche „stille Deckel", den dieser CR ausschließt: ein einzelner
Link ist der **häufigere** Arbeitszustand als sieben, und er hat den Guard komplett abgeschaltet.

**Änderung:** `auditSiglochTree(root, relativeTo)` fällt das Urteil (`missing` | `empty` |
`linked` | `installed`) und ist damit selbst prüfbar. Übersprungen wird nur, wenn die Menge
**ganz** aus Symlinks besteht. Den Symlinks zu folgen bleibt ausgeschlossen (Begründung
CR-GC-404: der Guard prüft eine *Installation*, ein Workspace-Verzeichnis ist keine).

Geänderte Dateien (2): `tests/distribution.test.ts` · dieser CR. Kein Produktionscode.

## Rot gesehen

1. **Live-Guard, künstliche Self-Dependency** — `node_modules/@sigloch/gc403-probe/package.json`
   mit `"dependencies": {"@sigloch/gc403-probe": "file:"}` in die **echte**, verlinkte
   Arbeitskopie gelegt:
   `AssertionError: expected [ '@sigloch/gc403-probe -> itself' ] to deeply equal []`.
   Genau der Fall, den der alte Deckel weggewunken hätte. Probe danach entfernt.
2. **Fixture, vor dem Fix** — 4 der 5 neuen Fälle rot aus dem richtigen Grund: teilweise
   verlinkt meldete `'linked'` statt `'installed'`, leer meldete `'installed'` statt `'empty'`,
   fehlend warf `ENOENT`.

## Akzeptanzkriterien

- [x] Mit Registry-Deps verhält sich der Test **unverändert** (grün; Self-Dep weiterhin rot — rot
      gesehen durch eine künstlich eingesetzte Self-Dependency, s. o. Punkt 1).
- [x] Mit verlinkten Siblings ist er übersprungen, nicht rot, und die Begründung steht in der
      Ausgabe — belegt an den **tatsächlich** verlinkten sieben Paketen dieser Arbeitskopie:
      `[distribution] uebersprungen: alle 7 @sigloch-Eintraege sind Symlinks (contracts,
      graph-api-core, …). … \`npm install\` stellt den pruefbaren Zustand wieder her.`
- [x] Der Unterschied zwischen „leerer Baum" und „verlinkter Baum" ist im Test benannt — ein
      leerer `node_modules/@sigloch` bleibt ein Fehlschlag (`empty`), ein fehlender ebenso
      (`missing`), und beide haben einen eigenen Fixture-Fall.
- [x] `tests/distribution.test.ts` 12/12 grün, `npm test` grün.

@author andreas@siglochconsulting
