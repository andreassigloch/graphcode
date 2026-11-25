/**
 * TEST-push-check (CR-GC-1031) — der pre-push-Hook lässt keinen verbotenen Pfad und keine personenbezogenen Daten
 * ins öffentliche Repo.
 *
 * Ein Wegwerf-Repo mit einem leeren Bare-Repo als Remote; `core.hooksPath` zeigt auf den ECHTEN Hook dieses Repos,
 * gepusht wird mit echtem `git push`. Je Fall ein Commit, dann der Push:
 *
 *   sauber     README-Änderung ohne Merkmal — geht durch
 *   Spike      docs/spikes/SPIKE-x.md — Abbruch, auch wenn ein späterer Commit nur etwas anderes ändert
 *   Messung    docs/messung/lauf.md — Abbruch; docs/messung/stand.md geht durch
 *   Gespräch   docs/archive/expertengespraech.md — Abbruch
 *   PII        Postadresse, E-Mail, Telefon, IBAN, Firma mit Rechtsform je in einer Zeile — Abbruch, Art genannt
 *   Nachricht  E-Mail-Adresse nur in der Commit-Nachricht — Abbruch
 *   Ausnahme   derselbe Treffer, ausdrücklich in `erlaubteTreffer` — geht durch
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, copyFileSync, readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const REPO = process.cwd();

let root: string;
let arbeit: string;

const git = (...args: string[]) => execFileSync('git', args, { cwd: arbeit, encoding: 'utf8' });

function schreibe(datei: string, inhalt: string): void {
  mkdirSync(dirname(join(arbeit, datei)), { recursive: true });
  writeFileSync(join(arbeit, datei), inhalt);
}

function commit(datei: string, inhalt: string, nachricht = 'docs: aenderung'): void {
  schreibe(datei, inhalt);
  git('add', datei);
  git('commit', '-q', '-m', nachricht);
}

function push(): { code: number; ausgabe: string } {
  const r = spawnSync('git', ['push', '-q', 'origin', 'HEAD:refs/heads/master'], { cwd: arbeit, encoding: 'utf8' });
  return { code: r.status ?? -1, ausgabe: `${r.stdout}${r.stderr}` };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'gc-push-pruefung-'));
  const remote = join(root, 'remote.git');
  arbeit = join(root, 'arbeit');
  execFileSync('git', ['init', '-q', '--bare', remote]);
  execFileSync('git', ['init', '-q', '-b', 'master', arbeit]);
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  git('remote', 'add', 'origin', remote);
  // Echter Hook, echtes Skript, echte Config — in die Wegwerf-Kopie, weil der Hook die Repo-Wurzel nimmt.
  for (const f of ['scripts/githooks/pre-push', 'scripts/push-pruefung.mjs', 'scripts/push-pruefung.config.json']) {
    mkdirSync(dirname(join(arbeit, f)), { recursive: true });
    copyFileSync(join(REPO, f), join(arbeit, f));
  }
  execFileSync('chmod', ['+x', join(arbeit, 'scripts/githooks/pre-push')]);
  git('config', 'core.hooksPath', 'scripts/githooks');
  git('add', 'scripts');
  git('commit', '-q', '-m', 'chore: hook');
  expect(push().code).toBe(0);
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('TEST-push-check: pre-push-Hook (CR-GC-1031)', () => {
  it('lässt einen sauberen Commit durch', () => {
    commit('README.md', '# Projekt\n\nEin Graph-Substrat mit 26 Regeln.\n');
    const r = push();
    expect(r.code, r.ausgabe).toBe(0);
  });

  it('bricht bei einem Spike ab — auch wenn er in einem älteren Commit des Pushs liegt', () => {
    commit('docs/spikes/SPIKE-x.md', '# Spike\n');
    commit('README.md', '# Projekt\n');
    const r = push();
    expect(r.code).toBe(1);
    expect(r.ausgabe).toContain('verbotener Pfad: docs/spikes/SPIKE-x.md');
  });

  it('bricht bei eigener Messung ab, lässt den Release-Stand durch', () => {
    commit('docs/messung/stand.md', '# Stand\n');
    expect(push().code).toBe(0);
    commit('docs/messung/lauf.md', '# Lauf\n');
    const r = push();
    expect(r.code).toBe(1);
    expect(r.ausgabe).toContain('docs/messung/lauf.md');
  });

  it('bricht bei einem Gesprächsprotokoll ab', () => {
    commit('docs/archive/2026-11-10-expertengespraech.md', '# Gespräch\n');
    const r = push();
    expect(r.code).toBe(1);
    expect(r.ausgabe).toContain('expertengespraech');
  });

  it.each([
    ['Postadresse', 'Treffpunkt Hauptstraße 12 im Hof'],
    ['E-Mail-Adresse', 'Rückfragen an kunde.x@firma-y.de'],
    ['Telefonnummer', 'Tel.: 0711 1234567'],
    ['IBAN', 'Konto DE89 3704 0044 0532 0130 00'],
    ['Firma mit Rechtsform', 'Auftrag der Muster Bau GmbH'],
  ])('bricht bei %s in einer hinzugefügten Zeile ab', (art, zeile) => {
    commit('docs/notiz.md', `# Notiz\n\n${zeile}\n`);
    const r = push();
    expect(r.code).toBe(1);
    expect(r.ausgabe).toContain(`${art}: docs/notiz.md`);
  });

  it('bricht bei einer E-Mail-Adresse in der Commit-Nachricht ab', () => {
    commit('README.md', '# Projekt\n', 'docs: von kunde.x@firma-y.de gewuenscht');
    const r = push();
    expect(r.code).toBe(1);
    expect(r.ausgabe).toContain('Commit-Nachricht');
  });

  it('lässt einen Treffer durch, der ausdrücklich in erlaubteTreffer steht', () => {
    const cfgPfad = join(arbeit, 'scripts/push-pruefung.config.json');
    const cfg = JSON.parse(readFileSync(cfgPfad, 'utf8'));
    cfg.erlaubteTreffer.push('kunde.x@firma-y.de');
    writeFileSync(cfgPfad, JSON.stringify(cfg, null, 2));
    git('add', 'scripts/push-pruefung.config.json');
    git('commit', '-q', '-m', 'chore: ausnahme');
    commit('docs/notiz.md', 'Rückfragen an kunde.x@firma-y.de\n');
    const r = push();
    expect(r.code, r.ausgabe).toBe(0);
  });
});
