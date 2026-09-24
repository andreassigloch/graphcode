# CR-GC-642: graphcode nutzt die Format-E-Tuer der Familie statt einer eigenen

**Status:** ✅ Done (2026-09-24)
**Typ:** aus Item ITEM-2026-532 (finding)
**Erstellt:** 2026-09-24
**Item:** bok/items/ITEM-2026-532.json (Lane: code)

---

Gegenstueck: graphcode loescht FORMAT_E_CODEC und FormatEInputSchema, importiert SE_FORMAT_E_CODEC und FormatEInputSchema aus graph-api-core; SCHEMA-format-e bindet wieder extern (packages/graph-api-core/src/format-e-door.ts#FormatEInputSchema). Ratsche engpass-ein-leser: graphcode baut keinen Codec mehr, parst nur ueber die Tuer. Floor graph-api-core auf den naechsten Minor.

---

## Umsetzung (2026-09-24)

Korrektur an CR-GC-641: Die Zod-Tuer war in graphcode gebaut, obwohl Format-E ein Familienvertrag
ist (Hinweis Auftraggeber). Sie steht jetzt in graph-api-core (CR-SM-359), und graphcode konsumiert sie.

- `src/surface/format-e-commands.ts`: `FORMAT_E_CODEC` und die lokale Tuer sind geloescht.
  `formatEToCommands` parst ueber `FormatEInputSchema` aus graph-api-core. Der Typ-Aufloeser fuer die
  Existenz- und Typpruefung der Operationen bleibt hier.
- `tool-context.ts`, `host.ts`: `SE_FORMAT_E_CODEC` aus graph-api-core (Serialisieren).
  graphcode baut keinen Codec mehr.
- Ratsche `engpass-ein-leser`: „Format-E-Codec bauen“ erlaubt **keine** Datei mehr, „Format-E lesen“
  zaehlt auch die Tuer und erlaubt allein `format-e-commands.ts`.
- Tests: `codec.validation`, `codec.roundtrip`, `graph-integrity` auf `SE_FORMAT_E_CODEC`. Die
  Tuer-Faelle aus CR-GC-641 sind aus `mutate.formate-ops` nach graph-api-core gewandert, hier bleibt
  nur der Uebersetzer-Fall.
- Modell: `SCHEMA-format-e` → `packages/graph-api-core/src/format-e-door.ts#FormatEInputSchema`,
  `external: true`.
- Floor: `@sigloch/graph-api-core` `^5.7.1` → `^5.8.0`.

**Positivkontrolle erneut, mit der Tuer der Familie:** Eine eingeschleuste Datei in `src/`, die
`FormatEInputSchema.parse` selbst ruft, liefert RC-09 = 1 mit Dateinamen, ohne sie ist es 0. Die Regel
prueft also auch einen extern definierten Vertrag, weil CR-SM-358 den Fall „Definition in einem
anderen Paket“ abdeckt.

VOLL 1535/1537; rot ist nur das Paar aus dem Link-Modus.

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
