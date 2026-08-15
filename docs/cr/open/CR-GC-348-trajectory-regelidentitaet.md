# CR-GC-348 — Der Learning-Feed trägt die Regelidentität

**Status:** open · **Angelegt:** 2026-08-15 · **Max Files:** 6 (dieser CR: **5**, **zwei Repos**)
**Vorbedingung:** CR-GC-346 — dort steht `REQ-prompt-prediction`, das dieser CR erfüllbar macht.
**Governance:** Drift-Lock **L1** (`Trajectory` = *format stable*, Owner Governance-Guardian) —
Familie-Review **vor** der Änderung. **Nicht** L2; L2 betrifft `V3_RULES`, die hier unangetastet
bleiben.
**Ziel:** `trajectory.jsonl` beantwortet „welche Regel", nicht nur „wie viele".

---

## 1. Problem

`trajectory.jsonl` ist das eine Artefakt, das ausdrücklich für einen Lernmechanismus existiert
(CR-GC-252). `projectTrajectory` reduziert die Violations eines Records auf drei Ganzzahlen:

```js
violations: { error: 0, warning: 0, info: 0 }
```

Keine `ruleId`. Kein `elementId`. Kein `rulesPassed`. Keine `rulesetVersion` — obwohl der
Audit-Record auf Platte alle vier trägt.

Die Folge, gemessen: **keine** der vier Analysen aus CR-GC-346 §1 wäre auf diesem Feed möglich
gewesen. R-01 dominiert die Rejections? Nicht ablesbar. R-12 hat null Treffer? Nicht ablesbar. Alle
vier liefen auf `audit.jsonl` von Hand.

Das ist besonders schief, weil CR-GC-314 `rulesPassed` **genau mit dieser Begründung** eingeführt hat:

> *„violations hielt immer fest, was schiefging; was eine Mutation BESTÄTIGT hat, stand nirgends …
> Ein Lernmechanismus kann mit der ersten Aussage arbeiten und mit der zweiten gar nicht."*

Das Feld wurde für den Lernmechanismus geschrieben — und die Projektion **zum Lernmechanismus** wirft
es weg. Zwischen Aufzeichnung und Verwendung sitzt ein Trichter, den niemand angeschaut hat.

---

## 2. Was „der Bump" konkret heisst

`TrajectorySchema` ist **kein graphcode-Code**. Sie liegt in
`sigloch-modules/packages/learning-core/src/interfaces/trajectory.ts`, wird als npm-Paket
`@sigloch/learning-core` veröffentlicht (aktuell **0.2.0**, publiziert sind 0.1.0 und 0.2.0), und
graphcode importiert `projectTrajectory` daraus. Das Format des Feeds zu ändern heisst also, ein
fremdes Paket zu ändern — und daran hängt eine Kette, die vollständig durchlaufen werden muss, sonst
passiert **nichts Sichtbares**:

| # | Schritt | Was schiefgeht, wenn er fehlt |
|---|---|---|
| 1 | Familie-Review (L1: *format stable*) | Ein Feed-Format ohne Freigabe zu ändern ist genau der Drift, gegen den L1 steht |
| 2 | Quelle in `sigloch-modules/packages/learning-core` ändern + Test | — |
| 3 | Version **bumpen**: 0.2.0 → 0.3.0 | — |
| 4 | **Publizieren** nach npm | Seit CR-GC-262 sind die Familie-Pakete **Registry-Deps** mit gepinntem Range. Eine unpublizierte Änderung ist für graphcode unsichtbar — `package-lock.json` ist der Nachweis. Kein Publish = keine Änderung |
| 5 | graphcode-Range **von Hand** auf `^0.3.0` heben | `^0.2.0` zieht **kein** 0.3.0. Caret ist auf `0.x` minor-gesperrt — exakt die Falle, in der `graphify` heute auf 0.1.0 stand, während 0.2.0 publiziert war |
| 6 | `npm install` in graphcode, Build + Tests | — |

Schritt 5 ist der, den man vergisst: Schritte 1–4 laufen grün durch, das Paket ist draussen, und
graphcode benutzt trotzdem weiter die alte Projektion. Nichts schlägt fehl — die Änderung kommt
einfach nie an.

**„Bump" ist also nicht die Versionsnummer, sondern diese sechs Schritte.** Die Nummer ist nur der
Teil, den man sieht.

### 2.1 Warum additiv und damit `minor`

Alle neuen Felder sind **optional** und **kein bestehendes Feld ändert seine Bedeutung**. Ein
Konsument, der die alte Form liest, funktioniert unverändert weiter — damit ist L1 (*format stable*)
eingehalten und der Bump bleibt `minor` (0.2.0 → 0.3.0), nicht `major`. Wäre `violations` durch
etwas anderes ersetzt worden, wäre es ein Breaking Change und L4 (Familie-Council) zusätzlich
zuständig.

### 2.2 Die anderen Konsumenten

`@sigloch/learning-core` wird ausser von graphcode von **`dev/aimpro`** und
**`packages/learning-acl`** benutzt. Weil die Änderung additiv ist, brauchen beide **nichts** — sie
müssen den Bump nicht mitmachen. Das ist der Grund, additiv zu bleiben, auch wenn eine saubere
Neuformung verlockender aussieht.

---

## 3. Entwurf

### 3.1 Neue Felder auf `TrajectorySchema`

```ts
violatedRules: z.array(z.object({
  ruleId:   z.string(),
  severity: z.enum(['error', 'warning', 'info']),
  count:    z.number().int().positive(),
})).optional(),
passedRules:    z.array(z.string()).optional(),
rulesetVersion: z.string().optional(),
```

`violations: { error, warning, info }` **bleibt unverändert** — es ist die Zusammenfassung, die
neuen Felder sind die Auflösung. Kein Ersetzen, kein Parallelpfad: die Zusammenfassung ist aus der
Auflösung ableitbar, aber sie zu streichen wäre ein Breaking Change ohne Gegenwert.

Regel-IDs, nie Regeltext (REQ-A04, aus CR-GC-314 übernommen). `elementId` reist **nicht** mit: der
Feed ist eine Verlaufsprojektion, keine Graphkopie, und Element-IDs machen ihn breit, ohne die
Vorhersage zu verbessern — die Frage ist „welche Regel bei welchem Konsumenten", nicht „welcher
Knoten damals".

### 3.2 Die Absence-Regel — der eigentliche Fallstrick

Die beiden neuen Listen haben **unterschiedliche Herkunft** und deshalb unterschiedliche Regeln:

- **`violatedRules`** ist immer herleitbar, wenn `violations` auf dem Record steht. Es wird auch als
  **leeres Array** geschrieben, wenn es keine Violations gab — „null Verletzungen" ist eine gewusste
  Aussage.
- **`passedRules`** kommt aus `rulesPassed`, das es erst seit CR-GC-314 gibt. Auf dem heutigen Trail
  fehlt es auf **80 der 108 Records**. Für diese muss das Feld **abwesend** sein — **nie `[]`**.
  Sonst liest ein Lernmechanismus „nichts bestanden" statt „nicht aufgezeichnet" und rechnet mit
  einer Grundgesamtheit, die es nie gab. Das ist wörtlich REQ-A05 und in `AuditEntry` bereits so
  dokumentiert.

Diese Asymmetrie ist kein Schönheitsfehler, sie ist die Aussage: leer und unbekannt sind zwei
verschiedene Dinge, und nur eines davon darf man mitteln.

### 3.3 Was beim ersten Lauf nach dem Bump passiert

`materializeTrajectory` schreibt den Feed **vollständig neu** aus dem Log (CR-GC-252 — genau damit
`trajectory.jsonl === project(log)` gilt und nichts driften kann). Nach dem Bump werden also alle
108 Zeilen mit der neuen Form neu projiziert, ohne Migrationsschritt. Die 80 alten Records bekommen
dabei `violatedRules` (aus ihren gespeicherten Violations) und **kein** `passedRules` — nach §3.2
korrekt, und ein Test muss genau das festnageln.

---

## 4. Akzeptanzkriterien

- [ ] Familie-Review für L1 dokumentiert (wer, wann, Ergebnis) — **vor** der Änderung, nicht danach.
- [ ] `@sigloch/learning-core@0.3.0` publiziert; `npm view @sigloch/learning-core versions` zeigt sie.
- [ ] graphcodes `package.json` hält `^0.3.0`, `package-lock.json` löst auf 0.3.0 auf.
- [ ] Ein Record **mit** `rulesPassed` projiziert `passedRules` als Array.
- [ ] Ein Record **ohne** `rulesPassed` projiziert das Feld **abwesend** — `'passedRules' in line`
      ist `false`, nicht `line.passedRules.length === 0`. Red-first nachgewiesen: der Test muss den
      `[]`-Fall einmal rot gesehen haben.
- [ ] Ein Record ohne Violations projiziert `violatedRules: []` — die andere Hälfte der Asymmetrie,
      im selben Test, damit man sie nebeneinander liest.
- [ ] Mehrere Violations derselben Regel werden zu **einem** Eintrag mit `count` verdichtet; die
      Summe der `count` gleicht der Summe aus `violations`.
- [ ] Ein Feed, der vor dem Bump geschrieben wurde, parsed weiter gegen `TrajectorySchema` —
      Rückwärtskompatibilität als Test, nicht als Behauptung.
- [ ] `npm run build` + `npm test` grün in **beiden** Repos.

---

## 5. Betroffene Dateien (5, zwei Repos)

**`sigloch-modules`**

| Datei | Änderung |
|---|---|
| `packages/learning-core/src/interfaces/trajectory.ts` | drei optionale Felder + Projektionslogik |
| `packages/learning-core/tests/trajectory.test.ts` | Absence-Regel, `count`-Verdichtung, Rückwärtskompatibilität |
| `packages/learning-core/package.json` | 0.2.0 → 0.3.0 |

**`graphcode`**

| Datei | Änderung |
|---|---|
| `package.json` + `package-lock.json` | Range auf `^0.3.0` |
| `tests/hooks.learning-emit.test.ts` | der Feed trägt die Regelidentität; 80-ohne/28-mit am echten Log |

`src/emit.ts` bleibt **unangetastet** — `materializeTrajectory` ruft `projectTrajectory` auf und
schreibt, was zurückkommt. Dass hier nichts zu ändern ist, ist der Beweis, dass die Projektion
tatsächlich im Vertrag sitzt und nicht bei uns nachgebaut wurde.

---

## 6. Nicht in diesem CR

- **Der Lernmechanismus selbst.** graphcode liefert Evidenz, nicht Inferenz. Was aus dem Feed
  gelernt wird, ist Sache von `learning-core` bzw. der Learning-Engine.
- **`elementId` im Feed** (§3.1).
- **Nachträgliches Auffüllen der 80 alten Records.** CR-GC-314 hat das schon entschieden und
  begründet: sie gegen einen Regelstand zu rekonstruieren, der zur Mutationszeit nicht galt, wäre
  selbst eine Provenienz-Verletzung.

@author andreas@siglochconsulting
