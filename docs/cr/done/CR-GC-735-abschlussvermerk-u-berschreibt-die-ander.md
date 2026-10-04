# CR-GC-735: Abschlussvermerk überschreibt die anderen: ~ SYS @analysisFreshness {x} ersetzt das ganze Objekt (2. Stempel löscht den 1.); Skills sagen 'analysisFreshness.<id> = …' — gemessen im Replay todo-local 2026-10-04

**Status:** ✅ Done (2026-10-04)
**Typ:** aus Item ITEM-2026-726 (bug)
**Erstellt:** 2026-10-04
**Item:** bok/items/ITEM-2026-726.json (Lane: code)

---

## Befund

Nachgespielt am Handlauf todo-local (2026-10-04): `~ SYS-todo` mit `@analysisFreshness {"trade":{…}}` und danach
`@analysisFreshness {"assumption-review":{…}}` — der zweite Zug ersetzt das ganze Attribut, AF-02 feuert wieder.
Der Patch arbeitet attributweise (offizielle Format-E-Semantik von `~`); die fünf Analyse-Skills beschrieben den
Abschluss aber als Teil-Zuweisung (`attributes.analysisFreshness.trade = {…}`) und legten den Fehler nahe.

## Entscheid (Autor, 2026-10-04)

Keine neue Regel in Ontologie, Format-E oder Patch: lesen, übernehmen, ganz schreiben — der übliche Weg für ein
Objekt-Attribut. Der Executor macht es im Code schon so (`stempelZug`, `src/loop/task-artifact.ts`). `baseVersion`
schützt gegen einen Zwischenstand; ein vergessenes Lesen zeigt sich im selben Zug (die überschriebene Analyse
feuert wieder in den Violations).

## Änderung

| Datei | Änderung |
|---|---|
| `.claude/commands/se-{conops,trade,irr,fmea,plan}.md` | Abschlussschritt: SYS lesen (`graph_get_node`), vorhandene Einträge übernehmen, das ganze Objekt mit `baseVersion` schreiben |
| `tests/task-analysen.test.ts` | Patch ersetzt das Objekt (Befund gepinnt); Lesen-Übernehmen-Schreiben hält alle; jeder Skill trägt den Satz, keiner mehr die Teil-Zuweisung |

todo-local: die fünf Skill-Kopien neu erzeugt.

## Ergebnis

`verify:full`: 201/202 grün; rot nur `distribution` (Link-Modus, contracts 10.14.0 unpubliziert — benannte Ausnahme
wie CR-GC-733/734), als Schlupf gezählt, nicht durch diese Änderung.
