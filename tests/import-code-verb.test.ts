/**
 * CR-GC-298 — `graphcode import-code` (import-code-verb.ts): deterministischer
 * Code-Repo-Import mit RESEED-Semantik ueber den Produktions-Pfad
 * (executeImportCode = exakt der cli.ts-Pfad, kein Parallelweg).
 * Realer Disk-Store, echte Fixture-Dateien auf Disk (discoverTsFiles laeuft mit).
 */
import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness } from '../src/index.js';
import { discoverTsFiles, executeImportCode } from '../src/surface/import-code-verb.js';

/** Gleiche Form wie graphifys eigener CR-GF-133/134-Fixture-Test. */
const FILE_A = `
import { funcB } from './fileB';

export function funcA(x: number): string {
  return funcB(x);
}
`;
const FILE_B = `
export function funcB(s: string): boolean {
  return s.length > 0;
}
`;

function writeFixture(repoRoot: string): void {
  mkdirSync(join(repoRoot, 'src'), { recursive: true });
  writeFileSync(join(repoRoot, 'src', 'fileA.ts'), FILE_A);
  writeFileSync(join(repoRoot, 'src', 'fileB.ts'), FILE_B);
  // Muss vom Discovery ausgeschlossen sein (node_modules + Dot-Dir + .d.ts):
  mkdirSync(join(repoRoot, 'node_modules', 'x'), { recursive: true });
  writeFileSync(join(repoRoot, 'node_modules', 'x', 'ignored.ts'), 'export function nope(): void {}');
  writeFileSync(join(repoRoot, 'src', 'types.d.ts'), 'export declare function nope(): void;');
}

type EdgeKey = { sourceId: string; targetId: string; edgeType: string };
async function readGraph(
  repoRoot: string,
): Promise<{ uids: string[]; types: string[]; edges: number; edgeList: EdgeKey[] }> {
  const harness = await createHarness({ repoRoot, scope: { workspaceId: 'check', systemId: 'check' } });
  await harness.initialize();
  try {
    const g = harness.getGraph();
    return {
      uids: g.nodes.map((n) => n.uid),
      types: g.nodes.map((n) => n.type),
      edges: g.edges.length,
      edgeList: g.edges.map((e) => ({ sourceId: e.sourceId, targetId: e.targetId, edgeType: e.edgeType })),
    };
  } finally {
    await harness.close();
  }
}

describe('discoverTsFiles (CR-GC-298)', () => {
  it('finds .ts/.tsx, skips node_modules, dot-dirs and .d.ts', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-import-disc-'));
    try {
      writeFixture(repoRoot);
      mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
      writeFileSync(join(repoRoot, '.graphcode', 'hidden.ts'), 'export function hidden(): void {}');
      const files = discoverTsFiles(repoRoot);
      expect(files.map((f) => f.path)).toEqual(['src/fileA.ts', 'src/fileB.ts']);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});

describe('executeImportCode (CR-GC-298)', () => {
  it('imports the fixture into the disk store: FUNC/MOD/FLOW/SCHEMA, 0 violations, export written, lock free', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-import-'));
    try {
      writeFixture(repoRoot);
      const summary = await executeImportCode({ repoRoot });

      expect(summary.status).toBe('success');
      // Warnings (R-20 realRef, R-21, R-26) sind der erwartete Arbeitsvorrat
      // fuer die Absichtsebene — Errors waeren ein Import-Fehler.
      expect(summary.violations.filter((v) => v.severity === 'error')).toEqual([]);
      expect(summary.violations.length).toBeGreaterThan(0);
      expect(summary.files).toBe(2);
      expect(summary.extracted.FUNC).toBe(2);
      // CR-GF-149: 2 Datei-MODs + 1 Verzeichnis-MOD (`src`).
      expect(summary.extracted.MOD).toBe(3);
      expect(summary.extracted.FLOW).toBe(1);
      expect(summary.extracted.SCHEMA).toBe(1);
      // Erstlauf auf leerem Graph: kein Backup.
      expect(summary.backupPath).toBeUndefined();
      expect(summary.exportPath).toBeTruthy();
      expect(existsSync(join(repoRoot, summary.exportPath as string))).toBe(true);

      // Lock freigegeben + Persistenz auf Disk: ein zweiter Harness liest den Import.
      const g = await readGraph(repoRoot);
      expect(g.types.filter((t) => t === 'FUNC')).toHaveLength(2);
      expect(g.types.filter((t) => t === 'MOD')).toHaveLength(3);
      expect(g.types.filter((t) => t === 'FLOW')).toHaveLength(1);
      expect(g.types.filter((t) => t === 'SCHEMA')).toHaveLength(1);
      expect(g.edges).toBeGreaterThan(0);
      // CR-GF-149 ⇒ CR-GC-527: die Verzeichnis-Hierarchie kommt als `MOD -compose-> MOD` durchs
      // Gate (R-18-legal, kein Error oben) — `src` compose-t beide Datei-MODs.
      const composeFromSrc = g.edgeList.filter((e) => e.edgeType === 'compose' && e.sourceId === 'mod_src');
      expect(composeFromSrc.map((e) => e.targetId).sort()).toEqual(['mod_src_filea_ts', 'mod_src_fileb_ts']);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  }, 60_000);

  it('re-import is a reseed: deleted function disappears, no duplicates, backup written', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-import-reseed-'));
    try {
      writeFixture(repoRoot);
      await executeImportCode({ repoRoot });

      // fileB (und damit funcB + FLOW) verschwindet aus dem Repo.
      rmSync(join(repoRoot, 'src', 'fileB.ts'));
      writeFileSync(join(repoRoot, 'src', 'fileA.ts'), '\nexport function funcA(x: number): string {\n  return String(x);\n}\n');

      const summary = await executeImportCode({ repoRoot });
      expect(summary.status).toBe('success');
      // Backup des Vor-Import-Stands existiert.
      expect(summary.backupPath).toBeTruthy();
      expect(existsSync(join(repoRoot, summary.backupPath as string))).toBe(true);

      const g = await readGraph(repoRoot);
      // Reseed: exakt 1 FUNC + 2 MOD (src + fileA), kein FLOW/SCHEMA mehr, keine Leichen/Duplikate.
      expect(g.types.filter((t) => t === 'FUNC')).toHaveLength(1);
      expect(g.types.filter((t) => t === 'MOD')).toHaveLength(2);
      expect(g.types.filter((t) => t === 'FLOW')).toHaveLength(0);
      expect(g.types.filter((t) => t === 'SCHEMA')).toHaveLength(0);
      expect(new Set(g.uids).size).toBe(g.uids.length);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  }, 60_000);

  // CR-GC-302 — der SYS-Anker. graphify extrahiert FUNC/MOD/FLOW/SCHEMA und NIE ein
  // SYS; ohne diese beiden Faelle bleibt ein code-importierter Graph un-ankerbar:
  // AF-01..05 fallen in die Vacuous-Exemption ("nothing to anchor on yet") und
  // graph_generate verliert die Intent-Quelle (SYS.description).
  it('legt beim Code-Import einen SYS-Anker an — durchs Gate, im selben Batch', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-import-sys-'));
    try {
      writeFixture(repoRoot);
      const summary = await executeImportCode({ repoRoot });
      expect(summary.status).toBe('success');

      const g = await readGraph(repoRoot);
      expect(g.types.filter((t) => t === 'SYS')).toHaveLength(1);
      // Der Anker haengt am abgeleiteten Member-Namen, nicht an einem Rateausdruck.
      expect(g.uids.filter((u) => u.startsWith('SYS-'))).toHaveLength(1);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  }, 60_000);

  it('der Reseed loescht einen vorhandenen SYS NICHT — Intention und Stamps ueberleben', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-import-sys-keep-'));
    try {
      writeFixture(repoRoot);
      await executeImportCode({ repoRoot });

      // Die Absichtsebene fuellen: Intention + ein Freshness-Stamp am Anker — genau
      // das, was ein Code-Reseed sonst als "stale" wegraeumen wuerde (die Extraktion
      // liefert diesen Knoten ja nie mit).
      const harness = await createHarness({ repoRoot, scope: { workspaceId: 'check', systemId: 'check' } });
      await harness.initialize();
      const sysUid = harness.getGraph().nodes.find((n) => n.type === 'SYS')!.uid;
      await harness.mutate([
        {
          op: 'update-node',
          node: {
            uid: sysUid,
            type: 'SYS',
            name: 'Mein System',
            description: 'Die Intention, die den Reseed ueberleben muss.',
            attributes: { status: 'draft', analysisFreshness: { conops: { graphVersion: 3 } } },
          },
        },
      ]);
      await harness.close();

      await executeImportCode({ repoRoot });

      const after = await createHarness({ repoRoot, scope: { workspaceId: 'check', systemId: 'check' } });
      await after.initialize();
      try {
        const sys = after.getGraph().nodes.filter((n) => n.type === 'SYS');
        expect(sys).toHaveLength(1);
        expect(sys[0]?.description).toBe('Die Intention, die den Reseed ueberleben muss.');
        expect(sys[0]?.attributes?.['analysisFreshness']).toEqual({ conops: { graphVersion: 3 } });
      } finally {
        await after.close();
      }
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  }, 60_000);

  // CR-GC-527 (ITEM-2026-074, Leitlinie S1/S2): der Reseed raeumt nur die Code-Herkunft
  // (FUNC/MOD/FLOW/SCHEMA/TEST) ab. Der handgeschriebene Warum-Baum — UC/REQ/ACTOR samt
  // Kanten, auch die Bindung REQ<-satisfy-FUNC an einen importierten FUNC — ueberlebt.
  it('der Reseed loescht handgeschriebene UC/REQ/ACTOR und ihre Kanten NICHT', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-import-why-'));
    try {
      writeFixture(repoRoot);
      await executeImportCode({ repoRoot });

      const harness = await createHarness({ repoRoot, scope: { workspaceId: 'check', systemId: 'check' } });
      await harness.initialize();
      const sysUid = harness.getGraph().nodes.find((n) => n.type === 'SYS')!.uid;
      const funcA = harness.getGraph().nodes.find((n) => n.type === 'FUNC' && n.name === 'funcA')!.uid;
      const setup = await harness.mutate([
        { op: 'add-node', node: { uid: 'ACTOR-nutzer', type: 'ACTOR', name: 'Nutzer', description: '', attributes: { status: 'draft' } } },
        { op: 'add-node', node: { uid: 'UC-rechnen', type: 'UC', name: 'Rechnen', description: 'Warum es das System gibt.', attributes: { status: 'draft' } } },
        { op: 'add-node', node: { uid: 'REQ-ergebnis', type: 'REQ', name: 'Ergebnis als Text', description: '', attributes: { status: 'draft', kinds: ['functional'] } } },
        // REQ-with-TEST-Invariante (R-01 ist ein Error): der handgeschriebene Konzept-TEST gehoert zum Warum-Baum.
        { op: 'add-node', node: { uid: 'TEST-ergebnis', type: 'TEST', name: 'Ergebnis-Test', description: '', attributes: { status: 'draft' } } },
        { op: 'add-edge', edge: { sourceId: sysUid, targetId: 'UC-rechnen', edgeType: 'compose', attributes: {} } },
        { op: 'add-edge', edge: { sourceId: 'UC-rechnen', targetId: 'REQ-ergebnis', edgeType: 'compose', attributes: {} } },
        { op: 'add-edge', edge: { sourceId: funcA, targetId: 'REQ-ergebnis', edgeType: 'satisfy', attributes: {} } },
        { op: 'add-edge', edge: { sourceId: 'TEST-ergebnis', targetId: 'REQ-ergebnis', edgeType: 'verify', attributes: {} } },
        // UC-02 (Error): ein UC ist ueber ACTOR -io-> FLOW -io-> FUNC in seiner FCHAIN erreichbar. FLOW und
        // FCHAIN sind hier HANDGESCHRIEBEN und zeigen auf den importierten funcA — eine Typmenge
        // (FLOW gehoert dem Import) haette sie geloescht und den Reseed an UC-02 geblockt.
        { op: 'add-node', node: { uid: 'FCHAIN-rechnen', type: 'FCHAIN', name: 'Rechnen-Kette', description: '', attributes: { status: 'draft' } } },
        { op: 'add-node', node: { uid: 'FLOW-eingabe', type: 'FLOW', name: 'Eingabe', description: '', attributes: { status: 'draft' } } },
        { op: 'add-node', node: { uid: 'SCHEMA-eingabe', type: 'SCHEMA', name: 'Eingabe-Schema', description: '', attributes: { status: 'draft' } } },
        { op: 'add-edge', edge: { sourceId: 'FLOW-eingabe', targetId: 'SCHEMA-eingabe', edgeType: 'relation', attributes: {} } },
        { op: 'add-edge', edge: { sourceId: 'UC-rechnen', targetId: 'FCHAIN-rechnen', edgeType: 'compose', attributes: {} } },
        { op: 'add-edge', edge: { sourceId: 'FCHAIN-rechnen', targetId: funcA, edgeType: 'compose', attributes: {} } },
        { op: 'add-edge', edge: { sourceId: 'ACTOR-nutzer', targetId: 'FLOW-eingabe', edgeType: 'io', attributes: {} } },
        { op: 'add-edge', edge: { sourceId: 'FLOW-eingabe', targetId: funcA, edgeType: 'io', attributes: {} } },
      ]);
      await harness.close();
      expect(setup.violations.filter((v) => v.severity === 'error')).toEqual([]);
      expect(setup.success).toBe(true);

      // Reseed auf unveraendertem Code: die Extraktion liefert UC/REQ/ACTOR nie mit.
      const summary = await executeImportCode({ repoRoot });
      expect(summary.status).toBe('success');

      const g = await readGraph(repoRoot);
      expect(g.uids).toContain('ACTOR-nutzer');
      expect(g.uids).toContain('UC-rechnen');
      expect(g.uids).toContain('REQ-ergebnis');
      expect(g.uids).toContain('TEST-ergebnis');
      expect(g.edgeList).toContainEqual({ sourceId: 'TEST-ergebnis', targetId: 'REQ-ergebnis', edgeType: 'verify' });
      // Der handgeschriebene Wie-Anteil (FLOW/FCHAIN) ueberlebt ebenso — nur die Herkunft zaehlt, nicht der Typ.
      expect(g.uids).toContain('FLOW-eingabe');
      expect(g.uids).toContain('FCHAIN-rechnen');
      expect(g.uids).toContain('SCHEMA-eingabe');
      expect(g.edgeList).toContainEqual({ sourceId: 'FLOW-eingabe', targetId: funcA, edgeType: 'io' });
      expect(g.edgeList).toContainEqual({ sourceId: 'FCHAIN-rechnen', targetId: funcA, edgeType: 'compose' });
      expect(g.edgeList).toContainEqual({ sourceId: sysUid, targetId: 'UC-rechnen', edgeType: 'compose' });
      expect(g.edgeList).toContainEqual({ sourceId: 'UC-rechnen', targetId: 'REQ-ergebnis', edgeType: 'compose' });
      expect(g.edgeList).toContainEqual({ sourceId: funcA, targetId: 'REQ-ergebnis', edgeType: 'satisfy' });
      // Und die Code-Herkunft bleibt exakt die Extraktion: keine Duplikate, gleiche Zahlen.
      expect(g.types.filter((t) => t === 'FUNC')).toHaveLength(2);
      expect(g.types.filter((t) => t === 'MOD')).toHaveLength(3);
      expect(g.types.filter((t) => t === 'FLOW')).toHaveLength(2); // 1 importiert + 1 handgeschrieben
      expect(new Set(g.uids).size).toBe(g.uids.length);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  }, 60_000);

  it('rejects a directory without TS files before touching the store', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-import-empty-'));
    try {
      await expect(executeImportCode({ repoRoot })).rejects.toThrowError(/keine \.ts/);
      // Kein Store angelegt, kein Lock hinterlassen.
      expect(existsSync(join(repoRoot, '.graphcode'))).toBe(false);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('releases the store lock even when the fixture only partially resolves (regression: lock free after verb end)', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-import-lock-'));
    try {
      writeFixture(repoRoot);
      await executeImportCode({ repoRoot });
      // Sofort erneut importieren: gelingt nur, wenn der Lock frei ist.
      const again = await executeImportCode({ repoRoot });
      expect(again.status).toBe('success');
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  }, 60_000);
});
