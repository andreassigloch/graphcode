# CR-GC-325 — Alle 8 Dimensionsscores über MCP, nicht nur die schlechteste

**Status:** done (2026-08-12) · **Datum:** 2026-08-12
**Ziel:** graphcode 0.12.x
**Ontologie:** v4.0.0 — **unverändert**
**Bezug:** CR-GC-223/ST-5 (`nextStep`), CR-SM-226 (`RULE_TO_DIMENSION` / `RULE_TO_PHASE` als zwei
Projektionen EINES Regelstroms), CR-GC-125 (Phase-/Impl-Gates), [CR-GC-324](CR-GC-324-nextstep-regelblind-rest-von-303.md) (Vorbedingung),
CR-GVE-* (Dashboard-Konsum)

---

## 1. Problem

`@sigloch/contracts` definiert mit `RULE_TO_DIMENSION` acht Themenscores — `req · uc · arch ·
alloc · ver · schema · cr · ms` — und `@sigloch/se-steering`s `computeReadiness(og)` rechnet sie
vollständig aus (`ReadinessScore { dimension, score, violations, applicable, ready }`, Schwelle
`ready ≥ 0.7`). `nextStep` ruft genau diese Funktion auf und wirft **sieben der acht Ergebnisse weg**:
nach außen geht nur die Dimension mit dem größten Defizit.

Gemessen am Host (graph-view-edit): `graph_next_step` liefert `{dimension: "ms", deficit: 1}`. Dass
`schema` unter der Ready-Schwelle liegt und `arch`/`alloc` darüber, steht im selben `report` — es
verlässt den Prozess nur nicht.

**Folge für Konsumenten:** ein Dashboard, das die Architektur-Achse anzeigen soll, hat keine Quelle.
Es kann sie entweder gar nicht zeigen oder — der real eingetretene Fall in graph-view-edit — sie
selbst nachrechnen: eigene Regel-Engine, eigenes Graph-Parsing, eigene Schwellwerte. Damit stehen
zwei Berechnungen nebeneinander, die auseinanderlaufen, und der Renderer trägt Logik, die ihm nicht
gehört. `RULE_TO_PHASE` (die Gates) ist über `graph_readiness` längst abrufbar; `RULE_TO_DIMENSION`
ist die gleichwertige zweite Projektion desselben Regelstroms und fehlt.

---

## 2. Ziel

Die acht Dimensionsscores sind über MCP abrufbar — mit derselben Herkunft und demselben Zeitpunkt
wie die Gates, damit ein Konsument beide Achsen nebeneinander zeigen kann, ohne zu rechnen.

---

## 3. Nicht-Ziele

- **Keine neue Rechnung.** `computeReadiness` aus `@sigloch/se-steering` bleibt die einzige
  Implementierung; dieser CR reicht deren Ergebnis durch.
- **Keine Schwellwert-Politik in graphcode.** `ready ≥ 0.7` steht in contracts und bleibt dort.
- **Keine Ablösung von `graph_readiness`.** Gates bleiben die Pass/Fail-Autorität; die Dimensionen
  sind Steuerungsgrößen, kein Gate.
- **Kein zweites Tool.** Entschieden: Feld an `graph_readiness` (Anforderung 1).

---

## 4. Anforderungen

1. **Ort — entschieden 2026-08-12: Feld an `graph_readiness`.** Der ReadinessReport bekommt
   `dimensions: ReadinessScore[]` neben `phaseGates`/`implGates`: beide Projektionen desselben
   Regelstroms kommen aus einem Aufruf, mit einem `computedAt`. Ein eigenes Tool
   `graph_dimensions` ist damit **verworfen** — es hätte zwei Zeitpunkte für zwei Sichten auf
   dieselbe Auswertung erzeugt. Größe unkritisch: 8 Objekte ≈ 600 Byte, das Summary-Limit
   (`detail:false`) bleibt eingehalten; `dimensions` gehört ins Summary, nicht hinter `detail:true`.
2. Der Wert stammt aus **einem** Snapshot: derselbe `takeSteeringSnapshot(graph)`, den `nextStep`
   nach CR-GC-324 benutzt. Kein zweiter Regel-Lauf, keine zweite Konvertierung.
3. `nextStep` behält seine Ein-Empfehlungs-Ausgabe unverändert, referenziert aber dieselben Scores
   (keine Kopie der Auswahl-Logik).
4. Jeder Score trägt `violations` **und** `applicable` — ohne den Nenner ist ein Score nicht
   interpretierbar (`ms` liest 0 %, weil MS-03 67-mal feuert bei 15 applicable Elementen; das ist
   erklärbar nur mit beiden Zahlen).
5. Vollständigkeitstest: jede Dimension aus `ReadinessDimension.options` erscheint in der Ausgabe,
   auch mit `score: 1` und 0 Verstößen — eine fehlende Dimension darf nicht als „alles gut" gelesen
   werden.

---

## 5. Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/tools/report.ts` | `graph_readiness` um `dimensions` erweitern (Beschreibung + Result) |
| `src/steering.ts` | Scores aus dem Snapshot beziehen statt lokal auszuwählen |
| `src/steering-snapshot.ts` | `report` (bereits vorhanden) als Teil des Snapshots exponieren |
| `tests/steering.test.ts` | Vollständigkeit (8 Dimensionen) + Nenner-Feld |
| `docs/views/*` | keine — Views rendern aus dem Graph, nicht aus Readiness |

4 Dateien.

---

## 6. Akzeptanzkriterien

- [x] `graph_readiness` liefert 8 Dimensionsscores mit `score`, `violations`, `applicable`, `ready`
      — als Feld `dimension_readiness` (Variante (a); der Feldname kommt aus contracts,
      `DIMENSION_READINESS_NAME`, wie `phase_readiness` schon).
- [x] Der `deficit` aus `graph_next_step` ist `1 − score` derselben Dimension aus
      `dimension_readiness` (`tests/mcp.readiness.test.ts` — eine Rechnung, nicht zwei). Nicht auf
      graph-view-edit nachgemessen, sondern deterministisch im Test; der Fremdrepo-Stand bewegt sich.
- [x] Die Liste enthält **immer** alle 8 Dimensionen in der Reihenfolge von
      `ReadinessDimension.options` — eine fehlende Dimension darf nicht als „alles gut" gelesen
      werden. **Abweichung zum Entwurf:** „8 Scores à 1.0" bei einem Graphen ohne Verstöße trifft
      nicht zu — `computeReadiness` gibt einer Dimension mit `applicable: 0` konstruktiv Score 0,
      nicht 1 (dieselbe Konvention, die `computeSteeringDelta` schon anwendet). Deshalb wird die
      **Vollständigkeit** geprüft, nicht ein 1.0-Wert; das wäre eine stille Umdeutung der
      contracts-Semantik gewesen.
- [x] `npm run build` + volle Suite grün.

---

## 7. Folgen

Erst mit diesem CR kann ein Renderer die Architektur-Achse anzeigen, ohne zu rechnen. Die
Modulkennzahlen dahinter (Instabilität, LCOM4, Kohäsion) folgen in
[CR-GC-326](CR-GC-326-modul-metriken-je-mod.md) — der Dimensionsscore sagt „alloc ist 87 %", nicht
„welches Modul".

@author andreas@siglochconsulting
