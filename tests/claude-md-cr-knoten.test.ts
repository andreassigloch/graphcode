/**
 * CR-GC-929 — CLAUDE.md sagt, der CR-Knoten trage den Status, den `aise cr close` spiegelt.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const md = readFileSync(join(__dirname, '..', 'CLAUDE.md'), 'utf8');

describe('TEST-claude-md-cr-knoten (CR-GC-929)', () => {
  it('nennt den Spiegel von aise cr close an den Knoten', () => {
    expect(md).toContain('status derives from `open/`/`done/`; `aise cr close` mirrors it onto the node.');
  });

  it('sagt nirgends, der Knoten trage keinen Status', () => {
    expect(md).not.toMatch(/node stores none/);
  });
});
