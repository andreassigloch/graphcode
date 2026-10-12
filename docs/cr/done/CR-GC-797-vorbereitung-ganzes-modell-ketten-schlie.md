# CR-GC-797: Vorbereitung ganzes Modell: Ketten schliessen vor der FMEA aller Ketten

**Status:** ✅ Done (2026-10-12)
**Typ:** aus Item ITEM-2026-860 (finding)
**Erstellt:** 2026-10-12
**Item:** bok/items/ITEM-2026-860.json (Lane: graph)
**Freigabe:** Autor, 2026-10-12 („1-8 umsetzen"). Reine Modellarbeit, kein Quellcode. Skill
`se-vorbereitung` (Version 2), Schritte 1 bis 3.

---

## Befund

Die Eingangsprüfung der FMEA aller Ketten (graphVersion 716) fand offene Verdrahtung, bevor ein
Risiko bewertet war:

- acht Befunde der Regel R-21 (eine Funktion übergibt an eine andere, beide teilen keine Wirkkette)
  an sechs Funktionen,
- vier Befunde der Regel FC-04 (Kette ohne Akteur am Eingang oder am Ausgang),
- eine Zusage am falschen Erfüller: `REQ-audit-trail` hing an `FUNC-graph-impact`, während
  `FUNC-audit-trail` und `FUNC-audit-stats` keine Anforderung erfüllten (R-02).

Leitsatz der Züge, vom Autor am 2026-10-12 gesetzt: Worauf ein Glied synchron wartet, gehört zur
Kette.

## Züge (graphVersion 717 auf 718, ein Stapel, vorher im Trockenlauf)

| # | Zug | Schließt |
|---|---|---|
| 1 | `FUNC-cli-dispatch` und `FUNC-create-harness` werden Glieder von `FCHAIN-recall` | R-21 an beiden (Übergabe an `FUNC-rewind`), FC-04 an der Kette |
| 2 | `FUNC-create-harness` wird Glied von `FCHAIN-model-import` | R-21 (Übergabe an `FUNC-import-code-verb`) |
| 3 | `FUNC-serve-stdio` und `FUNC-tool-context` werden Glieder von `FCHAIN-repo-lifecycle` | R-21 an `FUNC-create-harness`, `FUNC-bind-tools`, `FUNC-tool-context` |
| 4 | `FUNC-export-markdown` wird Glied von `FCHAIN-snapshot-freshness` | R-21 an `FUNC-auto-export` |
| 5 | `FUNC-graph-store` und `FUNC-mutate` werden Glieder von `FCHAIN-merge-branches` | FC-04 an der Kette; sie hat jetzt drei Glieder |
| 6 | `REQ-audit-trail`: Erfüller `FUNC-graph-impact` gelöscht, `FUNC-audit-trail` und `FUNC-audit-stats` angelegt | R-02 an beiden |
| 7 | `FUNC-graph-store` und `FUNC-mutate` werden Glieder von `FCHAIN-repo-lifecycle` (die Erstbefüllung wartet auf das Urteil des Gates) | Import `FLOW-gate-verdict`, Übergabe `FLOW-mutate-cmd-bootstrap` |
| 8 | `FLOW-mcp-tool` trägt `sync: async` (die Werkzeugdefinition wird beim Start an die Registry geliefert, niemand wartet im Aufruf) | Kennzeichnung; der Fluss bleibt Import der Kette |

Umfang am CR-Knoten: `relation` auf die acht bewegten Funktionen und `REQ-audit-trail`. Eine Kante
vom CR auf eine Wirkkette lässt die Grammatik nicht zu (R-18).

## Ergebnis (aus `graph_metrics` und `rules_evaluate`, graphVersion 718)

| Größe | vorher | nachher |
|---|---|---|
| R-21 | 8 | 1 |
| FC-04 | 4 | 2 |
| R-02 | 5 | 3 |
| Ketten mit Import | 6 | 1 |
| Ketten mit Übergabe | 5 | 1 |
| bewertbare Ketten | 24 von 25 | 24 von 25 |
| Ketten mit lesbarem Antwortweg | 8 | 7 (`FCHAIN-merge-branches` verliert ihn: das Gate ist jetzt Glied) |

`FUNC-graph-store` liegt jetzt in 19 Ketten, `FUNC-mutate` in 15. Die Träger der fünf Risiken sind
unverändert.

## Benannt offen

- **`FCHAIN-schema-migration`** bleibt nicht bewertbar (`loose-member`, R-31, R-20, FC-04):
  `FUNC-migrate-schema` ist nicht gebaut. Klasse „Funktion fehlt", kein Zug; der Bau liegt im Entwurf
  CR-DRAFT-GC-437.
- **`FCHAIN-codec-roundtrip`** (FC-04): ein Glied, kein Ausgang zum Akteur. Die Kette ist ein Rest
  seit CR-GC-631; sie aufzulösen ist ein Umbau, keine Vorbereitung.
- **R-21 an `FUNC-compute-steering-delta`** (Übergabe an `FUNC-bind-tools`): vom Autor im ersten
  Lauf der FMEA (CR-GC-779) nicht als Hindernis gewertet.
- **R-02 an `FUNC-export-marker`, `FUNC-import-code`, `FUNC-import-doc`:** Alle drei liegen in der
  Kette eines Use Case; es fehlt je eine funktionale Anforderung. Die Zusage steht heute
  nicht-funktional an der Kette (`REQ-graph-snapshot-per-commit`, `REQ-model-exchange-post`,
  `REQ-no-extraction`).
- **Zusagen mit mehreren Erfüllern** (`REQ-store-owner-lifecycle` 5, `REQ-steering-from-metrics` 8,
  `REQ-held-back-traces-named` 4): Zerlegen braucht neue Anforderungen mit Tests, eigener CR.
- **Antwortweg:** 17 messbare Ketten bleiben ohne lesbaren Weg; Hindernis sind die Befehle an das
  Gate (ITEM-2026-843).
