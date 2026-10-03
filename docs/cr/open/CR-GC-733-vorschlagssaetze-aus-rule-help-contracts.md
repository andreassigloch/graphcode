# CR-GC-733: Vorschlagssaetze aus RULE_HELP (contracts) lesen statt eigener Tabelle; Regelmatrix zeigt Spalte Vorschlag; Pruefung beim Hoststart

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-718 (idea)
**Erstellt:** 2026-10-03
**Item:** bok/items/ITEM-2026-718.json (Lane: code)

---

## Befund

CR-GC-729/730 legten die 38 Vorschlagssätze je Kern-Regel als Tabelle in graphcode an (`VORSCHLAG_REGEL`) — ein
paralleler Pfad zu `RULE_HELP` und den `fix_hint`s in contracts. Entscheid des Autors (2026-10-03): die Regelmatrix
ist SSOT für alle Texte je Regel. Seit CR-SM-384 (contracts 10.14.0) trägt `RULE_HELP[id].vorschlag` die Sätze;
Smeagol hat vier davon an `plain`/`fix_hint` angeglichen (IO-02, R-15, R-21, RD-05), und der Smeagol-Check dort
hält Menge und Form.

Zweiter Befund (Review nach CR-GC-730): der Satz wurde erst nach dem Persistieren der Mutation gewählt und warf bei
einer Regel ohne Satz — die Änderung stand dann im Store, die Antwort war ein Fehler.

## Änderung

| Datei | Änderung |
|---|---|
| `src/loop/next-step.ts` | `VORSCHLAG_REGEL` gelöscht; `vorschlagAusSchritt` liest `RULE_HELP[regel].vorschlag`; Startprüfung beim Laden: jede fokusfähige Kern-Regel hat einen Satz, sonst fällt der Host beim Boot |
| `package.json` | Peer-Floor `@sigloch/contracts >= 10.14 <11` (folgt dem Import; bis zum Publish Link-Modus) |
| `scripts/regel-matrix.mjs` | Spalte „Vorschlag“ aus `RULE_HELP` |
| `tests/mcp.mutate-next-step.test.ts` | Mengen-/Formtest entfällt (steht in contracts); Satz = `RULE_HELP` der Fokus-Regel |

Kaltstart (`VORSCHLAG_SEED`), Analysen, Freigabe und Festgefahren bleiben in graphcode — das sind keine Regeln.

## Benannte Ausnahme

`tests/distribution.test.ts` ist rot, bis contracts 10.14.0 in der Registry steht (Tarball-Install zieht den Peer
aus der Registry). Erwartbarer Link-Modus-Zustand (CLAUDE.local.md), kein Defekt; `lockfile-sync` grün, Spiegel im
Lock auf `>=10.14 <11`. Volllauf: 200/202 Dateien grün.

## Abnahme

- `grep VORSCHLAG_REGEL src` leer; `docs/views/regel-matrix.md` zeigt die Spalte.
- Ein Modellstand mit Fokus UC-02 liefert den contracts-Satz mit Elementnamen.
