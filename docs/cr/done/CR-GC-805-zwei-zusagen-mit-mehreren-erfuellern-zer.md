# CR-GC-805: Zwei Zusagen mit mehreren Erfuellern zerlegen: zurueckgehaltene Kanten, Store-Besitz; Neuwahlversuch als eigene Funktion

**Status:** ✅ Done (2026-10-13)
**Typ:** aus Item ITEM-2026-888 (finding)
**Erstellt:** 2026-10-13
**Item:** bok/items/ITEM-2026-888.json (Lane: graph)

**Freigabe:** Autor, 2026-10-13 („B B", „Neuwahlversuch dann eigene Funktion"). Reine Modellarbeit. Skill
`se-vorbereitung` (Version 2), Schritt 2, Klasse Zerlegen. Der Wortlaut der neuen Anforderungen ist Vorschlag
des Skills.

---

## Befund

Zwei Zusagen trugen mehrere Aussagen und mehrere Erfüller. Als Gegenmaßnahmen (seit CR-GC-802) machten sie
vier und fünf Funktionen zu Trägern je eines Risikos.

## Zug 1: `REQ-held-back-traces-named` zerlegt (vier Erfüller)

Die Anforderung entfällt. An ihre Stelle treten vier, je mit einem Erfüller; Eltern bleibt `REQ-graph-is-ssot`.

| Neue Anforderung | Erfüller | Nachweis |
|---|---|---|
| `REQ-held-back-edge-does-not-abort-load` | `FUNC-seed-from-json` | `TEST-import-rejected-traces` |
| `REQ-held-back-edges-derived-every-call` (Gegenmaßnahme von `REQ-risk-edge-vanishes-silently`) | `FUNC-held-back-traces` | derselbe |
| `REQ-held-back-edges-in-readiness` | `FUNC-graph-readiness` | derselbe |
| `REQ-export-refuses-until-held-back-repaired` | `FUNC-graph-export-snapshot` | derselbe |

Ein Test für vier Anforderungen: `tests/harness.import-rejected-traces.test.ts` prüft jede der vier Aussagen
in einem eigenen Fall.

## Zug 2: `REQ-store-owner-lifecycle` zerlegt (fünf Erfüller)

Die Anforderung entfällt. An ihre Stelle treten fünf; Eltern bleibt `REQ-single-kuzu-owner`.

| Neue Anforderung | Erfüller | Nachweis |
|---|---|---|
| `REQ-first-session-claims-store-lock` | `FUNC-claim-store-lock` | `TEST-store-lock` |
| `REQ-harness-factory-returns-one-owner` | `FUNC-create-harness` | `TEST-store-lock` (Fall O2: zweiter Harness wird abgewiesen) |
| `REQ-host-holds-only-kuzu-handle` | `FUNC-own-kuzu-host` | `TEST-host-shim` |
| `REQ-further-session-docks-via-socket` | `FUNC-host-socket` | `TEST-host-shim` |
| `REQ-docked-session-reelects-once` (Gegenmaßnahme von `REQ-risk-owner-ends-with-docked-sessions`) | `FUNC-docked-session` (neu) | `TEST-host-shim` (Neuwahl gelingt; ohne Neuwahl benannter Fehler) |

- `FUNC-graph-store` erfüllt die Zusage nicht mehr; das Öffnen des Stores steht in `REQ-store-recovery`.
- Die Aussage „beim Schließen sauber freigegeben" stand schon in `REQ-session-leaves-nothing-behind`;
  `TEST-session-lifecycle` prüft jetzt diese Anforderung.

## Zug 3: neue Funktion `FUNC-docked-session`

Der Neuwahlversuch liegt im Code auf der Seite der angedockten Sitzung (`buildProxyRegistry`,
`src/surface/host-shim.ts:147`), nicht in der Funktion, die den Socket öffnet (`startHostSocket`). Das Modell
führte für die Datei nur `FUNC-host-socket`.

- `FUNC-docked-session`, gebunden an `buildProxyRegistry`, in `MOD-surface`, unter `FUNC-block-host-sitzung`,
  Glied von `FCHAIN-apply-gate`.
- Die Befehle von Agent und Besitzer (`FLOW-mutate-cmd-agent`, `FLOW-mutate-cmd-owner`) gehen jetzt an die
  angedockte Sitzung statt direkt an den Socket; von dort führt der neue Fluss
  `FLOW-mutate-cmd-docked-session` (synchron, Vertrag `SCHEMA-mutate-command`) an `FUNC-host-socket`.
- Nicht modelliert: der Weg nach gelungener Neuwahl, auf dem die Sitzung lokal an das Gate reicht.

## Ergebnis (aus `graph_metrics`, graphVersion 745 auf 746)

- Fläche 19 auf 14 Funktionen. Mehr als einen Träger haben nur noch zwei Risiken, je mit zwei:
  `REQ-risk-audit-evaluation-unowned` (Verlauf und Statistik) und `REQ-risk-stale-test-result` (zwei
  Gegenmaßnahmen an zwei Orten).
- `FCHAIN-apply-gate` hat 14 Glieder und bleibt bewertbar; kein neuer Import, keine neue Übergabe.
- Das Gate meldet weiter RD-04 an `MOD-surface` (jetzt 23 Elemente auf einer Ebene, vorher 22); der Befund
  bestand schon.

## Nachzug an einem Test

`tests/hooks.inject-graph-slice.test.ts` führt eine Liste real geänderter Knoten des eigenen Modells (CR-GC-114)
und nannte darin `REQ-store-owner-lifecycle`. Der erste Commit-Versuch war deshalb rot. Die Liste nennt jetzt
den Nachfolger `REQ-host-holds-only-kuzu-handle`, wie bei früheren Zusammenlegungen (CR-GC-383, CR-GC-401).
Geprüft mit der Auswahl aus dem Graphen: `npm run verify:code`, 50 von 190 Dateien, 438 Tests grün.
