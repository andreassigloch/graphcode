/**
 * TEST render-verb (CR-GC-909) — `graphcode render <view> --format md|docx|pdf`.
 *
 * Ein echtes Temp-Repo mit committetem Snapshot, echter Disk-Kuzu ueber `createHarness`, echtes
 * pandoc. Fehlt pandoc auf der Maschine, ist der Word-Fall SICHTBAR uebersprungen (Name und
 * Warnung sagen es), nie still gruen. Der Fall „pandoc fehlt" laeuft immer: er leert den PATH.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executeRender, RenderToolMissingError } from '../src/surface/render-verb.js';
import { SRS_OUTLINE } from '../src/projections/srs.js';

const HAS_PANDOC = !spawnSync('pandoc', ['--version']).error;
if (!HAS_PANDOC) console.warn('render-verb.test: pandoc fehlt auf dem PATH — der Word-Fall ist übersprungen, nicht bestanden.');

/** Die Paketstation, klein: ein UC mit Kette, je eine REQ functional und non-functional. */
const SNAPSHOT = {
  elements: [
    { id: 'SYS-paketstation', type: 'SYS', name: 'Paketstation', description: 'Empfänger holen Pakete ohne Personal ab.' },
    { id: 'ACTOR-empfaenger', type: 'ACTOR', name: 'Empfänger', description: 'holt ein Paket ab' },
    { id: 'UC-abholen', type: 'UC', name: 'Paket abholen', description: 'Der Empfänger holt sein Paket mit einem Code ab.' },
    { id: 'FCHAIN-abholung', type: 'FCHAIN', name: 'Abholung', description: 'Code eingeben, prüfen, Fach öffnen.' },
    { id: 'FUNC-code-pruefen', type: 'FUNC', name: 'Code prüfen', description: 'prüft den Abholcode' },
    { id: 'FLOW-abholcode', type: 'FLOW', name: 'Abholcode', description: '6 Ziffern' },
    { id: 'REQ-antwort', type: 'REQ', name: 'Antwort auf jeden Code', description: 'Wenn ein Code eingeht, dann antwortet die Prüfung mit gültig oder ungültig.', kinds: ['functional'] },
    { id: 'REQ-zwei-sekunden', type: 'REQ', name: 'Fach offen in 2 s', description: 'Das Fach öffnet höchstens 2 s nach gültigem Code.', kinds: ['non-functional'] },
    { id: 'TEST-oeffnung', type: 'TEST', name: 'Öffnung mit gültigem Code', description: 'misst die Zeit bis zum offenen Fach' },
  ],
  traces: [
    { source: 'SYS-paketstation', target: 'UC-abholen', type: 'compose' },
    { source: 'UC-abholen', target: 'FCHAIN-abholung', type: 'compose' },
    { source: 'UC-abholen', target: 'REQ-antwort', type: 'compose' },
    { source: 'UC-abholen', target: 'REQ-zwei-sekunden', type: 'compose' },
    { source: 'FCHAIN-abholung', target: 'FUNC-code-pruefen', type: 'compose' },
    { source: 'ACTOR-empfaenger', target: 'FLOW-abholcode', type: 'io' },
    { source: 'FLOW-abholcode', target: 'FUNC-code-pruefen', type: 'io' },
    { source: 'FUNC-code-pruefen', target: 'REQ-antwort', type: 'satisfy' },
    { source: 'FCHAIN-abholung', target: 'REQ-zwei-sekunden', type: 'satisfy' },
    { source: 'TEST-oeffnung', target: 'REQ-zwei-sekunden', type: 'verify' },
    { source: 'TEST-oeffnung', target: 'REQ-antwort', type: 'verify' },
  ],
};

/** Ueberschriftentext ohne Markdown-Zeichen und mit einfachen Leerzeichen. */
const norm = (s: string): string => s.replace(/[#`*]/g, '').replace(/\s+/g, ' ').trim();

describe('graphcode render (CR-GC-909)', () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'graphcode-render-'));
    writeFileSync(join(repo, 'package.json'), JSON.stringify({ name: 'paketstation' }));
    mkdirSync(join(repo, 'docs', 'graph'), { recursive: true });
    writeFileSync(join(repo, 'docs', 'graph', 'paketstation.graph.json'), JSON.stringify(SNAPSHOT, null, 1));
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it('md: schreibt die Sicht aus dem Graphen, mit der Gliederung nach 29148', async () => {
    const res = await executeRender({ repoRoot: repo, view: 'srs', format: 'md', out: 'out/srs.md' });
    const md = readFileSync(res.out, 'utf8');
    expect(res.out).toBe(join(repo, 'out', 'srs.md'));
    expect(res.bytes).toBe(Buffer.byteLength(md));
    for (const s of SRS_OUTLINE) expect(md).toContain(`${s.num}  ${s.title}`);
    expect(md).toContain('`REQ-antwort`');
    expect(md).toContain('`REQ-zwei-sekunden`');
  });

  it.skipIf(!HAS_PANDOC)('docx: pandoc liest die Datei zurück, und alle Überschriften der Quelle stehen darin', async () => {
    const md = readFileSync((await executeRender({ repoRoot: repo, view: 'srs', format: 'md', out: 'srs.md' })).out, 'utf8');
    const res = await executeRender({ repoRoot: repo, view: 'srs', format: 'docx' });
    expect(res.out).toBe(join(repo, 'srs.docx'));
    expect(res.bytes).toBeGreaterThan(0);
    const back = spawnSync('pandoc', ['--from', 'docx', '--to', 'gfm', res.out], { encoding: 'utf8' });
    expect(back.status).toBe(0);
    const text = norm(back.stdout);
    const headings = md.split('\n').filter((l) => /^#{1,6} /.test(l)).map(norm);
    expect(headings.length).toBeGreaterThan(SRS_OUTLINE.length);
    for (const h of headings) expect(text, h).toContain(h);
  });

  it('pandoc fehlt: nennt den Installationsbefehl und schreibt keine Datei', async () => {
    const path = process.env.PATH;
    process.env.PATH = '';
    try {
      await expect(executeRender({ repoRoot: repo, view: 'srs', format: 'docx' })).rejects.toThrow(RenderToolMissingError);
      await expect(executeRender({ repoRoot: repo, view: 'srs', format: 'docx' })).rejects.toThrow(/brew install pandoc/);
    } finally {
      process.env.PATH = path;
    }
    expect(existsSync(join(repo, 'srs.docx'))).toBe(false);
  });

  it('lehnt ein unbekanntes Format und eine unbekannte Sicht ab', async () => {
    await expect(executeRender({ repoRoot: repo, view: 'srs', format: 'odt' })).rejects.toThrow(/unbekanntes Format/);
    await expect(executeRender({ repoRoot: repo, view: 'gibtsnicht', format: 'md' })).rejects.toThrow();
  });
});
