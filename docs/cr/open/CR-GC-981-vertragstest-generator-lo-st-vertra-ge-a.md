# CR-GC-981: Vertragstest-Generator löst Verträge aus Paketen nicht auf

**Typ:** aus Item ITEM-2026-1535 (finding)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1535.json (Lane: code)

---

## Befund

Entscheidung des Autors 2026-11-21: Der Generator löst `external`-SCHEMA über den Paket-Import auf. Heute scheitert er an „Cannot find module …/packages/contracts/src/…“: 9 SCHEMA tragen `external: true` und einen `realRef` nach `packages/<name>/src/…` (Code im Nachbar-Repo, hier als npm-Paket `@sigloch/*`).

Stand graphVersion 1398: R-32 18, R-26 8, RC-04 23. Am Code geprüft, Modus: Registry (`aise local`: „Kein Repo liest Arbeitskopien“, `node_modules/@sigloch/*` sind Verzeichnisse, keine Symlinks).

## Entwurf (am Code entschieden)

**Aus `packages/<name>/src/<pfad>` wird der Spezifikator so:**

1. Paketname = `@sigloch/<name>`. Fehlt `node_modules/@sigloch/<name>/package.json`: Eintrag mit Grund „nicht installiert“.
2. Aus `<pfad>.ts` wird `dist/<pfad>.js`. In Frage kommen die Einträge von `exports`, deren Zielverzeichnis dieses Verzeichnis enthält, davon die mit dem längsten Zielverzeichnis (`./se` → `dist/se/` schlägt `.` → `dist/`).
3. Der Generator importiert jeden Kandidaten im Kindprozess und behält die, die das Symbol tragen. Genau einer: das ist der Spezifikator. Mehrere: Fehler mit der Liste. Keiner: Fehler „Symbol ist kein Zod-Schema, vermutlich nur ein TS-Typ“ mit der Liste der Geprüften und der nicht ladbaren.
4. Das Symbol muss ein Zod-Schema sein, sonst Fehler. Kein Fallback auf einen anderen Export, kein Default.

Warum der Pfad vor der Symbolsuche: `TrajectorySchema` steht in `@sigloch/learning-core` und in `@sigloch/learning-core/interfaces`; die Symbolsuche allein wäre zweideutig. Der `realRef` nennt die Datei `src/interfaces/trajectory.ts`, also wählt der Pfad `./interfaces`. Der Autor nannte `@sigloch/learning-core`; beide Importe liefern dasselbe Schema. Wählt der Autor die Wurzel, ist das eine Entscheidung am `realRef` (Familie), nicht am Generator.

Der Import im Kindprozess löst die Pakete aus `node_modules` des Repos auf: Das Verb startet den Kindprozess mit `cwd` im Repo, ein bloßer Spezifikator wird von dort aufgelöst (gemessen, alle sieben).

**Link-Modus** (`npm run link:siblings`): `node_modules/@sigloch/<name>` ist ein Symlink auf die Arbeitskopie. Der erzeugte Test importiert den Paketnamen und läuft in beiden Modi, solange das Symbol im `dist` der Arbeitskopie steht; ein veraltetes `dist` liefert dann rote Tests, die der Link-Modus erwartet (CLAUDE.local.md). Der Unit-Test deckt den Symlink ab (Paket als Symlink auf eine Arbeitskopie außerhalb). Das Repo selbst im Link-Modus zu fahren habe ich nicht, um die Lease und die Lockfile nicht zu bewegen.

## Änderung

- `src/projections/vertragstest.ts`: `VertragstestSatzSchema` bekommt die Variante `{id, file: packages/<name>/src/….ts, symbol, paket: @sigloch/<name>}`; `loeseAuf` wie oben; `erzeugeVertragstests` importiert aus dem Spezifikator (`import { X as S } from '@sigloch/contracts/se'`). `laden(ziel)` nimmt einen absoluten Pfad oder einen Spezifikator.
- `src/surface/vertragstest-verb.ts`: `vertragstestSatz` nimmt jedes `external`-SCHEMA mit `realRef` unter `packages/<name>/src/` in den Satz (mit und ohne uids) und setzt `paket`; der Kindprozess lädt Spezifikatoren unverändert.
- `SCHEMA-vertragstest-satz` im Modell und sein erzeugter Vertragstest ziehen nach (25 statt 16 Fälle). `SCHEMA-vertragstest-bericht` bleibt unverändert.
- Modell: 7 `TEST-vertrag-*` mit `verify` auf das SCHEMA und `testRefs` (Datei, vitest, unit); relation-Kanten des CR auf die 7 SCHEMA und die beiden FUNC.

## Ergebnis je SCHEMA

| SCHEMA | Spezifikator | Fälle | Ergebnis |
|---|---|---|---|
| function-criticality | `@sigloch/contracts/se` | 10 | aufgelöst, TEST gebunden |
| module-metrics | `@sigloch/contracts/se` | 30 | aufgelöst, TEST gebunden |
| ontology-graph | `@sigloch/contracts/se` | 42 | aufgelöst, TEST gebunden |
| rule-violation | `@sigloch/contracts/harness` | 11 | aufgelöst, TEST gebunden |
| impact-slice | `@sigloch/graph-api-core` | 35 | aufgelöst, TEST gebunden |
| metric-vector | `@sigloch/se-engine` | 14 | aufgelöst, TEST gebunden |
| trajectory | `@sigloch/learning-core/interfaces` | 29 | aufgelöst, TEST gebunden |
| completeness | – | – | Bericht: „Symbol ReadinessMark steht in keinem Export von @sigloch/graphcode-client: Symbol ist kein Zod-Schema“ |
| readiness-report | – | – | Bericht: „Symbol ReadinessReport steht in keinem Export von @sigloch/contracts: Symbol ist kein Zod-Schema“ |

Für `completeness` und `readiness-report` wird nichts gebaut. Offen beim Autor: `completeness` ist ein TS-Typ im Client; Wahl: das SCHEMA als Zod-Schema in `@sigloch/graphcode-client` veröffentlichen (Familie), oder es bewusst ohne Test lassen. `readiness-report` zeigt mit dem `realRef` auf `packages/contracts/src/se/readiness.ts`, der Typ liegt aber in `@sigloch/graphcode-client`: erst den `realRef` berichtigen (Familie), dann gilt dieselbe Wahl.

## Nachweis rot-zuerst

- Unit-Tests (`tests/vertragstest.test.ts`, 7 neue Fälle gegen ein Temp-Repo mit Paketen als Verzeichnis, als Symlink, mit zwei Exports derselben Ebene, ohne Export, ohne Zod, nicht installiert): vor der Änderung 6 von 7 rot (der siebte, „packages-Pfad ohne `external` bleibt draußen“, war schon grün und schützt das Verhalten), danach 35 von 35 grün.
- Mutanten am installierten Paket `@sigloch/contracts` (Datei `dist/harness/index.js`, einzeln eingespielt, danach zurückgenommen und mit `cmp` verglichen) gegen `SCHEMA-rule-violation.vertrag.test.ts` (11 Fälle): `ruleId` optional 1 rot, `ruleId` als Zahl 2 rot, `message` optional 1 rot, `severity` um den Wert `fatal` geweitet 0 rot. Das Letzte fängt kein Generator, der nur das Schema kennt: Er weiß nicht, welcher Wert dazukommt.

## Mechanischer Fan-out (Ausnahme zur Dateigrenze, FAQ cr-dateigrenze-ausnahme)

Eigene Dateien: `src/projections/vertragstest.ts`, `src/surface/vertragstest-verb.ts`, `tests/vertragstest.test.ts` = 3. Dazu 8 erzeugte Dateien in `tests/vertrag` (7 neu, 1 neu erzeugt: `SCHEMA-vertragstest-satz.vertrag.test.ts`), Ausgabe des Verbs mit dem Kopf „Nicht von Hand ändern, neu erzeugen“.

Der Lauf ohne uids erzeugt über die 7 hinaus Dateien für weitere SCHEMA (die eigenen mit Zod-Symbol und 11 weitere `external`-SCHEMA, darunter `chain-metrics`, `mutate-command`); sie gehören nicht zu diesem CR und wurden verworfen.

## Akzeptanz

- [x] R-32 von 18 auf 11 (`rules_evaluate` grouped, graphVersion 1399); R-26 8, RC-04 23, R-19 21 unverändert; CR-R01 ohne Befund für diesen CR.
- [x] `npm run type-check` grün; Unit-Tests vorher rot gesehen (6 von 7), danach 35 von 35 grün.
- [x] 7 erzeugte Vertragstests gegen die installierten Pakete grün (171 Fälle); Mutante am Paket: 3 von 4 rot, die Enum-Weitung nicht (Grenze des Verfahrens, oben).
- [x] `SCHEMA-vertragstest-satz` im Modell und sein Vertragstest (25 Fälle) nachgezogen.
- [x] `verify:code` grün (68 Dateien, 814 Tests).
- [x] Smoke: `node dist/cli.js vertragstest` ohne uids läuft durch und nennt je SCHEMA Ergebnis oder Grund (`completeness`, `readiness-report`: „kein Zod-Schema“); `node dist/cli.js status` startet.

---

## Entscheidungen

| Frage | Festlegung | Begründung |
|---|---|---|
| Wie wird aus `packages/<name>/src/<pfad>` der Spezifikator? | Paketname `@sigloch/<name>`; Export mit dem längsten Zielverzeichnis, das die Datei enthält; Symbol muss genau dort stehen | Ohne neues Attribut am `realRef` (Familie); deterministisch; zweideutig oder fehlend ist ein Fehler im Bericht |

---

## Umfang laut `graph_impact`

`FUNC-erzeuge-vertragstests`, `FUNC-vertragstest-verb`, `SCHEMA-vertragstest-satz` (Fluss `FLOW-vertragstest-satz`); die 7 SCHEMA mit neuem TEST.
