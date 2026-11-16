# CR-GC-919: Ebenensprung — Anforderung wird ohne Zerlegung tief erfuellt

**Status:** 🟠 Open — startet nach CR-GC-918
**Typ:** aus Item ITEM-2026-1321 (finding)
**Erstellt:** 2026-11-12
**Item:** bok/items/ITEM-2026-1321.json (Lane: code)
**Regel dazu:** CR-SM-436 (wartet auf die Messung dieses CR)

---

**Bezug:** [`SPIKE-GC-ein-erfueller-je-req-RESULTS.md`](../../archive/spikes/SPIKE-GC-ein-erfueller-je-req-RESULTS.md) §1 und §6.
Entscheidung des Autors 2026-11-12: immer die volle Kette SYS.1 → SYS.2 → SWE.1; erst CR-GC-918
abschliessen, dann am echten Modell neu zaehlen.

## Befund

Ein Ebenensprung ist eine REQ, die direkt unter SYS oder einem UC haengt, keine Kind-REQ hat und von
einer FUNC oder einem MOD unterhalb der obersten Ebene erfuellt wird. Beispiel aus dem Modell:

```
SYS-graphcode ─compose→ REQ-repo-uninstall  „Deinstallation entfernt alle installierten Artefakte ohne Residuen."
                           ▲ satisfy
FUNC-block-betrieb > FUNC-block-bedienung > FUNC-harness-cli (Blatt, Ebene 2)
```

Die Systemanforderung springt ueber zwei Funktionsebenen. Was „ohne Residuen" fuer die Kommandozeile
heisst, steht in keiner Anforderung. Nach Automotive SPICE fehlt die Software-Anforderung (SWE.1), die
aus der Systemanforderung (SYS.2) abgeleitet ist.

Gezaehlt an der Spike-Kopie: 57 vorher, 37 nach den Batches von CR-GC-918. Zulaessig bleibt der
Erfueller auf der Systemebene: SYS, FCHAIN, MOD der obersten Ebene, Blatt-FUNC der obersten Ebene
(SYS.3.BP4: Systemanforderung zum Architekturelement).

## Zielbild

1. **Zaehlen** am Modell nach CR-GC-918, Liste der Faelle in diesen CR.
2. **Je Fall korrigieren:** an der Grenze des Erfuellers eine Kind-REQ ableiten (EARS, nur was an
   seiner Grenze sichtbar ist), `REQ -compose-> REQ`, die `satisfy`-Kante an das Kind, TEST dazu.
   Im Beispiel: „Wenn graphcode remove laeuft, loescht es genau die Pfade, die init angelegt hat."
3. **Faelle ohne sinnvolle Kind-REQ** listen: dort ist die Eltern-REQ selbst zu tief formuliert und
   wandert als Ganzes nach unten (INCOSE C2).
4. **Messung fuer CR-SM-436:** Zahl der Faelle vorher und nachher, Zahl der Faelle, die sich als
   Pruefregel nicht eindeutig entscheiden liessen.

## Akzeptanz

- [ ] Liste der Spruenge am Modell nach CR-GC-918, mit Zahl.
- [ ] Jeder Sprung zerlegt oder verschoben; verbleibende mit Grund gelistet.
- [ ] Keine neue Fehlermeldung, R-01 = 0, keine REQ mit mehr als einem Erfueller.
- [ ] Messung an CR-SM-436 uebergeben.
- [ ] `npm run verify:model` gruen; `docs/graph` und `docs/views` im selben Commit.

## Umfang

`docs/graph/graphcode.graph.json` und die erzeugten Sichten unter `docs/views/`. Kein Quellcode.
