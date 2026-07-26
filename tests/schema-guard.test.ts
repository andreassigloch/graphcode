/**
 * TEST CR-GC-249 — ontology schema-drift guard (auto-reseed).
 *
 * The persistent Kuzu store freezes its rel-table FROM/TO pairs at creation. When
 * the meta-model gains a pair, the frozen schema rejects the new edge. The guard
 * keys on a fingerprint of the generated DDL: on mismatch it deletes the store (so
 * init regenerates the schema) and reseeds from the committed SSOT.
 *
 * Real disk Kuzu (temp dir per test, never :memory:).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, copyFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { OntologyDescriptor } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import {
  schemaFingerprint,
  readStoredFingerprint,
  writeStoredFingerprint,
  SCHEMA_FINGERPRINT_BASENAME,
} from '../src/schema-guard.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

const SSOT = join(__dirname, '..', 'docs', 'graph', 'graphcode.graph.json');

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

describe('schemaFingerprint / marker (CR-GC-249 unit)', () => {
  it('is deterministic for the same descriptor', () => {
    expect(schemaFingerprint(SE_DESCRIPTOR)).toBe(schemaFingerprint(SE_DESCRIPTOR));
  });

  it('changes when a trace pair is added (the schema-freeze trigger)', () => {
    const base = schemaFingerprint(SE_DESCRIPTOR);
    const withPair: OntologyDescriptor = {
      ...SE_DESCRIPTOR,
      edgeTypes: {
        ...SE_DESCRIPTOR.edgeTypes,
        // add a brand-new FROM/TO pair to an existing edge type → new DDL
        satisfy: {
          ...SE_DESCRIPTOR.edgeTypes.satisfy,
          validPairs: [...SE_DESCRIPTOR.edgeTypes.satisfy.validPairs, ['ACTOR', 'REQ']],
        },
      },
    };
    expect(schemaFingerprint(withPair)).not.toBe(base);
  });

  it('changes when a node type is added', () => {
    const base = schemaFingerprint(SE_DESCRIPTOR);
    const withType: OntologyDescriptor = {
      ...SE_DESCRIPTOR,
      nodeTypes: { ...SE_DESCRIPTOR.nodeTypes, XYZ: { label: 'XYZ', requiredAttrs: [] } },
    };
    expect(schemaFingerprint(withType)).not.toBe(base);
  });

  it('marker round-trips; absent marker reads null', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gc-fp-'));
    try {
      expect(readStoredFingerprint(dir)).toBeNull();
      writeStoredFingerprint(dir, 'abc123');
      expect(readStoredFingerprint(dir)).toBe('abc123');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('harness schema-drift guard (CR-GC-249 integration)', () => {
  let tmp: string;
  let kuzuPath: string;
  let markerDir: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'gc-guard-'));
    kuzuPath = join(tmp, '.graphcode', 'kuzu');
    markerDir = dirname(kuzuPath);
    mkdirSync(join(tmp, 'docs', 'graph'), { recursive: true });
    mkdirSync(markerDir, { recursive: true });
    copyFileSync(SSOT, join(tmp, 'docs', 'graph', 'graphcode.graph.json'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function newHarness(): GraphCodeHarness {
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: kuzuPath });
    return new GraphCodeHarness(makeConfig(tmp), storage, undefined, {
      lockDir: markerDir,
      storePath: kuzuPath,
    });
  }

  it('first run stamps the fingerprint and does not reseed (empty store)', async () => {
    const h = newHarness();
    await h.initialize();
    try {
      expect(h.getGraph().nodes.length).toBe(0); // no auto-seed on a fresh store
      expect(readStoredFingerprint(markerDir)).toBe(schemaFingerprint(SE_DESCRIPTOR));
    } finally {
      await h.close();
    }
  });

  it('a stale fingerprint triggers store wipe + reseed from the SSOT', async () => {
    const h1 = newHarness();
    await h1.initialize();
    await h1.close();
    // Simulate a meta-model bump since this store's schema was frozen.
    writeFileSync(join(markerDir, SCHEMA_FINGERPRINT_BASENAME), 'stale-fingerprint\n');

    const h2 = newHarness();
    await h2.initialize();
    try {
      // Reseeded from the committed SSOT → the store is now the full graph.
      expect(h2.getGraph().nodes.length).toBeGreaterThan(0);
      // Marker rewritten to the current schema fingerprint.
      expect(readStoredFingerprint(markerDir)).toBe(schemaFingerprint(SE_DESCRIPTOR));
    } finally {
      await h2.close();
    }
  });

  it('a matching fingerprint does NOT reseed (store left untouched)', async () => {
    const h1 = newHarness();
    await h1.initialize();
    await h1.close();
    // marker already == current from h1's first run.

    const h2 = newHarness();
    await h2.initialize();
    try {
      // No drift → no reseed → the empty store from h1 stays empty.
      expect(h2.getGraph().nodes.length).toBe(0);
      expect(existsSync(join(markerDir, SCHEMA_FINGERPRINT_BASENAME))).toBe(true);
    } finally {
      await h2.close();
    }
  });
});
