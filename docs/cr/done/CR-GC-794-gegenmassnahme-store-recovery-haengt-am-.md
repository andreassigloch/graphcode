# CR-GC-794: Gegenmassnahme Store-Recovery haengt am Modul statt am Traeger

**Status:** ✅ Done (2026-10-12)
**Typ:** aus Item ITEM-2026-853 (finding)
**Erstellt:** 2026-10-12
**Item:** bok/items/ITEM-2026-853.json (Lane: graph)
**Freigabe:** Autor, 2026-10-12. Reine Modellarbeit, kein Quellcode. Skill `se-vorbereitung` (Version 2), Schritt 2, Klasse Tieferlegen.

---

## Befund

Eingangsprüfung der FMEA aus `graph_metrics.riskCarriers` (graphVersion 710): die Gegenmaßnahme
`REQ-store-recovery` des Risikos `REQ-risk-store-unreadable` (S 9, O 2, D 3) hing per `satisfy` an
`MOD-kernel`. Ein Modul als Erfüller macht jede seiner Blattfunktionen zum Träger: 26 Träger, und
26 der 27 Funktionen in `riskCarriers.surface` kamen aus dieser einen Kante.

## Träger am Code

| Fall der Anforderung | Stelle | Aussage |
|---|---|---|
| Lock-Konflikt | `src/kernel/graph-store.ts:72` | `GraphStore.open()` ruft `lock.acquire()`; einziger Aufrufer von `acquire` in `src/` |
| | `src/kernel/store-lock.ts:104-123` | `acquire()` legt die Sperrdatei atomar an, wirft bei lebendem Besitzer `StoreOwnershipError` (Zeile 119) |
| abgestürzter Besitzer | `src/kernel/store-lock.ts:118` | `acquire()` ruft `reclaimIfStale()`; die Methode ist privat, kein zweiter Aufrufer |
| | `src/kernel/store-lock.ts:182-210` | Rückholen bei unlesbarer alter Datei, pulsloser Sperre oder toter PID auf demselben Rechner |
| Store passt nicht zum Schema | `src/kernel/graph-store.ts:86-97` | `open()` vergleicht den Fingerabdruck, löscht den Store (`resetKuzuStore`) |
| | `src/kernel/graph-store.ts:102` | `open()` setzt ihn aus dem committeten Snapshot neu auf (`applyReseed`) |
| Fehlerweg | `src/kernel/graph-store.ts:104-107` | scheitert das Öffnen, gibt `open()` die Sperre frei und reicht den Fehler weiter |

Alle Fälle liegen im Aufruf von `open()`. Träger ist `FUNC-graph-store`
(`realRef` `src/kernel/graph-store.ts`, `GraphStore`).

**Urteil, nicht Messung:** `FUNC-reseed` (`src/kernel/harness.ts:394`, Werkzeug `graph_reseed`) baut
den Store ebenfalls neu auf, und der Store ruft es nicht. Es arbeitet über das offene Handle
(`DETACH DELETE`), setzt also einen lesbaren Store voraus, und ist ein Auftrag des Bedieners. Für das
Risiko „Store nicht lesbar" ist es kein Träger. `TEST-reseed` prüft die Anforderung weiterhin
(Kante `verify` unverändert).

## Zug (graphVersion 711 auf 712)

- `REQ-store-recovery`: `kinds` von `["non-functional"]` auf `["functional"]`.
- `MOD-kernel -satisfy-> REQ-store-recovery` gelöscht, `FUNC-graph-store -satisfy-> REQ-store-recovery` angelegt.
- Wortlaut. Alt: „CONSTRAINT (ConOps): Recovery bei Kuzu Lock-Konflikt / abgestürztem Owner /
  korruptem Store — Lock-Erkennung + sicherer Re-Open." Neu: „Beim Öffnen weist der Store einen
  zweiten Schreiber mit Nennung des Besitzers ab, holt die Sperre eines beendeten oder pulslosen
  Besitzers zurück und setzt einen Store, der nicht zum aktuellen Schema passt oder nicht lesbar
  ist, aus dem committeten Snapshot neu auf. Es entsteht kein zweites DB-Handle. (ConOps Recovery)"
- Umfang am CR-Knoten: `relation` auf `REQ-store-recovery` und `FUNC-graph-store`.

`REQ-risk-store-unreadable` bleibt `non-functional` an `MOD-kernel` und `SYS-graphcode`.

## Abnahme

| Größe | davor (710) | danach (712) |
|---|---|---|
| Träger von `REQ-risk-store-unreadable` | 26 | 1: `FUNC-graph-store` |
| `riskCarriers.surface` | 27 | 3: `FUNC-generation-step`, `FUNC-graph-store`, `FUNC-mutate` |
| Fehler am Gate | 0 | 0 |
| Marken | SRR erreicht | unverändert |
| Befunde je Regel | | unverändert bis auf `MS-03` 242 auf 243 (der neue CR-Knoten) |
| Steuerwert | 4,0012 | 4,0012 |

Der Trockenlauf meldete keine Warnung (kein R-02, RD-01, R-18).

## Offen

1. **Der Fall „Store nicht lesbar" ist im Code nur für den Schema-Versatz ausgeführt.** Eine
   beschädigte Kuzu-Datei mit passendem Fingerabdruck erkennt niemand: `storage.initialize()` oder
   `load()` wirft, `open()` gibt die Sperre frei und reicht den Fehler weiter
   (`graph-store.ts:99-107`), ein Neuaufbau findet nicht statt. Die Anforderung verlangt ihn. Sie
   bleibt `status: open`; die Lücke ist ein Eingang der FMEA (Entdeckung und Auftreten des Risikos).
2. **`TEST-store-recovery` bleibt ohne `testRefs`.** Die Dateien, die Sperr-Erkennung, Rückholen
   und Neuaufbau prüfen, gehören schon anderen Tests: `tests/store-lock.test.ts` zu
   `TEST-store-lock`, `tests/schema-guard.test.ts` zu `TEST-schema-migration`. Eine zweite Bindung
   lehnt das Gate ab (R-29, eine Testdatei gehört höchstens einem TEST). Kein Test prüft eine
   beschädigte Store-Datei. `TEST-schema-migration` und `TEST-reseed` prüfen die Anforderung über
   `verify`; `TEST-store-lock` prüft sie nicht. Vorschlag: `TEST-store-lock -verify-> REQ-store-recovery`.
