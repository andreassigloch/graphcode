/**
 * TEST-first-step (CR-GC-306) — the elected host names ONE next action on boot.
 *
 * Onboarding failed at the same point every time: the server comes up, prints an
 * election line, and the reader is left with a tool reference. A substrate whose
 * entry point is a tool list gets read and put down. So the host states the single
 * sentence to say next — and which sentence depends on whether there is a model yet.
 *
 * The hard constraint: stdout is the MCP JSON-RPC transport. Every byte of this
 * goes to stderr; one stray write on fd 1 corrupts the protocol stream. That is the
 * actual reason this was never "just added", and it is what `writesNothingToStdout`
 * pins.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import type { Graph } from '@sigloch/graph-api-core';
import { firstStepHint } from '../src/mcp-server.js';

function g(types: string[]): Graph {
  return {
    nodes: types.map((t, i) => ({
      uid: `${t}-${i}`,
      type: t,
      name: `${t} ${i}`,
      description: '',
      attributes: {},
    })),
    edges: [],
  };
}

describe('firstStepHint (CR-GC-306)', () => {
  it('a store with no model yet gets the cold-start sentence', () => {
    const hint = firstStepHint({ nodes: [], edges: [] });
    expect(hint).toContain('se:generate');
    expect(hint).not.toContain('graph_readiness');
  });

  it('a store that only carries the auto-SYS anchor still counts as no model', () => {
    // CR-GC-302 puts a SYS into EVERY imported store, so "no elements" is no longer
    // the emptiness test — a code-only import would otherwise be told to ask for a
    // status report on a graph that has no requirements to report on.
    expect(firstStepHint(g(['SYS']))).toContain('se:generate');
  });

  it('a code-only import (FUNC/MOD, no UC/REQ) still gets the cold-start sentence', () => {
    // `graphcode import-code` produces exactly this shape. There is structure but no
    // intent layer, so the next step is authoring it, not reading readiness.
    expect(firstStepHint(g(['SYS', 'MOD', 'FUNC', 'FUNC', 'FLOW']))).toContain('se:generate');
  });

  it('a store with requirements gets the status sentence instead', () => {
    const hint = firstStepHint(g(['SYS', 'UC', 'REQ', 'TEST']));
    expect(hint).toContain('graph_readiness');
    expect(hint).not.toContain('se:generate');
  });

  it('a single UC is enough to count as a model', () => {
    expect(firstStepHint(g(['UC']))).toContain('graph_readiness');
  });

  it('always points at GRAPHCODE.md first — the agent contract before any tool call', () => {
    for (const graph of [{ nodes: [], edges: [] }, g(['UC', 'REQ'])]) {
      expect(firstStepHint(graph)).toContain('GRAPHCODE.md');
    }
  });

  it('offers exactly ONE next step, not a menu', () => {
    // The failure mode being avoided is a wall of options. One line, one action.
    for (const graph of [{ nodes: [], edges: [] }, g(['UC', 'REQ'])]) {
      const body = firstStepHint(graph).split('\n').filter((l) => l.trim().length > 0);
      expect(body.length).toBeLessThanOrEqual(3);
    }
  });

  it('is a stderr-shaped string and never writes to stdout itself', () => {
    // A pure function returning text cannot touch fd 1 — that is the point. The
    // caller writes it to stderr; this pins that the hint carries no side effect.
    const before = process.stdout.write;
    let stdoutWrites = 0;
    process.stdout.write = ((...args: unknown[]) => {
      stdoutWrites++;
      return (before as unknown as (...a: unknown[]) => boolean).apply(process.stdout, args);
    }) as typeof process.stdout.write;
    try {
      firstStepHint(g(['UC']));
    } finally {
      process.stdout.write = before;
    }
    expect(stdoutWrites).toBe(0);
  });
});
