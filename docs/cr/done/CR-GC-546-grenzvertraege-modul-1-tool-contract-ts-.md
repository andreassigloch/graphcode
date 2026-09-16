# CR-GC-546: Grenzvertraege Modul 1 (tool-contract.ts) modellieren und den Kennzahlen-Verlauf mitschreiben - Recorder scripts/kennzahlen.mjs, Reihe in docs/records/kennzahlen.md

**Status:** ✅ Done (2026-09-16)
**Typ:** aus Item ITEM-2026-222 (idea)
**Erstellt:** 2026-09-16
**Item:** bok/items/ITEM-2026-222.json (Lane: code)

---

Der erste Schritt aus ITEM-2026-221: **ein Modul**, gemessen vorher und nachher.

## Warum tool-contract.ts zuerst

`grenzmenge.mjs` (CR-GC-545) sortiert die Fehlmenge nach der Zahl der holenden Module.
Ganz oben steht `src/kernel/tool-contract.ts` mit `MCPTool`, `MCPToolRegistry` und `ToolPort` —
**je drei Module** holen sie. Der Dateikopf (CR-GC-480) beschreibt die Grenze bereits in Prosa:
„jede Schicht, die ihre eigenen Tools baut (`loop`, `projections`), importierte sie von dort —
13 Typ-Importe nach oben. Der Vertrag liegt jetzt unten; die Oberflaeche erfuellt ihn."
Der Vertrag war also schon gezogen, nur nicht modelliert.

## Was der Zug tut

Drei Vertraege nach dem Muster, das `SCHEMA-tool-context` im Modell schon vorgibt:
`FUNC -io-> FLOW -io-> FUNC` plus `FLOW -relation-> SCHEMA`. Der Kern DEKLARIERT, die
Oberflaeche ERFUELLT, loop/projections VERBRAUCHEN. 15 Befehle, ein Batch, durchs Gate.

Dazu zwei Werkzeuge, weil „Verlauf notieren" von Hand nicht traegt:
- `scripts/kennzahlen.mjs` — EINE Zeile je Zug nach `docs/records/kennzahlen.md`. Steuerung und
  Befunde vom LAUFENDEN Host (derselbe Pfad wie das Gate), Grenzmenge aus `grenzmenge.mjs`
  (derselbe Rechenweg wie CR-GC-545). Kein zweiter Messpfad, keine abgeschriebenen Zahlen.
- `grenzmenge.mjs` gibt seine Rechnung jetzt als Funktion frei (`messeGrenzmenge`), statt sie
  nur zu drucken — ein Rechenweg, zwei Aufrufer.

`docs/records/` ist der vorhandene Ort fuer datierte Messungen (`modellhygiene-v168.md` ist
dieselbe Gattung), `MESSGROESSEN.md` bleibt die Definitionsseite. Kein neues Verzeichnis.

## Ergebnis — der Verlauf

| | v284 vorher | v285 nachher | Δ |
|---|---:|---:|---:|
| Knoten | 761 | 767 | +6 |
| modifiability | 3,066 | 3,078 | **+0,012** |
| faultTolerance | 5,000 | 5,000 | 0 |
| flowEfficiency | 0,729 | 0,734 | **+0,005** |
| coherence | 3,907 | 3,922 | **+0,015** |
| viability | 4,982 | 4,983 | +0,001 |
| scalability | 3,915 | 3,948 | **+0,033** |
| Steuerung (Chebyshev) | 3,501 | 3,501 | 0 |
| **error** | 4 | 4 | **0** |
| SCHEMA-Grenzdeckung | 7/49 = 14,3 % | **10/49 = 20,4 %** | +3 |

**Fuenf von sechs Dimensionen steigen, kein neuer Fehler.** Die Steuerung bleibt stehen, weil der
dominierende Term unveraendert `R-04 @ MOD-kernel` ist — ein Vertrag mehr aendert den Engpass nicht.

### Die Warnungen, genau zugeordnet

| Regel | vorher | nachher | woher |
|---|---:|---:|---|
| R-32 | 33 | 36 | die drei neuen realisierten SCHEMA haben keinen Vertrags-TEST |
| RC-04 | 20 | 23 | sie sind TS-Interfaces, kein Zod — niemand ruft `.parse()` darauf |
| CR-R01 / MS-03 / RC-07 | 3/5/3 | 4/6/4 | **der CR-Knoten dieses CR**, nicht die Vertraege (ITEM-2026-202/218) |

Also **+6 Warnungen fuer drei Vertraege**, beide Regeln systematisch vorbelastet: R-32 traf
schon 33 von 34 realisierten SCHEMA, RC-04 schon 20.

### Korrektur meiner eigenen Schaetzung

ITEM-2026-221 sagte „ein Knoten kostet 3 Befunde, 71 Knoten also rund 213". Das war an einem
NACKTEN Knoten gemessen (nur `allocate`) und deshalb zu pessimistisch. **Richtig verdrahtet
kostet ein Vertrag 2 Warnungen und KEINEN Fehler — und die Metrik steigt.** Die Hochrechnung
fuer die restlichen 39 SCHEMA-Grenzsymbole lautet damit rund +78 Warnungen aus genau zwei
Regeln, nicht 213 aus fuenf.

### Was daraus als Frage folgt

R-32 und RC-04 sind beide fuer **Zod-Datenvertraege** gebaut. Ein TS-Interface hat weder eine
`.parse()`-Stelle noch einen sinnvollen Vertrags-TEST im selben Sinn. Entweder brauchen die
Regeln einen Begriff fuer den strukturellen Vertrag, oder das Modell nimmt die Warnungen in
Kauf. Das ist eine Regel-Entscheidung in contracts und gehoert nicht in diesen Zug.

## Abnahme

- Drei SCHEMA + drei FLOW im Modell, jeder mit `relation` auf seinen Vertrag und io an beiden
  Enden. Gate `tier: suggest`, `success: true`, keine Ablehnung.
- `docs/kennzahlen.md` traegt drei Zeilen: Ausgangslage, der Vertragszug, der Abschluss.
- Volle Suite gruen.

## Nachtrag — drei Funde beim Aufraeumen

**1. `docs/records/` ist git-ignored.** Der Recorder schrieb zuerst dorthin (es ist der
vorhandene Ort fuer datierte Messungen), aber `.gitignore` haelt gate-review records bewusst
lokal. Ein Verlauf ohne History waere keiner. Die Reihe liegt jetzt als `docs/kennzahlen.md`
auf dem Kennzahlen-Regal neben `MESSGROESSEN.md` (Definitionen) und `KPI.md` (Nachprojekt-
Standard). Der `.gitignore`-Kommentar nennt sie jetzt mit — und nennt nicht mehr `docs/adr/`,
das seit dem Archivieren von ADR-001 leer ist.

**2. Jeder Fehler im Modell ist ein CR-Knoten ohne Umfang.** Gemessen: 5 von 5 `error` waren
CR-R01 an CR-GC-540/541/542/545/546. **Kein einziger kam aus dem Code-Modell.** Fuer diesen CR
ist der Umfang jetzt bekannt, also traegt sein Knoten ihn — 5 Fehler auf 4. Die uebrigen vier
sind ITEM-2026-202.

**3. CR-R01 und R-18 widersprechen sich.** Der erste Versuch, den Umfang auf die drei SCHEMA zu
legen, wurde vom Gate GEBLOCKT: `CR -relation-> SCHEMA` ist grammatikwidrig (R-18) — waehrend
CR-R01s eigene Meldung SCHEMA als gueltiges Umfangsziel nennt („no relation to
FUNC/MOD/SCHEMA/REQ/UC"). Der Umfang liegt deshalb auf `MOD-kernel`, dem Modul, das die drei
Vertraege deklariert. Der Widerspruch liegt als ITEM-2026-223.
