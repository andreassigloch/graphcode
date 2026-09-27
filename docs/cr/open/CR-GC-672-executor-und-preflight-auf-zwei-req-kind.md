# CR-GC-672: Executor und Preflight auf zwei REQ-kinds

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-583 (idea)
**Erstellt:** 2026-09-25
**Item:** bok/items/ITEM-2026-583.json (Lane: code)

---

ZIELBILD (ITEM-2026-575, Diskussion 2026-09-25): REQ.kinds = genau EIN Wert aus {functional, non-functional}. functional -> FUNC; non-functional -> MOD (lokales Budget) | SYS (Systemebene) | FCHAIN (Ende-zu-Ende). Ohne kinds kein Erfueller (BQ-07). pre-/postcondition entfallen (Vorbedingung = Eingangs-FLOW der Kette, Nachbedingung = UC-Ziel, geprueft ueber R-21). risk/mitigation werden ein Rollen-Attribut (FM-01..03), satisfy-neutral. Gemischtes functional+non-functional = falsch zerlegt -> teilen.

BEFUND: Im Rig sind kinds-satisfy die Hauptlast der Ablehnungen (107 von 166 Preflight-Blocks, Runde 20); die FCHAIN faengt auf, was unentschieden ist (gcrun-180: 46 von 62 funktionalen Erfuellungen ueber FCHAIN). Der kindsBefund-fixHint bietet heute das Umkippen der kinds auf allowed[0] an; das Format-E-Vorbild im Executor-Prompt zeigt kinds, die es kuenftig nicht mehr gibt. Vorbilder werden woertlich uebernommen (Memory executor-prompt-vorbild-statt-verbot).

ZIEL: Preflight-Meldung und fixHint kennen genau zwei Werte und sagen bei FCHAIN "nur non-functional; functional an eine FUNC"; Executor-Vorbild und Generate-Klauseln zeigen nur legale Paare; se-plan ohne pre/post.

UMFANG (laut grep, <= 10 Dateien): src/loop/preflight.ts, executor-prompt.ts, generate.ts, se-plan.ts, executor-gate.ts (falls noetig); Tests executor.preflight, generate, executor.

ABNAHME: Unit-Tests; Smeagol-Check aus [1] gruen fuer Executor-Vorbild; Rig-Messung vorher/nachher (Zaehler: kinds-Blocks je Lauf, Anteil functional ueber FCHAIN = 0) — Live-Laeufe nur nach Freigabe.

REIHENFOLGE der Kette (9 CRs): [1] GC Regel-Matrix + Smeagol-Wertebereich -> [2] SM Rollen-Attribut risk/mitigation -> [3] SM kinds auf zwei Werte + FCHAIN nur NFR (mit [2] EIN Ontologie-Major, Publish durch den Auftraggeber) -> [4] GC Migrationswerkzeug (vor dem Publish baubar) -> [5] GC Eigenmodell migrieren (graph-Lane) -> [6] GC Kern + Peer-Floor -> [7] GC Loop/Executor -> [8] GC Projektionen -> [9] GC Skills + Help. Danach Datenmigration je Familien-Repo (eigene Items, sobald [4] steht). Dies ist [7].

---

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.

## Nachtrag aus ITEM-2026-572 (2026-09-27, Schnitt CR-GC-694)

Mit in diesen CR, weil dieselben Dateien:
- **kinds in der Inventarzeile** fuer REQ (`executor-inventory.ts`): 54 der 107 kinds-Blocks in gcrun-180
  betrafen REQs, die schon im Graphen standen — das Inventar zeigte `uid · TYPE · name` ohne kinds.
- **fixHint Partner zuerst** (`preflight.ts` kindsBefund): nicht die kinds auf `allowed[0]` kippen,
  sondern den legalen Erfueller mit konkreter uid nennen (functional → FUNC der Kette des UC).
- **Beispiel-Leck:** das Vorbild `REQ-login-passwort` (Executor-SYSTEM, UC-01-Klausel generate.ts:213)
  wurde bei Saettigung inhaltlich uebernommen (21 Knoten bis UC-login in gcrun-180, Auftrag sagt „ohne
  Anmeldung"). Vorbild aus auftragsfremder Domaene oder erkennbare Platzhalter; atomar (eine Aussage).
Grenze 10 Dateien: bei Ueberschreitung Folge-CR, nicht ueberziehen.
