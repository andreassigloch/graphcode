# CR-GC-403 — `distribution.test.ts` kann unter verlinkten Siblings nicht prüfen

**Status:** open · **Angelegt:** 2026-08-22 · **Umsetzung:** dieses Repo
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

## Abgrenzung

Nicht Teil dieses CR: ob die Suite überhaupt unter verlinkten Siblings laufen soll. Sie soll — nur
darf ein gegenstandsloser Test nicht wie ein Regress aussehen.

## Akzeptanzkriterien

- [ ] Mit Registry-Deps verhält sich der Test **unverändert** (grün; Self-Dep weiterhin rot — rot
      gesehen durch eine künstlich eingesetzte Self-Dependency).
- [ ] Mit verlinkten Siblings ist er übersprungen, nicht rot, und die Begründung steht in der Ausgabe.
- [ ] Der Unterschied zwischen „leerer Baum" und „verlinkter Baum" ist im Test benannt — ein leerer
      `node_modules/@sigloch` bleibt ein Fehlschlag.

@author andreas@siglochconsulting
