/**
 * CR-GC-741 — T-E2 als S1-Messung: Jobs aus der CR-Historie, Whitebox gegen die tatsächlich geänderten Knoten.
 * Reine Teile an gestellten Graphen; die Mechanik einmal echt an der Kalibrier-Fixture (13 Knoten, Wegwerf-Store).
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error — Messskript in .mjs, bewusst ohne Typdeklaration
import { aenderungen, jobAusCommit, jobErgebnis, urteil, jobsAusHistorie, messeJob, KALIBRIERUNG, W_ZU_G_MAX } from '../scripts/whitebox-messung.mjs';

const el = (id: string, type: string, extra: object = {}) => ({ id, type, name: id, description: '', ...extra });
const vorher = {
  elements: [el('CR-x', 'CR', { status: 'open' }), el('FUNC-a', 'FUNC'), el('FUNC-b', 'FUNC'), el('REQ-r', 'REQ'), el('MOD-m', 'MOD')],
  traces: [
    { source: 'CR-x', target: 'FUNC-a', type: 'relation' }, { source: 'CR-x', target: 'REQ-r', type: 'relation' },
    { source: 'CR-x', target: 'FUNC-weg', type: 'relation' }, { source: 'FUNC-a', target: 'MOD-m', type: 'allocate' },
  ],
};
// Der Commit: FUNC-a bekommt eine Bindung, FUNC-b fällt, TEST-neu kommt und hängt sich an REQ-r; der CR nennt erst jetzt
// seinen Umfang (FUNC-a, REQ-r, MOD-m — MOD-m nur per CR-Kante, das zählt nicht als Berührung).
const nachher = {
  elements: [el('CR-x', 'CR', { status: 'done' }), el('FUNC-a', 'FUNC', { realRef: { file: 'src/a.ts' } }), el('REQ-r', 'REQ'), el('MOD-m', 'MOD'), el('TEST-neu', 'TEST')],
  traces: [
    { source: 'CR-x', target: 'FUNC-a', type: 'relation' }, { source: 'CR-x', target: 'REQ-r', type: 'relation' },
    { source: 'CR-x', target: 'MOD-m', type: 'relation' }, { source: 'CR-x', target: 'FUNC-weg', type: 'relation' },
    { source: 'FUNC-a', target: 'MOD-m', type: 'allocate' }, { source: 'TEST-neu', target: 'REQ-r', type: 'verify' },
  ],
};

describe('whitebox-messung: Job aus einem CR-Commit', () => {
  it('aenderungen trennt hinzu, geändert, entfernt und berührt (neue Kante an vorhandenem Knoten; CR-Kanten zählen nicht)', () => {
    expect(aenderungen(vorher, nachher, { ohne: ['CR-x'] })).toEqual({ hinzu: ['TEST-neu'], geaendert: ['CR-x', 'FUNC-a'], entfernt: ['FUNC-b'], beruehrt: ['REQ-r'] });
    expect(aenderungen(vorher, nachher).beruehrt).toEqual(['REQ-r', 'MOD-m']);
  });

  it('Seeds sind der erklärte Umfang des CR nach dem Commit, soweit vorher da; Ground Truth die geänderten, entfernten und berührten Knoten ohne den CR', () => {
    const j = jobAusCommit('CR-x', vorher, nachher, 'abcdef0123456789');
    expect(j.seeds).toEqual(['FUNC-a', 'REQ-r', 'MOD-m']);
    expect(j.groundTruth).toEqual(['FUNC-a', 'FUNC-b', 'REQ-r']);
    expect(j.hinzu).toBe(1);
    expect(j.fixture.graph).toBe(vorher);
    expect(j.titel).toBe('CR-x @ abcdef0');
  });

  it('jobErgebnis: bestanden nur bei voller Deckung und |W|/|G| unter der Schwelle; fehlende uids sind kein Grün', () => {
    const job = { name: 'J', seeds: ['FUNC-a'], groundTruth: ['FUNC-a', 'FUNC-b'] };
    const vorhanden = new Set(['FUNC-a', 'FUNC-b']);
    const voll = jobErgebnis(job, { G: 100, whitebox: new Set(['FUNC-a', 'FUNC-b', 'REQ-r']), blast: new Set(['FUNC-a']), vorhanden });
    expect(voll.bestanden).toBe(true);
    expect(voll.wZuG).toBe(0.03);
    expect(jobErgebnis(job, { G: 100, whitebox: new Set(['FUNC-a']), blast: new Set(), vorhanden }).groundTruth.fehltInW).toEqual(['FUNC-b']);
    expect(jobErgebnis(job, { G: 20, whitebox: new Set(['FUNC-a', 'FUNC-b']), blast: new Set(), vorhanden }).bestanden).toBe(false);
    const f = jobErgebnis({ ...job, groundTruth: ['FUNC-a', 'FUNC-x'] }, { G: 100, whitebox: new Set(['FUNC-a', 'FUNC-x']), blast: new Set(), vorhanden });
    expect(f.fehlt).toEqual(['FUNC-x']);
    expect(f.bestanden).toBe(false);
    expect(W_ZU_G_MAX).toBe(0.05);
  });

  it('urteil: die Kalibrierung wird genannt, nicht beurteilt; ohne Historien-Job nicht erhoben; ein fehlender Knoten macht alles nicht erhoben', () => {
    const kal = { job: 'J1', kalibrierung: true, groundTruth: { inW: 1, total: 1, fehltInW: [] }, wZuG: 0.846, fehlt: [], bestanden: false };
    const ok = { job: 'CR-1', kalibrierung: false, groundTruth: { inW: 2, total: 2, fehltInW: [] }, wZuG: 0.02, fehlt: [], bestanden: true };
    const nein = { ...ok, job: 'CR-2', groundTruth: { inW: 1, total: 2, fehltInW: ['x'] }, bestanden: false };
    expect(urteil([kal]).urteil).toBe('nicht erhoben');
    expect(urteil([kal, ok])).toEqual({ wert: '1/1 Jobs: CR-1: 2/2 in W, |W|/|G| 0.02; Kalibrierung J1: 1/1 in W, |W|/|G| 0.846', urteil: 'bestanden' });
    expect(urteil([ok, nein]).urteil).toBe('nicht bestanden');
    expect(urteil([ok, { ...nein, fehlt: ['FUNC-x'] }]).urteil).toBe('nicht erhoben');
  });
});

describe('whitebox-messung: an echten Eingängen', () => {
  it('die Historie liefert Jobs mit Seeds und Ground Truth aus Commits, auf die ein CR zeigt', () => {
    const jobs = jobsAusHistorie(process.cwd(), { n: 3 });
    expect(jobs.length).toBeGreaterThan(0);
    for (const j of jobs) {
      expect(j.name).toMatch(/^CR-GC-\d+$/);
      expect(j.seeds.length).toBeGreaterThan(0);
      expect(j.groundTruth.length).toBeGreaterThan(0);
      expect(j.fixture.graph.elements.length).toBeGreaterThan(100);
    }
  });

  it('die Kalibrier-Fixture: der Seed liegt in seiner eigenen Whitebox, die Mechanik läuft im Wegwerf-Store', async () => {
    expect(existsSync(join(process.cwd(), KALIBRIERUNG.fixture.graph))).toBe(true);
    const e = await messeJob(KALIBRIERUNG, process.cwd());
    expect(e.kalibrierung).toBe(true);
    expect(e.G).toBe(13);
    expect(e.groundTruth.inW).toBe(1);
    expect(e.fehlt).toEqual([]);
  }, 60_000);
});
