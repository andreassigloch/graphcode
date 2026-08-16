# CR-DRAFT-GC-357 — Testhandling: was ist ein TEST-Knoten?

**Status:** DRAFT (geparkt — Entscheidung erst nach weiteren echten Import-Beispielen)
**Angelegt:** 2026-08-16 · **Herkunft:** SPIKE-GC-abstraction-levels §7 (moneyflow-Import) +
Betreiber-Einspruch gegen die in CR-GF-141 zunächst vorgeschlagene Testdatei-Policy.
**Zweck dieses Drafts:** die Erkenntnisse festhalten, Optionen offen halten, Beispiele sammeln.

---

## 1. Die Erkenntnisse (gemessen am moneyflow-Import, 2026-08-16)

### E1 · Der Code-Import erzeugt je Testdatei eine DREIFACH-Identität

| Identität | moneyflow-Zahlen | Beispiel |
|---|---|---|
| TEST je **Datei** | 25 | `test_api_api_test_ts` |
| TEST je **Testfall** (mit Zeilennummer in der uid) | **400** | `test_api_api_test_ts_151_akteurschema_validates_a_correct_actor` |
| **MOD + FUNC** für die Test-Helfer | 26 MODs (17 % aller 155), 38 FUNCs | `mod_api_api_test_ts`, `func_..._makemockgraphservice` |

Ø 17 TEST-Knoten je Testdatei, max. 41. Die Helfer zählen in Modulkennzahlen,
Architektur-Layern und Übersichtsebenen als Produktions-Architektur mit.

### E2 · Granularitäts-Konflikt mit der eigenen Ontologie

Die SE-Ontologie sagt seit CR-SM-231: **TEST = Abnahme**, `testRefs` 1:n (EINE Abnahme,
n Dateien), und **R-29 (error)**: eine Testdatei gehört zu genau EINER Abnahme. Der Import
liefert die **Umkehrung**: n Knoten je Datei. Heute kollidiert das nur deshalb nicht mit
R-29, weil die importierten TESTs **gar keine `testRefs` tragen** (status `draft`, leere
Attribute) — sie sind also zugleich unterhalb der R-19-Bindungsanforderung. Sobald man sie
bindet, wird R-29 massiv rot. Der Konflikt ist angelegt, nicht ausgebrochen.

### E3 · Evidenz ohne Anforderung

Der Code-Import kennt keine REQ/UC — die 425 TESTs **verifizieren nichts**. Sie sind
Evidenz-Knoten ohne verify-Ziel; was sie im importierten Graphen bedeuten (Abnahme? Inventar?
Doku?), ist unbestimmt.

### E4 · Betreiber-Position (2026-08-16)

Dem Dual-Use (Testdatei = TEST **und** Architektur) wird nicht zugestimmt; ebenso ist
„alle Test-Knoten zeigen in eine Testdatei" diskussionswürdig. Die in CR-GF-141 zunächst
vorgeschlagene Policy („Testdateien erzeugen nur TEST-Knoten") ist damit **eine Option,
keine Entscheidung** — CR-GF-141 ist auf das Verzeichnis-Nesting reduziert.

## 2. Optionen (bewusst unentschieden)

| # | Option | gewinnt | verliert |
|---|---|---|---|
| a | Testdateien → nur TEST-Knoten (kein MOD/FUNC) | Architektur sauber | Helfer-Struktur unsichtbar |
| b | TEST je **Datei** statt je Fall (Abnahme ≈ Datei) | R-29-kompatibel, 425→~25 Knoten | Fall-Granularität (Zeilen-genaue Evidenz) |
| c | TEST je Fall behalten, R-29 für importierte Graphen relativieren | Fall-Evidenz | reißt die Exklusivitäts-Invariante — hohe Kosten, s. CR-SM-231 |
| d | Test-Code bleibt MOD/FUNC mit `kind: test`, aus arch-Layer projiziert | Helfer sichtbar UND Architektur sauber | neues Attribut + Projektionsregel in allen Konsumenten |

Vorentscheidungs-Notiz: b+d kombinierbar (Datei-Abnahmen + markierte Test-Module); a ist die
billigste, d die ehrlichste Variante. **Nicht hier entscheiden.**

## 3. Nächste Schritte

1. **2–3 weitere echte Importe** (Kandidaten: GVE, sirail, immo/lead-capture) — je Repo die
   E1-Tabelle füllen; erst dann zeigt sich, ob moneyflows 17 TEST/Datei typisch ist.
2. Je Beispiel prüfen: was würde ein Konsument (Übersichtsebene, Testmatrix, graph_tests)
   mit den importierten TESTs anfangen wollen?
3. Dann: Draft → echter CR (graphify-Anteil + ggf. contracts-Anteil, falls `kind: test`).

**Bezug:** [CR-GF-140](../../../..//graphify/docs/cr/open/CR-GF-140-treesitter-32k-parse-limit.md),
[CR-GF-141](../../../../graphify/docs/cr/open/CR-GF-141-mod-nesting-und-testdatei-policy.md),
CR-SM-231 (testRefs 1:n + R-29), SPIKE-GC-abstraction-levels §7.

@author andreas@siglochconsulting
