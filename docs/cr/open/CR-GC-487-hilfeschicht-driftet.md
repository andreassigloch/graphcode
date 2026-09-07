# CR-GC-487 — Die Hilfeschicht driftet von der Grammatik weg

**Status:** offen · **Angelegt:** 2026-09-07 · **Art:** Fix + Absicherung
**Fundstelle:** CR-GC-485, beim Klassifizieren aller 72 Regeln nach Prüfgegenstand
**Betroffen:** `src/projections/help-content.ts`, `src/projections/help.ts`

---

## 1. Root Cause

`graph_help {token: "<ruleId>"}` ist laut CR-GC-229 die **eine** Auskunft über eine Regel, für
beide Zielgruppen. `help-content.ts` trägt 71 gepflegte Einträge, `ALL_RULE_DEFS` 72 Regeln — und
die Mengen decken sich nicht. Zwei Fehlerarten, beide gemessen:

### (a) Acht Regeln ohne jeden Eintrag

    BW-02, BQ-01, BQ-02, BQ-04, BQ-06, BQ-07, ND-01, ND-02

**`BW-02` ist der schwere Fall:** sie ist eine der fünf Regeln, aus denen `steerAdvisory` den
Chebyshev-Score bildet (`rules: ["RD-04","BW-02","CR-01","MT-01","MT-02"]`). Eine Regel, die
steuert, aber sich nicht erklärt. Wer wissen will, was sie misst, muss `ao-rules.ts` lesen oder
die RULES_VERSION-Historie von CR-SM-283 — dort steht es, und nur dort: *Randbreite der
FUNC-Whitebox, verschiedene SCHEMA-Verträge auf `FUNC -io-> FLOW -io-> FUNC` mit einem Endpunkt
im compose-Teilbaum und einem außerhalb.*

Der belegte Schaden: bei der Klassifikation aller Regeln in CR-GC-485 wurde BW-02 allein nach
ihrem Namen als *Modul*-Blackbox eingeordnet. Sie hat `domain: ['FUNC']` und misst eine
FUNC-Whitebox — der Name sagt es sogar („Whitebox boundary width"), die fehlende Erklärung hat es
verdeckt. Ebenso `BQ-04`: nach dem Namen „Necessary" eine Einzelknoten-Prüfung, tatsächlich ein
paarweiser Ähnlichkeitsvergleich über **alle** REQ.

### (b) Mindestens drei Einträge, die einen überholten Stand beschreiben

| Regel | `graph_help` sagt | tatsächlich, seit |
|---|---|---|
| **R-12** | „Direct cycle: A→B and B→A via the same trace type" | voller DFS über Zyklen **jeder Länge** — CR-SM-285 |
| **R-18** | „Trace whose (source-type, target-type) pair isn't allowed" | dazu zwei weitere Beine: `FLOW -relation-> SCHEMA [1..1]` (CR-SM-271) und **höchstens ein compose-Elternteil** (CR-SM-283) |
| **RD-04** | zählt `FUNC compose FUNC`, `FUNC allocate MOD`, `SYS/MOD compose MOD` | dazu der **FUNC-Wurzelwald am SYS-Knoten** — CR-SM-282; genau dieser Zweig hat in CR-GC-485 als einziger gefeuert |

Der R-12-Eintrag ist nicht ungenau, er ist **falsch**: er beschreibt eine Regel, die einen
Dreierzyklus durchlässt. Genau das war der Anlass von CR-SM-285.

## 2. Impact

`graph_help` ist die Auskunftsschicht, auf die sich CR-GC-229 festgelegt hat: *ein* Ort, zwei
Zielgruppen, kein Konsument formuliert eigene Erklärungen. Solange sie driftet, gilt das Gegenteil
von dem, wofür sie gebaut wurde — wer sie liest, liest an drei belegten Stellen den Stand von
vorgestern, und an acht Stellen gar nichts.

Für Menschen ist das ärgerlich. Für einen Agenten ist es die einzige Quelle: er kann den
Quelltext nicht nebenbei lesen und hat keinen Anlass, der Auskunft zu misstrauen. In CR-GC-485 hat
genau das zu einer falschen Klassifikation und zu einer falschen Aussage in einem Bericht geführt.

## 3. Fix

1. **Die acht fehlenden Einträge schreiben** — Plain/SE/Prompt wie die übrigen 71. Für BW-02,
   BQ-04, ND-01 und ND-02 ist die Quelle die RULES_VERSION-Historie (CR-SM-283 bzw. CR-SM-286),
   nicht der Regelname.
2. **Die drei überholten Einträge nachziehen** (R-12, R-18, RD-04). Beim Durchgehen ist zu
   prüfen, ob weitere Einträge aus derselben Änderungswelle betroffen sind — CR-SM-282/-283/-285/-286
   haben in einer Session vier Regeln in ihrer Wirkung verändert.
3. **Abdeckungstest:** ein Unit-Test, der `ALL_RULE_DEFS` gegen `help-content.ts` hält und rot
   wird, sobald eine Regel keinen Eintrag hat. Das fängt (a) dauerhaft.

## 4. Was (b) NICHT fängt — und der eigentliche Vorschlag

Ein Abdeckungstest sieht nur, **dass** ein Eintrag da ist, nie **ob er stimmt**. Genau diese
Klasse ist hier der Schaden: R-12 hat einen Eintrag, und er ist falsch.

Vorschlag zur Diskussion, nicht als fertige Lösung: den Eintrag an die Regel binden, die er
erklärt — eine `helpVersion` (oder der letzte ändernde CR) am Eintrag, gegen die
`RULES_VERSION`-Major geprüft. Ändert sich die Regelwirkung, wird der Eintrag rot, bis ihn jemand
angefasst hat. Das ist dieselbe Bewegung, die CR-SM-244 für die Versions-Bump-Pflicht gemacht hat:
**ein Unit-Test sieht nur den Jetzt-Stand; ob die Erklärung mitgewandert ist, steht in der
Historie.**

Ob das den Aufwand trägt oder ob eine Sichtprüfung bei jedem Grammatik-CR reicht, gehört ins
Review — der Punkt hier ist, dass (b) ohne eine solche Kopplung strukturell unentdeckt bleibt.
