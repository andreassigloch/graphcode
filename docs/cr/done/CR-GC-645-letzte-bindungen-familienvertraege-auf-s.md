# CR-GC-645: Letzte Bindungen: Familienvertraege auf Schemas, Codec nicht ueber ctx

**Status:** ✅ Done (2026-09-24)
**Typ:** aus Item ITEM-2026-539 (finding)
**Erstellt:** 2026-09-24
**Item:** bok/items/ITEM-2026-539.json (Lane: code)

---

Rest aus ITEM-2026-528: (1) SCHEMA-metric-policy bindet MetricPolicySchema statt des Typs, SCHEMA-impact-slice ImpactSliceSchema (CR-SM-361); FunctionCriticality/ModuleMetrics/GateCompleteness behalten ihren Namen, sind jetzt aber Zod. (2) read.ts ruft den Codec ueber ctx.codec - eine Tuer, die ueber den Kontext gereicht wird, ist fuer RC-09/Ratsche unsichtbar. read.ts importiert SE_FORMAT_E_CODEC direkt; codec faellt aus dem ToolContext-Vertrag.

---

## Umsetzung (2026-09-24)

- **Modell:** `SCHEMA-metric-policy` bindet jetzt `MetricPolicySchema` statt des Typs,
  `SCHEMA-impact-slice` `ImpactSliceSchema` (CR-SM-361). `FunctionCriticality`, `ModuleMetrics` und
  `GateCompleteness` behalten ihren Namen, sind aber jetzt Zod-Konstanten. Damit bindet **jeder**
  SCHEMA-Knoten dieses Modells einen Pruefer, lokal wie in der Familie.
- **Codec nicht mehr ueber `ctx`:** `read.ts` war der einzige Nutzer von `ctx.codec` und importiert
  `SE_FORMAT_E_CODEC` jetzt direkt aus graph-api-core. `codec` faellt aus dem ToolContext-Vertrag
  (strict: ein Kontext mit `codec` wird abgewiesen). Grund: Eine durchgereichte Tuer sieht weder
  die Engpass-Ratsche noch RC-09, beide zaehlen benannte Importe.
- `contract.tool-context`: `codec` aus den Pflicht- und Typfaellen genommen, der Kopfkommentar
  („zwei Codecs“, seit CR-GC-631 falsch) korrigiert.

**Messung nach dem Umbinden** (graphcode, `fileScope: all`): RC-08 0, RC-09 0, RC-04 15. Einer der
RC-04-Befunde ist die benannte Ausnahme `SCHEMA-steering-snapshot` aus CR-GC-644 (ITEM-2026-536/537).
In der Familie (siconizer, moneyflow, sirail, graph-view-edit) sind RC-08 und RC-09 ebenfalls 0.

VOLL 1538/1540; rot ist nur das Paar aus dem Link-Modus.

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
