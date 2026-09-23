# CR-GC-621: Neuer groesster Antwortgeber nach CR-GC-613: graph_elements 7.143 Zeichen je Aufruf und graph_expand 4.224 — beide ohne Scheibenschnitt, gemessen am Code-Test gefuehrt-0

**Status:** ✅ Done (2026-09-23)
**Typ:** aus Item ITEM-2026-482 (finding)
**Erstellt:** 2026-09-23
**Item:** bok/items/ITEM-2026-482.json (Lane: code)

---

## Befund

CR-GC-613 hat `rules_get_violations`, `graph_test_report` und `graph_context` auf die Scheibe
geschnitten (−85 % auf den drei zusammen). Die beiden Werkzeuge, die danach oben stehen, hat es
**nicht** angefasst — gemessen am Lauf `gefuehrt-0`: `graph_elements` 2 Aufrufe / 14.286 Zeichen,
`graph_expand` 2 / 8.448.

Beide antworten mit **voller Prosa je Knoten**, obwohl keiner von beiden eine Prosa-Frage
beantwortet:

- `graph_elements` beantwortet *welche Elemente vom Typ X gibt es* — das ist eine Identitätsfrage.
  Nachgemessen am eigenen Modell (872 Knoten), `limit: 100` je Typ, JSON-Antwortgröße:

  | Typ | mit Prosa | ohne Prosa |
  |---|---:|---:|
  | FUNC (100) | 43.410 | 17.962 (−59 %) |
  | REQ (100) | 39.740 | 18.728 (−53 %) |
  | TEST (100) | 53.348 | 27.690 (−48 %) |
  | CR (100) | 80.950 | 18.040 (−78 %) |
  | FLOW (100) | 32.500 | 12.194 (−62 %) |

- `graph_expand` beantwortet *was hängt hier noch dran* — eine Strukturfrage. Es serialisiert die
  Kuzu-Nachbarschaft ungekürzt, während `graph_context` auf derselben Nachbarschaft seit CR-GC-613
  kürzt. Zwei Werkzeuge, eine Frage, zwei Antwortgrößen.

**Ein Verbraucher braucht die Prosa wirklich.** `executor-gate.ts` baut aus `graph_elements` den
ND-Ähnlichkeitsindex (`duplicateHits`), und der vergleicht **Beschreibungen**. Ein pauschaler
Schnitt würde die Duplikat-Erkennung still verschlechtern — genau die Sorte Falsch-Grün, gegen die
dieses Repo seine Messtests schreibt.

## Zielbild

Dieselbe Marke, dieselbe Legende, dieselbe Regel wie CR-GC-613 — kein zweiter Kürzungsweg:

- `graph_elements` liefert Identität und Attribute, die Beschreibung als `…` plus die **eine**
  Legendenzeile. Wer den Wortlaut braucht, nimmt `graph_get_node` (steht in der Legende).
- `graph_elements({ prosa: true })` ist der benannte Ausweg für den einen Verbraucher, der den
  Text semantisch auswertet. Der Executor setzt ihn beim Indexbau — **explizit**, nicht als
  stiller Sonderfall.
- `graph_expand` antwortet mit **Identität**: der Handle behält seinen Wortlaut, alles andere steht
  als Knoten und Kante da.

  **Nicht die Kontext-Regel — und das ist gemessen, nicht gesetzt.** Der erste Anlauf übernahm
  `kuerzeAussenring` samt REQ/SCHEMA-Ausnahme, weil das „dieselbe Regel" gewesen wäre. Am Golden
  (Anker `FUNC-execute-agent-run-persist-state`, `depth: 2`) spart das **12 %** (5.735 → 5.038),
  die Identität **50 %** (→ 2.852) — die Nachbarschaft eines Ankers besteht eben überwiegend aus
  genau den Typen, die die Ausnahme verschont. Die Ausnahme hat ihren Grund darin, dass man aus
  REQ- und SCHEMA-Wortlaut den Anker **baut**; `graph_expand` vertieft einen Blast-Radius (R13) und
  beantwortet, **was** dranhängt. Geöffnet wird danach, mit `graph_context`/`graph_get_node`.

  Damit gibt es zwei Kürzungsregeln für zwei Fragen — „das hier bauen" (Anker + REQ + SCHEMA) und
  „was gibt es / was hängt dran" (Identität) — und keine dritte.

## Akzeptanzkriterien

- [x] `graph_elements` mindestens 40 % kleiner als heute, bei gleicher Knotenzahl und gleichen uids
      — am Golden gemessen: REQ-Liste 37.181 → 21.883 (−41 %), am eigenen Modell je Typ −48 bis −78 %
- [x] Die Legende steht **einmal** je Antwort, nicht je Knoten (CR-GC-613, gemessen: ein Hinweis je
      Knoten kostete 1.178 Zeichen auf 30 Knoten)
- [x] `graph_elements({prosa:true})` liefert byte-identisch das, was heute herauskommt
- [x] Der ND-Index des Executors trägt weiter Beschreibungen — `tests/executor-gate.duplicate-index.test.ts`
      prüft den FUND (0,875 mit Prosa gegen 0,375 ohne) und war ohne `prosa: true` rot
- [x] `graph_expand` kürzt auf Identität (5.735 → 2.852, −50 %), Knoten- und Kantenzahl unverändert
- [ ] Testsuite grün

## Umfang

`src/surface/read.ts`, `src/loop/executor-gate.ts`, `tests/read-tools.scope.test.ts`,
`tests/executor-gate.duplicate-index.test.ts` (neu) — 4 Dateien.
