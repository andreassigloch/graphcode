# CR-GC-379 — R-28 aus graphcode nachziehen (contracts 6.0.0)

**Status:** done · **Angelegt:** 2026-08-20 · **Abgeschlossen:** 2026-08-20 · **Max Files:** 6 (dieser CR: **8**, s. §4)
**Herkunft:** `sigloch-modules` CR-SM-247 (Regel entfernt) / CR-SM-252 (Nachzug), ausgelöst durch
den Publish von `@sigloch/contracts@6.0.0`.

---

## 1. Root Cause

`R-28` (Ebenen-Präsenz) ist mit CR-SM-247 aus dem Regelkatalog entfallen — seit CR-GC-366 doppelt:
die FLOW-Hälfte trägt **R-31** (io-Verdrahtung, je FUNC statt einmal je Graph) plus **IO-01**, die
SCHEMA-Hälfte **SC-04** (je FLOW). graphcode trug die Regel an vier Stellen weiter, darunter einen
**nutzersichtbaren** Hilfetext.

## 2. Impact

Ohne Nachzug: die Dashboard-Hilfe erklärt eine Regel, die der Katalog nicht mehr kennt, und drei
Artikel nennen eine Regelzahl, die um eins zu hoch ist. Der Coverage-Test
(`help-content.test.ts`) hätte den Hilfetext ohnehin nicht mehr eingefordert — die Lücke wäre
still gewesen.

## 3. Änderung

| Datei | Änderung |
|---|---|
| `src/viewer/help-content.ts` | R-28-Eintrag gelöscht (Plain + SE) |
| `src/harness-import.ts` | Kommentar: „the R-28 family" entfällt |
| `docs/articles/07-the-scoring-landscape.md` | Nachtrag statt Umschreiben: die Lehre gilt, die Regel ist weg, die Antwort kommt jetzt pro Element |
| `docs/spikes/SPIKE-GC-abstraction-levels.md` | Leitplanken-Liste: R-28 → R-31 |
| `docs/articles/03-…`, `04-…`, `06-claims.md` | „74 engine rules" → **73** |
| `tests/claims.conformance.test.ts` | Canary-Tupel `engine rules=74` → `73` |

`docs/review.md` und `rig/**/results/*.json` bleiben: Historie, korrekt datiert.

## 4. Warum 8 Dateien

Sechs davon sind ein Zahlen-/Prosa-Sweep, den der Test `claims.conformance` erzwingt („fails
LOUDLY on a contracts bump so someone re-reads the articles"). Genau dafür wurde er gebaut — er
hat drei stale Zahlen gefunden, die kein Mensch gesucht hätte. Aufteilen hieße, den Test bewusst
rot stehen zu lassen.

## 5. Verifikation

- `npm run build` grün
- `npm test`: **832 von 835** grün. Die drei zuvor roten Tests (`help`, `help-content`,
  `claims.conformance`) sind grün, nachdem `node_modules` auf den **publizierten** Stand gebracht
  wurde — die Arbeitskopie trug eine Vor-Publish-Kopie von contracts 6.0.0 mit noch 67 Regeln.
- `SE_DESCRIPTOR.rules` = **66** (war 67), `version` unverändert 7.0.0.

## 6. Offen — nicht von diesem CR verursacht

`tests/distribution.test.ts` ist rot: `npm install` aus dem gepackten Tarball scheitert mit

```
npm error notarget No matching version found for @sigloch/graph-view-edit@^0.6.0.
```

`package.json` (uncommitted) fordert `^0.6.0`; auf npm liegt höchstens **0.5.0**. Das lokale
`~/Developer/dev/graph-view-edit` steht auf 0.6.0, unveröffentlicht und mit uncommitteten
Änderungen. Solange das so ist, ist graphcode aus der Registry nicht installierbar — unabhängig
von R-28. **Nächster Schritt:** graph-view-edit 0.6.0 prüfen und publizieren, dann `npm install`
in graphcode.
