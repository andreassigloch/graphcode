# CR-GC-375 — R-30 bewertet Blätter; ein zerlegter FUNC ist ein Rollup

**Status:** open
**Datum:** 2026-08-19
**Herkunft:** CR-GC-366 (R-30 eingeführt). Die erste Messung an 82 FUNC zeigt 13 Befunde, die keine
Modellierungslücke sind, sondern die Regel, die einen Container wie ein Kettenglied behandelt.

## Problem

Das Selbstmodell hat zwei Überlagerungen: einen Zerlegungsbaum (`FUNC -compose-> FUNC`, 13 Blöcke
über 69 Blättern) und 13 Wirkketten, die Glieder aufgreifen.

R-30 bewertet heute **jeden** FUNC. Damit meldet es auch die 13 Blöcke — obwohl ein Block gar nicht
in eine Kette *darf*: **FC-03 („FCHAIN is flat") verbietet ein Kettenglied mit verschachtelter
FUNC-Zerlegung.** Die Regel fordert also einen Zustand, den eine andere Regel untersagt.

Belegt: der Versuch, `block-reifegrad-sicht` an `FCHAIN-live-update` zu hängen, wurde vom Gate mit
FC-03 quittiert (graphVersion 111, zurückgenommen in 112).

## Lösung

**Ein zerlegter FUNC ist ein Rollup seiner Kinder und hat keinen eigenen Bindungszustand.**
R-30 überspringt jeden FUNC mit `FUNC -compose-> FUNC`-Kindern und meldet nur **Blätter** — dort,
wo der Fix hingehört.

Zwei Folgen für die heutige Implementierung:

1. Die Blatt-Prüfung wird **direkt**: ein Blatt braucht seine eigene `FCHAIN -compose-> FUNC`-Kante.
2. Die Aufwärts-Vererbung („ein Vorfahre ist in einer Kette → Kind frei") aus CR-GC-366 **entfällt**.
   Sie konnte nur greifen, wenn ein Block Kettenglied ist — und genau das verbietet FC-03. Sie war
   toter Code mit falscher Aussage: sie hätte ein unverbundenes Blatt stumm geschaltet.

Damit ist die Anforderung vollständig auf die Blätter verlagert: **jedes Blatt gehört in eine
Wirkkette — parallel oder seriell, aber eingebunden.** Der Block ist danach automatisch grün, ohne
je eine eigene Kante zu tragen.

## Abgrenzung

- **Keine** neue Regel, **kein** neuer Typ — nur die Grundgesamtheit von R-30.
- R-31 (io-Verdrahtung) bleibt unberührt: ein Block ohne io ist auch als Rollup ein Befund.
  *(Ob R-31 dieselbe Rollup-Behandlung braucht, ist eine eigene Frage — hier bewusst nicht
  mitentschieden, weil ein Block sehr wohl eigene Ein-/Ausgänge haben kann.)*

## Dateien

| Repo | Datei | Änderung |
|---|---|---|
| sigloch-modules | `packages/contracts/src/se/rules.ts` | `funcMustBeInEffectChain`: Blätter-Grundgesamtheit, Aufwärts-Vererbung raus |
| sigloch-modules | `packages/contracts/src/se/index.ts` | RULES_VERSION-Bump |
| sigloch-modules | `packages/contracts/CHANGELOG.md` | 5.1.0 |
| sigloch-modules | `packages/contracts/tests/unit/se-rules-gc366.test.ts` | Rollup-Fall rot→grün, Vererbungs-Test ersetzt |
| graphcode | `package.json` / `package-lock.json` | contracts-Range |

## Akzeptanzkriterien

- [ ] Ein FUNC mit FUNC-Kindern meldet R-30 **nie**, unabhängig davon, ob seine Kinder gebunden sind.
- [ ] Ein Blatt ohne eigene `FCHAIN -compose-> FUNC`-Kante meldet R-30 — auch wenn sein Elternteil
      in einer Kette stünde (der bisherige Vererbungs-Test kehrt sich um).
- [ ] Am graphcode-Selbstmodell: **56 → 43**, die 13 Differenz sind exakt die Blöcke.
- [ ] Kein anderer Zähler bewegt sich (R-31 54, R-02 33, R-18 0, FC-03 0).
- [ ] Tests in beiden Repos grün.

## Folge-CR (nicht hier)

**IO-01 verlangt einen FLOW-Pfad zwischen JEDEM Paar einer Kette.** Sobald die 43 Blätter eingebunden
werden, explodiert das quadratisch — gemessen: die 7 Dashboard-Renderer in `FCHAIN-live-update` zu
hängen kostet **+79 IO-01-Warnungen**. Wenn eine Kette parallele Zweige haben darf (und sie darf:
„parallel oder seriell"), ist die Alle-Paare-Forderung sachlich falsch — zwei parallele Zweige
tauschen per Definition keinen Flow. CR-GC-315 hat exakt diese Korrektur für R-21 schon vollzogen
(„reuse was penalised quadratically"); bei IO-01 steht sie aus. **Diese Frage gehört vor die
Anbindung der 43**, sonst modellieren wir gegen eine Regel, die sich danach ändert.
