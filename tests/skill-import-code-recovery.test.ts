/**
 * CR-GC-941 — die Wiederherstellung im Skill se:import-code geht durchs Werkzeug graph_reseed,
 * nicht durch Schreiben der Graph-Datei und Löschen des Stores von Hand.
 *
 * Das Backup legt `executeImportCode` unter `.graphcode/backup/graph-<ts>.json` an; `graph_reseed`
 * nimmt einen Pfad relativ zum Repo (src/surface/write.ts). Beides steht im Code, nicht nur im Skill.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(__dirname, '..');
const read = (rel: string): string => readFileSync(join(REPO, rel), 'utf8');
const skill = read('.claude/commands/se/import-code.md');
const recovery = skill.slice(skill.indexOf('## Recovery'));

describe('TEST-skill-import-code-recovery (CR-GC-941)', () => {
  it('der Code legt das Backup unter .graphcode/backup an und graph_reseed nimmt einen Pfad', () => {
    expect(read('src/surface/import-code-verb.ts')).toMatch(/join\('\.graphcode', 'backup'/);
    expect(read('src/surface/write.ts')).toMatch(/GraphReseedInputSchema = z\.object\(\{\s*path:/);
  });

  it('die Wiederherstellung kopiert nichts nach docs/graph und löscht den Store nicht', () => {
    expect(recovery).not.toMatch(/rm \.graphcode/);
    expect(recovery).not.toMatch(/nach `docs\/graph\/<member>\.graph\.json` kopieren/);
    expect(recovery).not.toMatch(/Host stoppen/);
  });

  it('die Wiederherstellung ruft graph_reseed mit dem Backup-Pfad und danach graph_export', () => {
    expect(recovery).toMatch(/graph_reseed\(\{ path: "\.graphcode\/backup\/graph-<ts>\.json" \}\)/);
    expect(recovery).toMatch(/graph_export/);
  });

  it('die Skill-Version steht auf 5', () => {
    expect(skill).toMatch(/^version: 5$/m);
  });
});
