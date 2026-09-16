# CR-GC-543: Trockenuebungs-Spike rot seit CR-GC-540: 1 anwendbarer, nicht zielfuehrender Zug und R-04@MOD-kernel als dominanter Term - Befund neu messen

**Status:** ✅ Done (2026-09-16)
**Typ:** aus Item ITEM-2026-214 (finding)
**Erstellt:** 2026-09-16
**Item:** bok/items/ITEM-2026-214.json (Lane: code)

---

## Root Cause

`tests/arch.optimization-dry-run.spike.test.ts` ist seit **740e992 (CR-GC-540)** rot. Eingegrenzt
ueber den Graph-Snapshot bei unveraendertem Testcode:

| Snapshot | Commit | Zuege | uebrig | dominanter Term |
|---|---|---:|---:|---|
| v275 | 2cd6adf (CR-GC-539) | 0 | 0 | keiner — gruen |
| v279 | **740e992 (CR-GC-540)** | 0 | **1** | **R-04 @ MOD-kernel** — rot |
| v281 | dbaf530 (CR-Knoten 541/542) | 0 | 1 | R-04 @ MOD-kernel — unveraendert |

Der Test ist eine ABSICHTLICHE Reissleine: sein Kommentar verlangt ausdruecklich, rot zu werden,
sobald ein Zug moeglich wird, und den Befund dann neu zu messen. Genau das ist passiert.

Der uebrig gebliebene Zug, jetzt benannt statt gezaehlt:

    uebrig: [CR-R01] CR-GC-540 · score 0.0000 · add-trace CR-GC-540->FUNC-encode

Das ist **keine Architekturbewegung**, sondern CR-Hygiene: der CR-Knoten von CR-GC-540 nennt
keinen Scope. Bekannte Ursache — `aise dispatch prepare` legt schlanke CR-Knoten ohne
Scope-Kante an, weil der Umfang zur Prepare-Zeit nicht bekannt ist (ITEM-2026-202). Derselbe
Befund steht im bok-Modell an BOK-CR-063 (CR-R01) und BOK-CR-028 (MS-03).

## Impact

Der Testcode war nie falsch, der **Befund** darin ist veraltet. Zwei Aussagen sind neu:

1. Der ARCHITEKTUR-Aktionsraum ist weiter leer — die Aussage von CR-SM-309 haelt.
2. `dominant` ist nicht mehr `null`, und das ist ein **Fortschritt**: CR-SM-309 notierte, die
   uebrigen Vorschlaege truegen kein Verdict und damit kein `worstAt`, der Engpass stehe nur in
   `graph_metrics`. Jetzt traegt einer eins — derselbe Engpass, den CR-GC-537 im Steuerungsraum
   mit 3,5 misst (R-04 @ MOD-kernel).

Warum es niemand sah: der pre-commit-Hook faehrt bewusst keine Tests (CR-GC-399), und CR-GC-540
war ein Modell-Commit. Die Modell-Spur `verify:model` (46 von 141 Dateien) enthaelt diesen Test
nicht — ein Modellzug kann eine Messung still ungueltig machen. Das ist ein eigener Befund und
liegt als ITEM-2026-215; hier wird es NICHT mitgefixt.

## Aenderung

Zwei Dinge, beide im Test, kein Produktionscode:

1. **Die Uebriggebliebenen werden benannt, nicht gezaehlt.** Der Test sagte „1" und nicht welcher;
   die Zuordnung kostete einen Bisect ueber drei Snapshots. Eine Zahl ohne Namen ist kein Befund.
2. **Die Assertion prueft die HERKUNFT statt der Anzahl.** `leftover === 0` waere ab jetzt bei
   jedem neuen CR-Knoten rot — mehrmals pro Tag. Eine Reissleine, die taeglich reisst, wird
   abgeschaltet. Statt dessen: kein anwendbarer Zug AUSSERHALB der CR-Hygiene-Regeln, und
   `dominant` ist genau `R-04 @ MOD-kernel`. Beides reisst weiter, wenn sich etwas Echtes bewegt.

## Abnahme

- Der Spike ist gruen, und die Gegenprobe zeigt, dass die neue Assertion traegt: mit leerem
  `CR_HYGIENE` wird sie rot und nennt `CR-R01 @ CR-GC-540`. **Gefahren, beides bestaetigt.**
- Die volle Suite ist gruen.
- NICHT Teil dieses CR: die Scope-Kante an CR-GC-540 (ITEM-2026-202), die Modell-Spur
  (ITEM-2026-215).
