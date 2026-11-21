/**
 * TEST-verify-code-plan (CR-GC-972) — `verify:code --plan` nennt Spur und Kommando und fährt nichts.
 *
 * Der Runner `scripts/verify-code.mjs` verdrahtet Plan, vitest, Urteil und Rückmeldung. Keiner der
 * anderen Tests startet ihn. Hier läuft er als Prozess gegen den committeten Snapshot des Repos, nur im
 * Planmodus: er ändert nichts am Modell und startet kein vitest. Setzt einen Build voraus (`dist/`).
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');

function plan(...dateien: string[]) {
  const t0 = Date.now();
  const res = spawnSync(process.execPath, ['scripts/verify-code.mjs', '--plan', ...dateien], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 20_000,
  });
  return { ...res, ms: Date.now() - t0 };
}

describe('verify:code --plan', () => {
  it('gebundene Quelldatei: Spur CODE, Kommando mit genau den Testdateien der Auswahl, Exit 0, kein vitest', () => {
    const r = plan('src/surface/rewind.ts');
    expect(r.signal).toBeNull();
    expect(r.status).toBe(0);
    expect(r.stderr).toContain('Spur: CODE');
    const kommando = r.stderr.split('\n').find((l) => l.startsWith('[verify:code] -> npx vitest run'));
    expect(kommando).toBeDefined();
    const dateien = (kommando as string).split(' ').filter((w) => w.endsWith('.test.ts'));
    expect(dateien).toContain('tests/rewind.test.ts');
    // Ein echter Lauf schreibt Ergebnisse zurück; der Planmodus nennt keine Rückmeldung und kein Urteil.
    expect(r.stderr).not.toContain('Rueckmeldung');
    expect(r.stderr).not.toContain('ROT');
    expect(r.stdout).not.toContain('Test Files');
  });

  it('Quelldatei ohne Knoten: Spur VOLL, Kommando ohne Dateiargument, Exit 0, kein vitest', () => {
    const r = plan('src/gibt-es-nicht.ts');
    expect(r.signal).toBeNull();
    expect(r.status).toBe(0);
    expect(r.stderr).toContain('Spur: VOLL');
    expect(r.stderr).toContain('ohne Bindung: src/gibt-es-nicht.ts');
    const kommando = r.stderr.split('\n').find((l) => l.startsWith('[verify:code] -> npx vitest run'));
    expect(kommando).toBe('[verify:code] -> npx vitest run');
    expect(r.stdout).not.toContain('Test Files');
  });
});
