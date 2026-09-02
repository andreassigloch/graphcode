# CR-GC-457 — Der Zielwert steht auf derselben Achse wie der Ist-Wert

**Status:** **done** — 2026-09-02 · **Angelegt:** 2026-09-02 · **Herkunft:** Review graph-view-edit 30.08.26,
Punkt 3, zweite Runde — Mockup-Abnahme des Auftraggebers am 02.09.

## Problem

`CR-GC-451` hat den Ist-Vektor herausgegeben, damit das Dashboard „wo stehen wir" beantworten kann.
Die Karte zeichnet ihn jetzt auf einer 0–5-Achse — und daneben stand die einzige Zielangabe, die es
gibt, das **Gewicht**:

```
Zusammenhalt · 3.71  →  heben (1.0)
```

Zwei Zahlen nebeneinander, die nicht dieselbe Größe messen. `1.0` ist das Gewicht aus
`.graphcode/target-profile.json` (−1 … 1, Richtung und Vorrang); auf der 0–5-Skala gelesen hieße
„Ziel 1.0" bei Ist 3.71 **senken** — das Gegenteil dessen, was danebensteht. Der Auftraggeber hat
genau das als Befund gemeldet („bei 3,71 · 1,0 heben ist NOK").

Das ist kein Darstellungsfehler des Viewers. `TargetProfileSchema` ist ein `strictObject` und kennt
ausschließlich `weights`; ein Sollwert auf der Werteskala hat dort **kein Feld** und kann auch nicht
hineingeschrieben werden. Der Viewer kann ihn nicht erfinden (CR-GVE-257), also gibt es ihn nicht.

Zweiter, stiller Teil des Befunds: Gewicht und Zielwert könnten sich **widersprechen** —
`coherence` mit Gewicht `+1` („heben") und Zielwert `3.0` bei Ist `3.71` ist ein Zielprofil, das in
zwei Richtungen zeigt. Ohne Prüfung wäre das genau die Klasse Fehler, die dieser CR gerade behebt,
nur eine Ebene tiefer und unsichtbar.

## Änderung

### 1. Das Profil kennt Zielwerte

`target-profile-contract.ts` bekommt neben `weights` ein optionales `values` — je Dimension ein
Sollwert auf **derselben** Skala, die `metrics()` liefert (0–5, `clamp05`):

```ts
const targetValue = z.number().min(0).max(5);
export const TargetValuesSchema = z.strictObject({ /* die 6 Dimensionen, je .optional() */ });
```

`weights` bleibt unverändert und behält seine Aufgabe: **`graph_suggest` rankt gegen die
Richtung**, L2-normiert (CR-GC-353). `values` steuert nichts — es ist die Marke, gegen die ein
Mensch den Ist-Wert liest. Zwei Felder, zwei Aufgaben, keine Ableitung des einen aus dem anderen:
aus einem Gewicht folgt kein Sollwert, und aus einem Sollwert folgt kein Vorrang.

### 2. `fit.target` trägt beides — und meldet den Widerspruch

`graph_metrics` gibt `values` im selben Objekt heraus wie `weights` (die Regel aus CR-GC-329 und
CR-GC-451: Wert und Marke verlassen den Host **zusammen**), und ergänzt `inconsistent`:

```
target: { weights, values, source: 'profile' | 'none', inconsistent: Dimension[] }
```

`inconsistent` listet die Dimensionen, in denen `sign(weight)` und `sign(value − ist)` auseinander
laufen — „heben" mit einem Sollwert unter dem Ist-Wert, oder umgekehrt. **Warnung, nie Block**,
dieselbe Linie wie `conflictWarnings` (ein bewusster Zielkonflikt ist legitim, ein unsichtbarer
nicht). Die Prüfung sitzt hier und nicht im Loader, weil sie den Ist-Wert braucht: der Loader liest
eine Datei, er kennt den Graphen nicht.

Ohne Profil bleibt es bei `source: 'none'` mit leeren Objekten — kein erfundener Nullvektor, keine
erfundene 2.5-Mitte.

### 3. Der Skill fragt sie ab

`se:target-profile` fragt nach Schritt 1 (Gewichte) den Sollwert je gewichteter Dimension: die
Skala 0–5 mit dem heutigen Ist-Wert aus `graph_metrics.fit.metrics` als Ankerpunkt — „du stehst bei
3.71, wo willst du hin?". Für neutral gewichtete Dimensionen wird **nicht** gefragt; ein Sollwert
ohne Steuerabsicht wäre eine Zahl ohne Konsequenz.

## Dateien (6)

- `src/loop/target-profile-contract.ts` — `TargetValuesSchema`, `values` im Profil
- `src/projections/metrics.ts` — `fit.target.values` + `inconsistent`, Tool-Beschreibung nachgezogen
- `.claude/commands/se/target-profile.md` — Schritt „Zielwerte" mit dem Ist-Wert als Anker
- `tests/target-profile.test.ts` — Schema nimmt Werte in 0–5, weist −1 und 6 ab
- `tests/metrics.test.ts` — `fit.target.values` durchgereicht; `inconsistent` benennt die Dimension
- `docs/cr/done/CR-GC-457-zielwert-statt-zielrichtung.md`

`src/loop/target-profile.ts` bleibt unberührt — es re-exportiert den Vertrag nur (CR-GC-419).

## Akzeptanz

1. Ein Profil mit `values: { coherence: 4.5 }` lädt; `values: { coherence: 6 }` und
   `values: { coherence: -1 }` scheitern am Schema. Rot vorher (`strictObject` kennt das Feld nicht).
2. `graph_metrics.fit.target.values` trägt genau die Werte der Datei; ohne Profil `{}` mit
   `source: 'none'`.
3. Gewicht `+1` bei Zielwert unter dem Ist-Wert ⇒ die Dimension steht in `inconsistent`.
   Stimmen Richtung und Sollwert überein, ist die Liste leer.
4. Ein bestehendes Profil **ohne** `values` lädt unverändert weiter — das Feld ist optional, kein
   Repo muss nachziehen.
5. `graph_suggest` rankt unverändert: `values` geht nirgends in die Empfehlung ein.
