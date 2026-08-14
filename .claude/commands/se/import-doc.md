---
name: se:import-doc
version: 1
description: Dokument (PDF/Markdown/Text) zweistufig in den Graph importieren (»Struktur vor KI«) — Skelett zeigen, Typ-Entscheidungen im Chat, LLM-Extract durchs Apply-Gate; Merge (adds-only), nie Reseed
---

Der Dokument-Import-Pfad (CR-GC-337, graphify CR-GF-139): ein Chaos-Dokument (Manual, Datenblatt,
Lastenheft) wird **zweistufig** in den Graph gebracht. Stufe 1 ist deterministisch (0 LLM) und zeigt
das Gliederungs-Skelett; der Mensch entscheidet die Typ-Zuordnung **im Chat** (der MCP-Client ist das
UI); Stufe 2 extrahiert mit LLM und importiert durchs Apply-Gate.

## Wann dieser Zug richtig ist

- Ein governtes Dokument (PDF/md/txt) soll SE-Elemente (UC/REQ/MOD/FUNC …) in den Graph beitragen.
- Der bestehende Graph soll **erhalten** bleiben: der Import ist Merge (adds-only durchs Gate),
  nie Reseed — Gegensatz zu `se:import-code`.

**Nicht** der richtige Zug: TS-Codebasis → `se:import-code` (deterministisch, Reseed).

## Voraussetzungen

- Kein laufender MCP-Host auf demselben Store (sonst `StoreOwnershipError`).
- LM Studio (o. kompatibel) erreichbar — Env `LLM_BASE` (Default `http://127.0.0.1:1234/v1`),
  `LLM_MODEL` (Default `qwen/qwen3.6-27b`). **Laufzeit-Warnung:** Stufe 2 slict das ganze Dokument
  durchs lokale LLM — bei großen Manuals Stunden (LLM-LOAD-PROFILE). Erst mit kleinen/mittleren
  Dokumenten arbeiten.
- `@sigloch/graphify` mit `graphify_structure`-API (≥ CR-GF-139; dev: Sibling-Symlink).
- PDF-Eingang braucht poppler `pdftotext` auf dem PATH.

## Stufe 1 — Skelett zeigen (deterministisch, 0 LLM)

Schreibe dieses Skript nach `.graphcode/tmp/import-doc-structure.mts` (im Repo — bare imports
lösen über die Repo-`node_modules`) und führe es vom Repo-Root aus:
`npx tsx .graphcode/tmp/import-doc-structure.mts <datei> [...]`

```ts
import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { handleMcpStructure, pdfToText } from '@sigloch/graphify';

const files = process.argv.slice(2);
const read = (p: string): string => (extname(p).toLowerCase() === '.pdf' ? pdfToText(p) : readFileSync(p, 'utf8'));
const documents = files.map((p) => ({ id: basename(p), filename: basename(p), text: read(p) }));
console.log(JSON.stringify(handleMcpStructure({ documents }), null, 1));
```

Dann dem Nutzer **rendern** (kompakter Markdown-Baum, nicht das rohe JSON): pro Knoten
`number`/`name`, Einrückung nach `depth`, `blockTokens` als Größenindiz. Knoten ohne `name` sind
nicht adressierbar (vom Harvest gefiltert) — weglassen.

Dazu einen **Typ-Vorschlag** machen (Draft-Zuordnung nach Dokumenttyp, Familie-Heuristik:
Manual-Knoten = MOD-Anker, SYS nur komponentenübergreifend):

| Dokumenttyp | Gliederungsknoten → | Blocktext liefert → |
|---|---|---|
| Datenblatt | MOD (Baugruppe/Peripherie) | SCHEMA, REQ, FUNC |
| Betriebsanleitung | MOD-Anker, semantisch FUNC/UC | UC, REQ, MOD |
| Installationshandbuch | FCHAIN/UC (Ablauf) | REQ, MOD |
| Lastenheft/Spec | REQ-Gruppen | REQ, TEST |

Mit AskUserQuestion klären: (a) Dokumenttyp bestätigen, (b) abweichende Knoten-Typen, (c) Knoten
ausschließen. Ergebnis nach `.graphcode/tmp/decisions.json` schreiben —
`[{"node":"<name>","type":"MOD"}, {"node":"<name>","exclude":true}, …]`
(`node` = Skelett-`name` **verbatim**; nur 13 SE-Typen aus `@sigloch/contracts/se`).

## Stufe 2 — Extract + Import durchs Gate

Skript nach `.graphcode/tmp/import-doc-run.mts`, Decisions-JSON daneben, dann vom Repo-Root:
`npx tsx .graphcode/tmp/import-doc-run.mts .graphcode/tmp/decisions.json <datei> [...]`:

```ts
import { readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { handleMcpExtract, pdfToText, LMStudioClient, McpConsumerGate } from '@sigloch/graphify';

const repoRoot = process.cwd();
// Member-Repo: Paket aus node_modules; graphcode-Dev-Repo selbst: dist-Fallback.
const gc = await import('@sigloch/graphcode').catch(() => import(join(repoRoot, 'dist/index.js')));

const [decisionsPath, ...files] = process.argv.slice(2);
const decisions = JSON.parse(readFileSync(decisionsPath, 'utf8'));
const read = (p: string): string => (extname(p).toLowerCase() === '.pdf' ? pdfToText(p) : readFileSync(p, 'utf8'));
const documents = files.map((p) => ({ id: basename(p), filename: basename(p), text: read(p) }));

// Member-Name wie graphcode mcp (package.json-Name, unscoped, sanitisiert; Fallback Verzeichnisname).
const member = ((): string => {
  try {
    const n = String(JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')).name ?? '');
    const u = n.includes('/') ? n.slice(n.lastIndexOf('/') + 1) : n;
    return u.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/^-+|-+$/g, '') || basename(repoRoot);
  } catch { return basename(repoRoot); }
})();

const harness = await gc.createHarness({ repoRoot, scope: { workspaceId: member, systemId: member } });
await harness.initialize();
try {
  if (harness.getGraph().nodes.length === 0) { try { await harness.seedFromJson(); } catch { /* Erstlauf */ } }
  const registry = gc.bindToolsToHarness(harness);
  const transport = async (commands: unknown[]) => {
    const res = await registry['graph_mutate'].handler({ commands, consumerId: 'import-doc' });
    return { success: res.success, tier: res.tier, violations: (res.violations ?? []).map((v: any) => ({
      ruleId: v.ruleId, severity: v.severity, elementId: v.elementId ?? '', message: v.message,
      ...(v.fixHint !== undefined ? { fixHint: v.fixHint } : {}) })) };
  };
  const r = await handleMcpExtract(
    { documents, decisions, bundleId: `import-doc-${new Date().toISOString().slice(0, 10)}` },
    { client: new LMStudioClient(), gate: new McpConsumerGate(transport) },
  );
  let exportPath: string | undefined, exportError: string | undefined;
  try { exportPath = ((await registry['graph_export'].handler({})) as any)?.graphJson?.path; }
  catch (e) { exportError = e instanceof Error ? e.message : String(e); }
  console.log(JSON.stringify({
    status: r.importResult.status, candidates: r.candidateCount,
    autoApprove: r.autoApprove, review: r.review,
    applied: { nodes: r.importResult.appliedNodesCount, edges: r.importResult.appliedEdgesCount },
    violations: r.importResult.violations, exportPath, exportError,
  }, null, 1));
} finally { await harness.close(); }
```

## Ergebnis deuten

- `tier`/`violations` sind das **governte Gate-Verdict** — Warnings (z. B. FUNC ohne satisfy) sind
  Arbeitsvorrat für die Absichtsebene, kein Importfehler. Blockt das Gate: nichts wurde geschrieben.
- `graph_export` committet den Stand (kanonischer Sync-Pfad); `exportError` berichten, nicht crashen.
- Dem Nutzer melden: Status, Kandidaten (auto/review), applied nodes/edges, Top-Violations.

## Grenzen (v1) + Recovery

- Eine Decision wirkt auf den **Skelett-Knoten-Kandidaten** (Typ/Ausschluss). Block-Vererbung
  (Typ-Prior für Funde im Block, block-scoped Windows) kommt mit dem `proseWindows`-Umbau (offen).
- Merge ist adds-only: bestehende Knoten werden nie gelöscht. Rückbau: `graphcode rewind <ref>`
  (CR-GC-311) oder gezielte delete-Kommandos via `graph_mutate`.
