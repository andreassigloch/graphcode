# CR-GC-260: Übergroße Module aufteilen — BACKLOG

**Status:** done (2026-07-26) — alle vier Module geschnitten; Restpunkte → CR-GC-261 · **Max Files:** je Modul eigener CR
**Trigger:** pro Modul ziehen, wenn es das nächste Mal fachlich angefasst wird — nicht als
Sammel-Refactor. Ein reiner Verschiebe-Commit über 4 Module gleichzeitig ist nicht review-bar und
kollidiert mit jeder parallelen Arbeit.
**Kontext:** Audit 2026-07-26. `CLAUDE.md` setzt 500 Zeilen als Grenze; fünf Module lagen darüber.
`src/mcp-tools.ts` (1273) hat mit CR-GC-256 seinen eigenen CR — hier stehen die restlichen vier.

## Problem (Why)

| Modul | Zeilen | Faktor |
|---|---|---|
| `src/exporter-views.ts` | 996 | 2,0× |
| `src/harness.ts` | 745 | 1,5× |
| `src/scaffold.ts` | 624 | 1,25× |
| `src/readiness.ts` | 608 | 1,2× |

Die Grenze existiert nicht aus Ästhetik: sie hält ein Modul in einem Context-Window
zuverlässig editierbar (Begründung in `CLAUDE.md`: >8 Dateien bzw. große Dateien werden für
kleinere Modelle und gefüllte Kontexte unzuverlässig). Bei 996 Zeilen lädt jede
Ein-Zeilen-Änderung am Renderer das komplette View-Set in den Kontext.

## Vorschlag pro Modul (nicht verriegelt — beim Ziehen prüfen)

1. **`exporter-views.ts` (996)** — der klarste Schnitt: 16 Views in einer Datei. Trennen nach
   Zielgruppe, z.B. `views/incose.ts` (srs/nfr/rtm/icd/testconcept/testmatrix/intplan) vs.
   `views/graphcode.ts` (spec/architecture/cr-list/references/changelog/fmea/conops/trade/implplan).
   Die Helfer (`generatedHeader`/`byUid`/`cell`) bleiben in `exporter.ts` — ein Renderer, keine
   Parallelpfade. **Byte-Determinismus ist die Akzeptanz:** alle 16 Views vor/nach dem Schnitt
   byte-identisch (`tests/exporter.test.ts` + `views.no-fork.test.ts`).
2. **`readiness.ts` (608)** — natürliche Naht liegt bei CR-GC-250: die Completeness-Dimension
   (`scoreCompleteness` + Kardinalitäts-Map) ist ein eigenes Thema neben Compliance/Gates
   → `readiness-completeness.ts`. Muss browser-safe bleiben (kein `node:*`), da die Panels-Schicht
   darauf baut.
3. **`scaffold.ts` (624)** — Templates von Lifecycle-Logik trennen: die eingebetteten
   Datei-Inhalte (GRAPHCODE.md, `.mcp.json`, Settings, Hook-Kopien) nach `scaffold-templates.ts`,
   die idempotente init/update/remove-Mechanik bleibt. Akzeptanz: `tests/cli.scaffold.test.ts` +
   `distribution.test.ts` unverändert grün (die Templates landen im Tarball).
4. **`harness.ts` (745)** — **letztes und vorsichtigstes.** Trägt das Apply-Gate (L1), den
   Store-Lock (O2) und den Write-Mutex (O3). Kandidat wäre der Import-/Seed-Pfad
   (`seedFromJson`/Batch-Import) heraus; das Gate selbst wird **nicht** verschoben. Nicht
   „nebenbei" anfassen — ein Fehler hier ist ein Governance-Fehler, kein Formatierungsfehler.

## Reihenfolge & Abhängigkeit

`exporter-views` → `readiness` → `scaffold` → `harness` (steigendes Risiko). **Nach CR-GC-256**,
damit nicht zwei Struktur-CRs gleichzeitig offen sind.

## Akzeptanz (für jeden Einzel-CR)

- [ ] Reines Verschieben: keine Signatur-, Ausgabe- oder Semantik-Änderung.
- [ ] Kein bestehender Test editiert — grün bleiben ist der Beweis (bei `exporter-views`
      zusätzlich: Views byte-identisch).
- [ ] Zielmodul und Restmodul beide < 500 Zeilen; kein neues Modul wird zum nächsten Grenzfall.
- [ ] `npm run build` + `npm run bundle` grün (neue Module müssen im Self-contained-Bundle landen).
