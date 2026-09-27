# CR-GC-698: messen.mjs des Code-Tests misst die Setup-Saat statt des Laufergebnisses: es liest docs/graph/<laufname>.graph.json, waehrend der Export unter dem Mitgliedsnamen <package.name>.graph.json landet — fuer gefuehrt-2 meldete es 0 Prozent Bindung, tatsaechlich sind es 4 von 4 (100 Prozent)

**Status:** ✅ Done (2026-09-27)
**Typ:** aus Item ITEM-2026-509 (bug)
**Erstellt:** 2026-09-27
**Item:** bok/items/ITEM-2026-509.json (Lane: code)

---

NACHGEWIESEN 2026-09-23 am Lauf gefuehrt-2.

messen.mjs `kongruenz()` liest `join(ws, 'docs', 'graph', `${label}.graph.json`)`, wobei `label`
der VERZEICHNISNAME des Laufs ist (`gefuehrt-2`). Diese Datei schreibt das Rig EINMAL beim Aufbau
— mit dem Golden ohne Code-Bindungen. Der Export des Agenten landet unter dem MITGLIEDSNAMEN aus
package.json (`sig-local-scheduler.graph.json`).

  gefuehrt-2/docs/graph/gefuehrt-2.graph.json            255 El, FUNC 24, realRef  0   (12:59)
  gefuehrt-2/docs/graph/sig-local-scheduler.graph.json   262 El, FUNC 25, realRef  4   (13:21)

Gemessen wurde die erste Datei. Bericht: "Bindung Scheibe 0/5 (0 %)". Mit derselben Funktion
`scheibenBindung` auf der zweiten: **4/4 (100 %)**.

Warum es bei gefuehrt-0 nicht auffiel: dort frischte der Export im Messlauf genau die gelesene
Datei auf (`gefuehrt-0.graph.json`, 13:21), bei gefuehrt-2 die andere. Welche von beiden, haengt
davon ab, ob `graph_export({force:false})` durchgeht — und ein Fehlschlag wird von
`.catch(() => null)` verschluckt. Beide Faelle sind derselbe Defekt: gemessen wird eine Datei, die
niemand garantiert aktuell haelt.

FOLGE FUER DEN BERICHT VOM 2026-09-22: die dort ausgewiesene Zeile "Bindung Scheibe / Modell
80 % / 20 %" fuer gefuehrt-0 ist zufaellig richtig, nicht verlaesslich richtig.

ZIELBILD: die Kongruenzmessung liest den STORE, nicht eine Datei daneben — oder sie leitet den
Dateinamen aus derselben Quelle ab wie der Export (Mitgliedsname). Und `.catch(() => null)` am
Export faellt weg: ein fehlgeschlagener Export ist ein Messfehler, kein Nebengeraeusch.

---

## Umfang

`rig/code-test/messen.mjs` ist Messwerkzeug ohne Modellknoten (kein `graph_impact`-Umfang);
Konsument ist allein der Bericht in derselben Datei. 2 Dateien: `rig/code-test/messen.mjs`,
`tests/systemtest-rig.test.ts`.

## Ergebnis

- `kongruenz(ws, scheibe)` liest den Graphen aus dem Store (`h.getGraph()`), dieselbe Quelle wie
  `graph_readiness` — keine Datei mehr. Der Export ist aus der Messung entfernt (samt
  `.catch(() => null)` und dem ungenutzten Feld `export`): eine Messung schreibt nicht.
- Exportiert, Scheibe als Parameter (Vorgabe `SCHEIBE`), damit der Test sie festlegt.

## Akzeptanz

- [x] Rot zuerst: `systemtest-rig.test.ts` „misst die Kongruenz am Store" — Store mit 1/1 gebundener
      FUNC, daneben die Saat mit 0/1, Export kann nicht schreiben (Verzeichnis schreibgeschuetzt,
      wie der verschluckte Fehlschlag in gefuehrt-2): vorher `gebunden: 0`, nachher 1/1.
      Zwei Zwischenversuche waren falsch gruen, weil der Export die Saat ueberschrieb — genau der
      Zufall, der gefuehrt-0 richtig aussehen liess.
- [x] Datei gruen (49/49).
- [x] Validiert an einer Kopie von gefuehrt-2: Store 4/4 (100 %), Saat-Datei 0/5 — der Befund des Items.
- Benannt: `kongruenz()` selbst laeuft an gefuehrt-2 unter 0.26 nicht durch — `graph_readiness`
  wirft (gewollt, CR-GC-646) an den alten REQ-kinds (risk/mitigation/pre-/postcondition). Alte
  Laeufe brauchen vorher `scripts/migrate-req-kinds.mjs`; das ist keine Frage dieses CR.
