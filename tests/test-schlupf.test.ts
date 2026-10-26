/**
 * CR-GC-718 — Schlupf des Volllaufs gegen die Auswahl und die Zusage der Blackbox-Bindung.
 * Reine Funktionen; der Graph ist klein und synthetisch, die Kantenform die des Snapshots.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import type { Graph } from '@sigloch/graph-api-core';
import {
  blackboxBindung,
  laufUrteil,
  schlupfFreieFolge,
  type VitestLauf,
  schlupfVon,
  SCHLUPF_SCHWELLE,
  type SchlupfZeile,
} from '../src/projections/test-schlupf.js';

const LEER = { total: 0, gebunden: 0, offen: [] };
function zeile(cr: string, at: string, spur: SchlupfZeile['spur'], schlupf: string[] = []): SchlupfZeile {
  return {
    cr, at, code: 'x', spur, ausgewaehlt: 1, ausGraph: 1, gesamt: 2, rot: schlupf, schlupf, schlupfNurGraph: schlupf,
    zusage: { blackbox: LEER, schnittstelle: LEER },
  };
}

describe('Schlupf (CR-GC-718)', () => {
  it('ein roter Test ausserhalb der Auswahl ist Schlupf, getrennt nach Auswahl und Graph-Anteil', () => {
    const r = schlupfVon(['tests/a.test.ts', 'tests/b.test.ts'], ['tests/a.test.ts'], []);
    expect(r.schlupf).toEqual(['tests/b.test.ts']);
    expect(r.schlupfNurGraph).toEqual(['tests/a.test.ts', 'tests/b.test.ts']);
    expect(schlupfVon([], ['tests/a.test.ts'], []).schlupf).toEqual([]);
  });

  it('die Folge zaehlt CODE-CRs ohne Schlupf rueckwaerts, VOLL ist neutral, Schlupf bricht ab, ein Schlupf in irgendeinem Lauf eines CR zaehlt', () => {
    const zeilen = [
      zeile('CR-0', '2025-12-31', 'CODE'), // vor dem Schlupf — darf nicht mehr zaehlen
      zeile('CR-1', '2026-01-01', 'CODE', ['tests/x.test.ts']),
      zeile('CR-2', '2026-01-02', 'CODE'),
      zeile('CR-3', '2026-01-03', 'VOLL'),
      zeile('CR-4', '2026-01-04', 'CODE', ['tests/y.test.ts']),
      zeile('CR-4', '2026-01-05', 'CODE'), // Nachlauf nach dem Fix verdeckt den Schlupf NICHT (CR-GC-720)
      zeile('CR-5', '2026-01-06', 'CODE'),
    ];
    expect(schlupfFreieFolge(zeilen)).toBe(1);
    // ohne CR-4 zaehlt die Folge bis zum Schlupf von CR-1: CR-5, CR-2 (CR-3 VOLL neutral)
    expect(schlupfFreieFolge(zeilen.filter((z) => z.cr !== 'CR-4'))).toBe(2);
    expect(SCHLUPF_SCHWELLE).toBe(10);
  });
});

describe('Zusage: Blackbox- und Schnittstellentests gebunden (CR-GC-718)', () => {
  const n = (uid: string, type: string, attributes: Record<string, unknown> = {}) => ({ uid, type, name: uid, description: '', attributes });
  const e = (sourceId: string, edgeType: string, targetId: string) => ({ sourceId, edgeType, targetId, attributes: {} });
  const ref = { testRefs: [{ file: 'tests/x.test.ts' }] };
  const real = { realRef: { file: 'src/x.ts' } };
  const graph = {
    nodes: [
      n('MOD-a', 'MOD'), n('FUNC-top', 'FUNC'), n('FUNC-innen', 'FUNC'),
      n('REQ-mod', 'REQ'), n('REQ-top', 'REQ'), n('REQ-innen', 'REQ'),
      n('TEST-mod', 'TEST', ref), n('TEST-top', 'TEST'), n('TEST-innen', 'TEST'),
      n('FLOW-f', 'FLOW'), n('SCHEMA-ok', 'SCHEMA', real), n('SCHEMA-offen', 'SCHEMA', real), n('FLOW-g', 'FLOW'),
      n('SCHEMA-konzept', 'SCHEMA'),
      n('TEST-vertrag', 'TEST', ref),
    ],
    edges: [
      e('FUNC-top', 'compose', 'FUNC-innen'),
      e('MOD-a', 'satisfy', 'REQ-mod'), e('FUNC-top', 'satisfy', 'REQ-top'), e('FUNC-innen', 'satisfy', 'REQ-innen'),
      e('TEST-mod', 'verify', 'REQ-mod'), e('TEST-top', 'verify', 'REQ-top'), e('TEST-innen', 'verify', 'REQ-innen'),
      e('FLOW-f', 'relation', 'SCHEMA-ok'), e('FLOW-g', 'relation', 'SCHEMA-offen'), e('FLOW-g', 'relation', 'SCHEMA-konzept'),
      e('TEST-vertrag', 'verify', 'SCHEMA-ok'),
    ],
  } as unknown as Graph;

  it('zaehlt Tests an MOD und Wurzel-FUNC, nicht an einer inneren FUNC; ungebundene stehen offen', () => {
    const z = blackboxBindung(graph);
    expect(z.blackbox).toEqual({ total: 2, gebunden: 1, offen: ['TEST-top'] });
  });

  it('jeder realisierte Vertrag an einem FLOW braucht einen gebundenen TEST; ein Konzept-Vertrag zaehlt nicht', () => {
    expect(blackboxBindung(graph).schnittstelle).toEqual({ total: 2, gebunden: 1, offen: ['SCHEMA-offen'] });
  });
});

describe('testauswahl.jsonl (CR-GC-718)', () => {
  it('liest geprueft und weist eine kaputte Zeile laut ab', async () => {
    const { leseSchlupfZeilen } = await import('../src/projections/test-schlupf.js');
    const gut = JSON.stringify(zeile('CR-GC-1', '2026-01-01', 'CODE'));
    expect(leseSchlupfZeilen(`${gut}\n`)).toHaveLength(1);
    expect(() => leseSchlupfZeilen(`${gut}\n{"cr":"x"}\n`)).toThrow();
  });
});

/**
 * CR-GC-854 — das Urteil über einen vitest-Lauf. Befund 2026-10-25: der Mac schlief während
 * `verify:full CR-GC-796`; vitest zeigte `import-code-verb.test.ts` rot, endete nach 46 von 194
 * Dateien mit exit 0, ohne Zusammenfassung und ohne JSON-Bericht — die Spur schrieb „rot 0".
 * Die Fälle mit Bericht fahren ein echtes vitest auf einer Wegwerf-Suite.
 */
describe('Lauf-Urteil: grün nur mit Bericht ohne rote Datei (CR-GC-854)', () => {
  const repoRoot = process.cwd();
  function fahre(dateien: Record<string, string>): VitestLauf & { root: string } {
    const root = mkdtempSync(join(tmpdir(), 'lauf-urteil-'));
    writeFileSync(join(root, 'vitest.config.mjs'), "export default { test: { include: ['*.test.mjs'] } };\n");
    for (const [name, text] of Object.entries(dateien)) writeFileSync(join(root, name), text);
    const bericht = join(root, 'bericht.json');
    const res = spawnSync(
      process.execPath,
      [join(repoRoot, 'node_modules/vitest/vitest.mjs'), 'run', '--root', root, '--reporter=json', `--outputFile.json=${bericht}`],
      { cwd: repoRoot, encoding: 'utf8', env: { ...process.env, VITEST: undefined, VITEST_POOL_ID: undefined, VITEST_WORKER_ID: undefined, NODE_ENV: undefined } },
    );
    const lauf = { status: res.status, signal: res.signal, bericht: existsSync(bericht) ? readFileSync(bericht, 'utf8') : undefined, root };
    return lauf;
  }
  const rel = (root: string) => (abs: string) => relative(root, abs);
  const OK = "import { it } from 'vitest';\nit('ok', () => {});\n";

  it('ein Test im Timeout ist rot und nennt seine Datei (Positivkontrolle)', () => {
    const lauf = fahre({
      'ok.test.mjs': OK,
      'timeout.test.mjs': "import { it } from 'vitest';\nit('schlaeft', () => new Promise((r) => setTimeout(r, 2000)), 50);\n",
    });
    try {
      expect(lauf.status).toBe(1);
      expect(laufUrteil(lauf, rel(lauf.root))).toEqual({ beleg: true, rot: ['timeout.test.mjs'], gesamt: 2 });
    } finally {
      rmSync(lauf.root, { recursive: true, force: true });
    }
  }, 60_000);

  it('ein Hook im Timeout ist rot, obwohl kein Test fehlschlug', () => {
    const lauf = fahre({
      'hook.test.mjs': "import { it, beforeAll } from 'vitest';\nbeforeAll(() => new Promise((r) => setTimeout(r, 2000)), 50);\nit('nie', () => {});\n",
    });
    try {
      expect(laufUrteil(lauf, rel(lauf.root))).toEqual({ beleg: true, rot: ['hook.test.mjs'], gesamt: 1 });
    } finally {
      rmSync(lauf.root, { recursive: true, force: true });
    }
  }, 60_000);

  it('ein Fehler ausserhalb eines Tests (Unhandled Error) ist rot, auch wenn der Bericht keine rote Datei nennt', () => {
    const lauf = fahre({
      'leck.test.mjs': "import { it } from 'vitest';\nit('leckt', () => { setTimeout(() => { throw new Error('leck'); }, 1); });\nit('wartet', () => new Promise((r) => setTimeout(r, 100)));\n",
    });
    try {
      expect(lauf.status).toBe(1);
      expect(JSON.parse(lauf.bericht!).testResults.every((t: { status: string }) => t.status === 'passed')).toBe(true);
      const urteil = laufUrteil(lauf, rel(lauf.root));
      expect(urteil.beleg).toBe(false);
    } finally {
      rmSync(lauf.root, { recursive: true, force: true });
    }
  }, 60_000);

  it('ein Lauf ohne Bericht ist kein Beleg — auch mit exit 0 (der Lauf CR-GC-796 vom 2026-10-25)', () => {
    const urteil = laufUrteil({ status: 0, signal: null, bericht: undefined }, (a) => a);
    expect(urteil).toEqual({ beleg: false, grund: expect.stringContaining('ohne Bericht') });
    expect(laufUrteil({ status: null, signal: 'SIGTERM', bericht: undefined }, (a) => a).beleg).toBe(false);
  });

  it('ein gruener Lauf mit Bericht ist ein Beleg ohne rote Datei', () => {
    const lauf = fahre({ 'ok.test.mjs': OK });
    try {
      expect(laufUrteil(lauf, rel(lauf.root))).toEqual({ beleg: true, rot: [], gesamt: 1 });
    } finally {
      rmSync(lauf.root, { recursive: true, force: true });
    }
  }, 60_000);
});
