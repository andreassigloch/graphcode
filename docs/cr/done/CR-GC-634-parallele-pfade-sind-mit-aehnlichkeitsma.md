# CR-GC-634: Engpaesse werden gezaehlt, nicht auf Aehnlichkeit geprueft

**Status:** ✅ Done (2026-09-23)
**Typ:** aus Item ITEM-2026-518 (finding)
**Erstellt:** 2026-09-23
**Item:** bok/items/ITEM-2026-518.json (Lane: code)

---

## Befund

CR-GC-632 hat einen zweiten Format-E-Leser entfernt, den CR-GC-631 zwei Stunden vorher angelegt
hatte. Die Frage danach: **woran haette man das merken koennen?** Drei Kandidaten, alle am echten
Paar gemessen, mit den Routinen aus `@sigloch/contracts/se` — denselben, die ND-01/ND-02 fahren.

| Kandidat | Messung | Schwelle | Befund |
|---|---:|---:|---|
| Benennung | Name-Jaccard `knotenAus` ↔ `formatEToCommands` = **0,000** | 0,85 | nie |
| Textvergleich | Rumpf-Jaccard, 16 Zeilen ↔ 183 Zeilen = **0,164** | 0,85 | nie |
| Schnittstelle / ND-01 | Testhilfen tragen **keinen Knoten**: 117 Dateien mit `testRefs`, davon **0** unter `tests/helpers/` | — | strukturell blind |

**Die Einsicht:** ein zweiter Pfad ist dem ersten NIE aehnlich. Er ist kuerzer, anders benannt und
kann weniger — das ist ja der Grund, warum ihn jemand schreibt. Aehnlichkeitsmasse finden
Copy-Paste; sie finden keine zweite Auslegung derselben Sprache.

Was die beiden teilten, war der **Eingang**: beide riefen `FORMAT_E_CODEC.parse`. Das ist keine
Aehnlichkeit, sondern eine Zaehlung — und sie ist einzeilig.

## Zielbild

Ein Engpass, den man benennen kann, bekommt keine Regel, sondern einen Test (CLAUDE.md:
„Enforced, not documented"). `tests/engpass-ein-leser.test.ts` fuehrt eine RATSCHE benannter
Engpaesse mit den Dateien, die sie rufen duerfen:

- **Format-E lesen** → nur `src/surface/format-e-commands.ts`
- **Format-E-Codec bauen** → nur `src/surface/format-e-commands.ts`

Die Liste darf schrumpfen, nicht wachsen. Ein neuer Aufrufer ist keine Kleinigkeit, sondern eine
zweite Auslegung — er muss hier eingetragen und im CR begruendet werden.

## Umfang

| Datei | Zug |
|---|---|
| `tests/engpass-ein-leser.test.ts` | NEU — die Ratsche |
| `src/surface/host.ts` | Fund des ersten Laufs, s. u. |

## Ergebnis (2026-09-23)

**Der Test hat beim ersten Lauf zwei Dinge gefunden, eins davon echt.**

1. `src/surface/host.ts:244` baute bei **jedem Hook-Aufruf** eine eigene `FormatECodec`-Instanz —
   eine dritte, die weder CR-GC-631 noch ich gesehen hatten. Jetzt `FORMAT_E_CODEC`.
2. `src/surface/tool-context.ts` war ein Eigentor: der Treffer war mein eigener **Kommentar**,
   der die geloeschte Konstruktion beschreibt. Der Test streift Kommentare ab, bevor er zaehlt —
   dieselbe Lehre, die in `scripts/spike-nd-known-answer.mjs` schon steht.

**Rot zuerst, mit dem echten Duplikat:** `git show dbb4fd4:tests/helpers/format-e.ts` als zweite
Datei zurueckgelegt → der Test meldet „Zweiter Zugang zu Format-E lesen: tests/helpers/format-e.alt.ts".
Datei weg → gruen. Er prueft also den Fall, fuer den er da ist, und nicht nur sich selbst.

## Testspur

VOLL 1522/1524 — die zwei roten sind `distribution` und `lockfile-sync` (ITEM-2026-490), vor wie
nach diesem CR.

## Abgrenzung

Dies ersetzt ND-01/ND-02 nicht und schlaegt keine Aenderung an contracts vor. Es sagt nur, wofuer
ein Aehnlichkeitsmass das falsche Werkzeug ist. Der Blindfleck „Testhilfen sind unmodelliert"
bleibt offen — er ist echt, aber eine eigene Frage (ITEM-2026-518 nennt ihn).
