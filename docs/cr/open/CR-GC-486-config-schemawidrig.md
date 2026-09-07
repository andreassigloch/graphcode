# CR-GC-486 — `graphcode.config.jsonc` validiert nicht gegen das eigene Schema

**Status:** offen · **Angelegt:** 2026-09-07 · **Art:** Fix (Migration, keine Grammatik-Änderung)
**Fundstelle:** CR-GC-485, beim Versuch, den Kaltstart-Treiber gegen dieses Repo zu fahren

---

## 1. Root Cause

`createHarness({repoRoot: '/Users/andreas/Developer/dev/graphcode'})` bricht ab:

    ConfigError: graphcode.config.jsonc: does not match GraphcodeConfigSchema —
      metricPolicy.decompositionBreadth: expected object, received undefined;
      metricPolicy.boundaryWidth:        expected object, received undefined

Beide Felder sind in `MetricPolicy` **Pflicht** (nullable, aber nicht optional):
`decompositionBreadth` kam mit CR-SM-282 (RD-04-Schwelle aus dem Code in die Policy),
`boundaryWidth` mit CR-SM-283 (neue Regel BW-02). Die RULES_VERSION-Historie sagt zu beiden
ausdrücklich „für Konstruierer einer MetricPolicy breaking".

**Die Config dieses Repos wurde nie nachgezogen.** Letzte Änderung: `7551140` (CR-GC-335/-336,
contracts 4.0.0) — beide Felder kamen danach.

## 2. Impact

`loadGraphcodeConfig` bricht **absichtlich** hart ab („Ist sie da und schemawidrig, bricht der
Start ab — kein stiller Fallback", so die Datei über sich selbst). Das ist richtig. Die Folge:

**Kein Harness auf dem lokalen Build lässt sich über diesem Repo öffnen** — weder `graphcode mcp`
noch `graphcode host` noch ein Treiber. Was noch läuft, läuft über ein **publiziertes Paket mit
älterem Schema**; genau die Konstellation, vor der CR-GC-485 §3 warnt.

Bitter ist die Kombination: das Repo, das die Werkzeuge baut, kann sein eigenes Modell mit seinen
eigenen frisch gebauten Werkzeugen nicht öffnen — und merkt es nicht, weil die laufenden Prozesse
aus der Registry stammen.

**Ein Repo ganz OHNE Config ist nicht betroffen** (`DEFAULT_METRIC_POLICY`, `policySource:
"default"`). `test_karp` lief deshalb durch. Betroffen ist nur, wer eine Config *hat* und sie
nicht migriert hat — also jedes Familienmitglied, das eine Schwelle gesetzt hat.

## 3. Fix

1. `metricPolicy.decompositionBreadth` und `metricPolicy.boundaryWidth` in
   `graphcode.config.jsonc` ergänzen, jeweils mit der Begründung daneben (JSONC-Konvention der
   Datei). Verhaltensgleich zum Default wäre `{ "warning": 11 }` bzw. `{ "warning": 5 }`;
   ob dieses Repo davon abweichen will, ist eine eigene Entscheidung — CR-SM-283 hat die 5 aus
   der Verteilung abgelesen und graphcode geht bis 19.
2. **Dieselbe Prüfung für alle Familienmitglieder mit Config** — der Fehler ist repo-weise, nicht
   graphcode-spezifisch.
3. **Damit es nicht wiederkommt:** ein Unit-Test, der die eingecheckte `graphcode.config.jsonc`
   gegen das aktuelle `GraphcodeConfigSchema` parst. Ein Pflichtfeld in einer Policy ohne einen
   Test, der die eigene Config dagegen hält, verschiebt den Bruch bis zum nächsten Kaltstart.

## 4. Warum es so lange unbemerkt blieb

Die Migration ist rückwärts still: contracts fügt ein Pflichtfeld hinzu und veröffentlicht; der
Consumer merkt es erst, wenn er einen Harness auf dem neuen Build öffnet. Solange alle laufenden
Hosts aus der Registry stammen, meldet nichts. **Der Bruch ist nicht der Fehler — das Schweigen
dazwischen ist es.**
