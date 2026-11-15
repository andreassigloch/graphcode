/**
 * TEST-skill-nennt-parameter (CR-GC-949): jeder Skill, dessen Text `graph_mutate` nennt, sagt dem
 * Agenten, `skill: "<eigener Name>"` zu setzen — sonst zaehlt `audit_stats` den Zug unter `null`.
 * Der eigene Name ist der `name:` aus dem Kopf der Datei und muss zu `skillNames()` passen.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { skillNames } from '../src/surface/scaffold-templates.js';

const REPO = join(__dirname, '..');
const COMMANDS = join(REPO, '.claude', 'commands');

describe('Skills nennen den Parameter skill an graph_mutate (CR-GC-949)', () => {
  it('jede Datei, die graph_mutate nennt, nennt skill: "<eigener Name>"', () => {
    const known = new Set(skillNames(REPO).values());
    const fehlt: string[] = [];
    let geprueft = 0;
    for (const rel of readdirSync(COMMANDS, { recursive: true, encoding: 'utf8' })) {
      if (!rel.endsWith('.md')) continue;
      const text = readFileSync(join(COMMANDS, rel), 'utf8');
      if (!text.includes('graph_mutate')) continue;
      geprueft++;
      const name = text.match(/^name: (\S+)$/m)?.[1];
      if (!name || !known.has(name)) {
        fehlt.push(`${rel}: name "${name}" passt zu keinem Dateinamen`);
        continue;
      }
      if (!text.includes(`skill: "${name}"`)) fehlt.push(`${rel}: skill: "${name}" fehlt`);
    }
    expect(geprueft).toBeGreaterThan(0);
    expect(fehlt).toEqual([]);
  });

  // CR-GC-950: zeigt ein Skill den Aufruf als Code, zaehlt nur der Parameter im Aufruf — ein Kommentar
  // daneben setzt ihn nicht.
  it('jeder als Code gezeigte Aufruf von graph_mutate uebergibt skill', () => {
    const fehlt: string[] = [];
    for (const rel of readdirSync(COMMANDS, { recursive: true, encoding: 'utf8' })) {
      if (!rel.endsWith('.md')) continue;
      const zeilen = readFileSync(join(COMMANDS, rel), 'utf8').split('\n');
      zeilen.forEach((zeile, i) => {
        if (/\['graph_mutate'\]\.handler\(/.test(zeile) && !/\bskill:/.test(zeile)) fehlt.push(`${rel}:${i + 1}`);
      });
    }
    expect(fehlt).toEqual([]);
  });
});
