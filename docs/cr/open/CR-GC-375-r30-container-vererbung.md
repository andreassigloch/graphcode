# CR-GC-375 — R-30: ein zerlegter FUNC ist gebunden, wenn ein Nachfahre es ist

**Status:** open
**Datum:** 2026-08-19
**Herkunft:** CR-GC-366 (R-30 eingeführt) — die erste Messung an 82 FUNC zeigt, dass 11 der
60 Befunde keine Modellierungslücke sind, sondern die Regel, die einen Container wie ein
Kettenglied behandelt.

## Problem

Das Selbstmodell hat **zwei Überlagerungen**: einen Zerlegungsbaum (6 Wurzeln, 13 `block-*`-Blöcke,
`FUNC -compose-> FUNC`) und 13 Wirkketten, die **Blätter** aufgreifen. Kein einziger `block-*` steht
in einer Kette — und das ist korrekt: ein Blackbox-Block ist kein Schritt in einer Wirkkette, seine
Kinder sind es.

R-30 vererbt Ketten-Mitgliedschaft heute nur **abwärts** (Elternteil in Kette → Kind frei). Der
umgekehrte Fall fehlt: ein Block, dessen Kinder in Ketten hängen, wird gemeldet, obwohl die Frage
„welchem Use Case dient das?" für ihn beantwortbar ist — über seine Kinder.

Gemessen: `block-gedaechtnis` hat 10 Kinder, 6 davon in Ketten, und ist trotzdem ein Befund.

## Lösung

R-30 prüft zusätzlich **abwärts**: ein FUNC mit `FUNC -compose-> FUNC`-Kindern ist gebunden, wenn
**ein Nachfahre** eine Kette erreicht. Erst wenn der ganze Teilbaum ketten-los ist, meldet die Regel —
und dann am Block, was die richtige Stelle zum Reparieren ist.

**Präzedenz im selben Katalog:** R-20 macht es für `realRef` schon so — *a parent FUNC is realized
when its compose children are bound* (CR-210). Dieselbe Container-Semantik, andere Bindung.

Bewusst „ein Nachfahre" statt „alle": bei R-20 geht es um Vollständigkeit der Realisierung, hier um
Beantwortbarkeit der Frage. Ein Block, von dem ein Zweig in einer Kette hängt, hat einen Use Case;
Vollständigkeit treiben die Blätter-Befunde selbst.

## Abgrenzung

- **Keine** neue Regel, **kein** neuer Typ — nur die Traversierung von R-30.
- R-31 (io-Verdrahtung) bleibt unberührt: ein Block ohne io ist auch als Container ein Befund.

## Dateien

| Repo | Datei | Änderung |
|---|---|---|
| sigloch-modules | `packages/contracts/src/se/rules.ts` | Abwärts-Traversierung in `funcMustBeInEffectChain` |
| sigloch-modules | `packages/contracts/src/se/index.ts` | RULES_VERSION-Bump |
| sigloch-modules | `packages/contracts/CHANGELOG.md` | 5.1.0 |
| sigloch-modules | `packages/contracts/tests/unit/se-rules-gc366.test.ts` | Container-Fall rot→grün |
| graphcode | `package.json` / `package-lock.json` | contracts-Range |

## Akzeptanzkriterien

- [ ] Ein FUNC mit einem Kind in einer FCHAIN meldet R-30 **nicht**.
- [ ] Ein FUNC, dessen ganzer Teilbaum ketten-los ist, meldet R-30 **weiterhin** — am Block.
- [ ] Zyklus in `FUNC -compose-> FUNC` terminiert (Test wie in CR-GC-366).
- [ ] Am graphcode-Selbstmodell: **60 → 49** Befunde, die 11 Differenz sind ausschließlich `block-*`.
- [ ] Kein anderer Regelzähler bewegt sich (R-31 54, R-02 33, error-Verstöße 0).
- [ ] Tests in beiden Repos grün.
