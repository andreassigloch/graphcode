# CR-GC-395 — Die CLI-Verben stehen im Modell, und das Modul platzt

**Status:** done 2026-08-22 · **Angelegt:** 2026-08-22 · **Basis:** graphVersion 175 → **177**
**Umsetzung:** dieses Repo (reine Modellarbeit durchs Gate, kein Code)
**Herkunft:** zweiter Cluster aus CR-GC-393

## Umfang

Fünf FUNC, jede mit `realRef` auf ihr deklariertes Symbol, alle an `MOD-cli` alloziert:

| FUNC | Datei · Symbol | erfüllt |
|---|---|---|
| `FUNC-cli-dispatch` | `src/cli.ts` · `main` | `REQ-npx-distribution` |
| `FUNC-run-verb` | `src/run-verb.ts` · `executeRun` | `REQ-one-driver-local-and-frontier` |
| `FUNC-bootstrap` | `src/bootstrap.ts` · `bootstrap` | `REQ-bootstrap-through-gate` |
| `FUNC-import-code-verb` | `src/import-code-verb.ts` · `executeImportCode` | `REQ-no-extraction` |
| `FUNC-gve-supervise` | `src/gve.ts` · `superviseGve` | — |

Verdrahtung nur, wo die Signatur sie hergibt: `FLOW-cli-command` in Dispatch, Run-Verb und
Import-Verb; `bootstrap` nimmt `FLOW-formatE-artifact` und liefert `FLOW-bootstrap-result` — beides
steht wörtlich in der Signatur `bootstrap(harness, formatE, mode): Promise<BootstrapResult>`.

## Was das Kriterium aussortiert hat

`src/scaffold-templates.ts` bleibt draußen, obwohl es 641 Zeilen und 30 Exporte hat: **alle** werden
von `scaffold.ts` konsumiert, also innerhalb desselben Moduls. Das Kriterium aus CR-GC-393 verlangt
einen Aufruf über eine Modulgrenze — hier greift es und verhindert einen Knoten ohne Aussagewert.

`src/cli.ts` exportiert dagegen **gar nichts**; sein `main` ist deklariert, nicht exportiert. Nach
dem Buchstaben des Kriteriums fiele die Datei durch. Sie wird trotzdem modelliert, mit einer
Erweiterung, die hier festgehalten wird: **auch ein Prozess-Einsprung, den ein Mensch aufruft,
verdient einen Knoten.** Andernfalls hätte das Modell jedes Verb, aber nicht die Stelle, die sie
auswählt.

## Ergebnis — die Findings steigen erneut: 141 → 155

Dieselbe Mechanik wie in CR-GC-393, diesmal mit einem zusätzlichen Befund über das Modul selbst.

| Regel | Δ | Grund |
|---|---|---|
| `R-30` | +5 | Keine der fünf hängt in einer Wirkkette — siehe unten, das ist **ein** Befund, nicht fünf |
| `R-31` | +4 | Dispatch, Run- und Import-Verb ohne modellierten Ausgang, Viewer-Aufsicht ohne beides |
| `RC-05` | +2 | Zwei weitere Modulgrenzen wurden sichtbar, weil beide Enden jetzt zugeordnet sind |
| `R-04` | +1 | **`MOD-cli` hat 9 Funktionen und 11 kreuzende Flüsse** |
| `MT-02` | +1 | `MOD-cli` LCOM4=5: neun Funktionen in fünf unverbundenen Gruppen |
| `R-02` | +1 | nur `FUNC-gve-supervise` — für die Viewer-Aufsicht existiert keine Anforderung |

Fehler bleiben **0**, Compliance 1,000.

## Zwei Befunde, die aus dieser Arbeit fallen

**1. `MOD-cli` ist kein Modul mehr, sondern eine Schublade.** LCOM4=5 heißt: die neun Funktionen
zerfallen in fünf Gruppen, die einander nicht berühren — Scaffolding, Zeitreise, Sitzungsende,
Verben, Viewer-Aufsicht. Der Name sagt es selbst: *„npx-Distribution & Lifecycle"* sind schon zwei
Dinge. Das ist ein Schnitt-CR, kein Kantenproblem, und er gehört nicht in diesen.

**2. Es fehlt ein Use Case „Repo einrichten und betreiben".** Die fünf `R-30` sind ein einziger
Befund: es gibt keine Wirkkette für den CLI-Lebenszyklus. Eine anzulegen ginge nicht ohne UC —
`R-15` verlangt seit CR-SM-249, dass eine Kette einen UC über sich hat. Ein UC zu erfinden, nur um
eine Kette hängen zu können, wäre genau die Modellierung für die Kennzahl, die CR-GC-393 ausschließt.
Der UC gehört mit `se:author-uc` autoriert, mit dem Entwickler als Akteur — eigener CR.

## Akzeptanzkriterien

- [x] Die fünf Dateien verschwinden aus der Unassigned-Liste der Konformanz — von 26 auf **21**;
      `scaffold-templates.ts` bleibt drin, wie vom Kriterium vorgesehen.
- [x] `R-20` und `RC-01` feuern nicht: jedes Symbol ist in seiner Datei deklariert, auch das nicht
      exportierte `main`.
- [x] Vier der fünf FUNC erfüllen eine **bestehende** REQ; keine wurde dafür passend gebogen.
- [x] Fehler 0, Compliance 1,000.
- [x] Der Anstieg der Findings ist aufgeschlüsselt und begründet, nicht weggeschrieben.
