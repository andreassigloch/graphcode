# CR-GC-520: contracts-Floor auf 10.2 nachziehen (functionCriticality, Rest von CR-GC-518)

**Status:** ✅ erledigt (2026-09-13)
**Typ:** aus Item ITEM-2026-111 (bug)
**Erstellt:** 2026-09-13
**Item:** bok/items/ITEM-2026-111.json (Lane: code)
**Auslöser:** `aise release prepare @sigloch/graphcode=patch` bricht am Floor-Check ab

---

## 1. Root Cause

CR-GC-518 importiert `functionCriticality` aus `@sigloch/contracts/se` und hat den Peer-Floor
bewusst auf `>=10.1 <11` gelassen, bis der Auftraggeber die Release-Nummer von contracts
entscheidet (10.2.0 oder 11.0.0, ITEM-2026-091). Entschieden und publiziert ist **10.2.0**
(Zug 2026-09-12). Die zweite Hälfte — „der Floor wird MIT ihr gesetzt" — ist nie passiert.

## 2. Impact

Kein Release von graphcode möglich: der Floor-Check in `aise release prepare` verweigert, weil
`dist/` einen Namen importiert, den contracts 10.1.0 nicht exportiert. Ein Consumer mit 10.1
installiert würde zur Laufzeit mit `does not provide an export named 'functionCriticality'`
sterben. Blockiert damit den Patch-Zug für CR-GC-519.

## 3. Fix

`peerDependencies["@sigloch/contracts"]` → `>=10.2 <11` in `package.json` und den zwei
Spiegelstellen der `package-lock.json`. Nachweis ist der Floor-Check selbst:
`aise release prepare @sigloch/graphcode=patch` läuft durch die Preflight.

### Dateien (2)

| # | Datei |
|---|---|
| 1 | `package.json` |
| 2 | `package-lock.json` |

## 4. Akzeptanzkriterien

- [x] `grep '">=10.1 <11"' package.json package-lock.json` leer.
- [x] `npm run build` grün.
- [x] `aise release prepare @sigloch/graphcode=patch` passiert den Floor-Check (Nachweis im Zug 2026-09-13).
