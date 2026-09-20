# CR-GC-565: Der Rig-Prompt gibt die Ontologie vor

**Status:** ✅ Done (2026-09-20)
**Typ:** aus Item ITEM-2026-391 (bug)
**Erstellt:** 2026-09-20
**Item:** bok/items/ITEM-2026-391.json (Lane: graph)

---

## 1 Befund

Das Rig soll einen Auftraggeber simulieren, der die Methode nicht kennt. Der Prompt, den es
stellt, kennt sie.

**Leck 1 — `prompt-prosa.txt` nennt die Ontologie:**

> „Spezifiziere das System SIG Local bis zur **Implementierungsreife**. … **Systemgrenze,
> Akteure, Use Cases, Funktionen, Verträge und Module** sind aus dem Auftrag herzuleiten."

Das sind sechs der zwölf Elementtypen, in Reihenfolge, plus ein Methodenbegriff. Ein
Auftraggeber schreibt das nicht.

**Leck 2 — `MATERIAL_HINT` schließt mit** „Nur der Graph zaehlt." Auch das ist Methode, und
sie steht in allen drei `.env`-Dateien.

**Leck 3 — die Arme bekommen ungleich viel Hilfe.** `buildPrompt` (claude) schreibt dem
Modell drei Werkzeuge und ihre Reihenfolge vor; `buildIntent` (gcrun) tut das nicht. Jeder
Vergleich zwischen den Armen hätte diesen Unterschied eingebaut — genau der Vergleich, der
als späteres Thema vorgemerkt ist.

**Das Produkt widerspricht dem Rig ausdrücklich.** `GRAPHCODE-STEERING.md`, vom Scaffold in
jeden Workspace gelegt, sagt zum Intent-Absatz: *„Write it in your own words — **no method
vocabulary**, no module names, no file layout"*, und nennt den Einstieg wörtlich:

> Read GRAPHCODE.md, then `se:generate`: "<what the system should do, for whom>"

Das Rig hat diesen Einstieg nie benutzt. Damit ist auch der frühere Befund dieser Sitzung
zu präzisieren — „die Skills sind in keinem Lauf angesprungen": sie konnten nicht, weil der
Rig-Prompt keinen nennt. Der dokumentierte Einstieg nennt einen.

## 2 Zielbild

Der Prompt sagt, **was** gewollt ist, und sonst nichts. Die Methode kommt aus dem Produkt —
beim claude-Arm über `GRAPHCODE.md` und den Skill, beim gcrun-Arm über den SYSTEM-Prompt
des Executors und die Runden-Injektion. Beides existiert und ist genau dafür da.

- `prompt-prosa.txt`: keine Elementtypen, kein „Implementierungsreife".
- `MATERIAL_HINT`: sagt, wo das Material liegt, und hört da auf.
- `buildPrompt`: der dokumentierte Einstieg statt einer selbst erfundenen Werkzeugfolge.
- `buildIntent`: Prosa plus Materialort; das Wie gehört dem Loop (stand schon so da).

## 3 Umfang

- `rig/sigllm-spezifikation/prompt-prosa.txt`
- `rig/sigllm-spezifikation/lauf-gcrun.env`, `lauf-prosa.env`, `lauf.env` — `MATERIAL_HINT`
- `rig/greenfield-systemtest/run.mjs` — `buildPrompt`

Fünf Dateien.

## 4 Abnahme

1. Im Prompt steht kein Elementtyp der Ontologie und kein Werkzeugname.
2. Der claude-Arm benutzt den in `GRAPHCODE-STEERING.md` dokumentierten Einstieg.
3. Neue Basislinie mit `RUNS=3` — die alte ist ungültig.

## 5 Was das kostet

**Die Basislinie 38–50 Elemente verfällt.** Sie wurde mit einem Prompt gemessen, der die
Ontologie mitliefert; die neuen Zahlen werden voraussichtlich niedriger liegen. Das ist kein
Rückschritt, sondern das Ende einer geschönten Messung: was hier verloren geht, war Hilfe,
die das Produkt beim Kunden nicht hat.
