/**
 * CR-GC-785 — der Skill `se:optimize` Version 3 probt einen Vorschlag per Trockenlauf und zeigt den
 * Gesamt-Impact als Vorlage fuer das Urteil des Autors. Er ordnet nichts, mischt die zwei Quellen
 * nicht und wendet nicht an.
 *
 * Der Test bindet den Skill-Text an das, was die Werkzeuge wirklich antworten: ein Messaufbau auf
 * Platte (`openMeasured`), darin `graph_metrics` mit `scope`, ein Trockenlauf von `graph_mutate` und
 * `graph_suggest`. Nennt der Text ein Feld, das die Antwort nicht traegt, ist er rot.
 *
 * CR-GC-790: die Spalte „danach" liest der Skill aus `metricsAfter` im Urteil des Trockenlaufs.
 * Dieselbe Probe haelt fest, was offen bleibt: das Urteil traegt keinen Betrachtungsumfang, und
 * `graph_metrics` misst nach der Probe den unveraenderten Stand.
 *
 * Muster: `tests/skill-vorbereitung-felder.test.ts`, `tests/skill-fmea-orte.test.ts`.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ALL_RULE_DEFS, requirementScope } from '@sigloch/contracts/se';
import { openMeasured, type Measured } from '../src/surface/measured.js';
import { FitAdvisory, SteerAdvisory } from '../src/kernel/measure/fit-advisory.js';
import { SteeringDelta, SteeringStageDelta } from '../src/kernel/measure/steering-snapshot.js';
import { WorkOrder } from '../src/kernel/measure/work-order.js';
import { MetricsAfter } from '../src/kernel/measure/zug-bericht.js';

const COMMANDS = join(__dirname, '..', '.claude', 'commands');
const skill = readFileSync(join(COMMANDS, 'se', 'optimize.md'), 'utf8');
const fmea = readFileSync(join(COMMANDS, 'se-fmea.md'), 'utf8');

type Zeile = Record<string, unknown>;
type Antwort = Record<string, unknown>;

const el = (id: string, type: string, attributes?: Record<string, unknown>) => ({
  id, type, name: id, description: `${id} Beschreibung`, ...(attributes ? { attributes } : {}),
});

/**
 * Zwei Ketten durch eine geteilte Funktion (b), zwei Module, ein Zweck an der Kette x, eine
 * Anforderung an der Funktion a und ein Risiko, dessen Gegenmassnahme b erfuellt.
 */
const MODELL = {
  elements: [
    el('SYS-x', 'SYS'), el('UC-x', 'UC'), el('ACTOR-a', 'ACTOR'),
    el('FCHAIN-x', 'FCHAIN'), el('FCHAIN-y', 'FCHAIN'),
    el('FUNC-a', 'FUNC'), el('FUNC-b', 'FUNC'), el('FUNC-c', 'FUNC'),
    el('FLOW-in', 'FLOW'), el('FLOW-ab', 'FLOW'), el('FLOW-out', 'FLOW'), el('FLOW-bc', 'FLOW'), el('FLOW-cout', 'FLOW'),
    el('SCHEMA-s', 'SCHEMA'), el('MOD-m', 'MOD'), el('MOD-n', 'MOD'),
    el('REQ-zweck', 'REQ', { kinds: ['non-functional'] }),
    el('REQ-a', 'REQ', { kinds: ['functional'] }),
    el('REQ-risk', 'REQ', { role: 'risk', kinds: ['non-functional'] }),
    el('REQ-mit', 'REQ', { role: 'mitigation', kinds: ['functional'] }),
  ],
  traces: [
    ['SYS-x', 'compose', 'UC-x'], ['SYS-x', 'compose', 'MOD-m'], ['SYS-x', 'compose', 'MOD-n'],
    ['UC-x', 'compose', 'FCHAIN-x'], ['UC-x', 'compose', 'FCHAIN-y'],
    ['FCHAIN-x', 'compose', 'FUNC-a'], ['FCHAIN-x', 'compose', 'FUNC-b'],
    ['FCHAIN-y', 'compose', 'FUNC-b'], ['FCHAIN-y', 'compose', 'FUNC-c'],
    ['ACTOR-a', 'io', 'FLOW-in'], ['FLOW-in', 'io', 'FUNC-a'], ['FUNC-a', 'io', 'FLOW-ab'], ['FLOW-ab', 'io', 'FUNC-b'],
    ['FUNC-b', 'io', 'FLOW-out'], ['FLOW-out', 'io', 'ACTOR-a'], ['FUNC-b', 'io', 'FLOW-bc'], ['FLOW-bc', 'io', 'FUNC-c'],
    ['FUNC-c', 'io', 'FLOW-cout'], ['FLOW-cout', 'io', 'ACTOR-a'],
    ...['in', 'ab', 'out', 'bc', 'cout'].map((f) => [`FLOW-${f}`, 'relation', 'SCHEMA-s']),
    ['FUNC-a', 'allocate', 'MOD-m'], ['FUNC-b', 'allocate', 'MOD-m'], ['FUNC-c', 'allocate', 'MOD-n'],
    ['FCHAIN-x', 'satisfy', 'REQ-zweck'], ['FUNC-a', 'satisfy', 'REQ-a'],
    ['REQ-risk', 'compose', 'REQ-mit'], ['FUNC-b', 'satisfy', 'REQ-mit'], ['FCHAIN-x', 'satisfy', 'REQ-risk'],
  ].map(([source, type, target]) => ({ source, type, target })),
};

/** Der Zug eines Vorschlags aus einer Analyse: b meldet an a zurueck (ein Ausgang mehr an b, ein Kreislauf in x). */
const ZUG = [
  '## Nodes', '### FLOW', '+ FLOW-ba|Rueckmeldung von b an a [__name:Rueckmeldung]', '',
  '## Edges', '+ FUNC-b -io-> FLOW-ba', '+ FLOW-ba -io-> FUNC-a', '+ FLOW-ba -relation-> SCHEMA-s',
].join('\n');

/** Ein Zug, der einen Vertrag ohne Test anlegt: er zieht einen Befund aus dem Bau nach sich. */
const ZUG_MIT_BAU = [
  '## Nodes', '### SCHEMA', '+ SCHEMA-neu|Neuer Vertrag [__name:Vertrag]',
  '### FLOW', '+ FLOW-neu|Neuer Fluss von b an c [__name:Fluss]', '',
  '## Edges', '+ FUNC-b -io-> FLOW-neu', '+ FLOW-neu -io-> FUNC-c', '+ FLOW-neu -relation-> SCHEMA-neu',
].join('\n');

const SEED = ['FCHAIN-x', 'FUNC-b'];
const BAU = ['R-19', 'R-20', 'R-26', 'R-32'];
const regel = (id: string) => ALL_RULE_DEFS.find((r) => r.id === id);
const zeilenMit = (wort: RegExp) => skill.split('\n').filter((z) => wort.test(z));

let dir: string;
let m: Measured;
let davor: Antwort;
let probe: Antwort;
let danach: Antwort;
let probeMitBau: Antwort;
let vorschlaege: Antwort[];

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'skill-optimize-'));
  const pfad = join(dir, 'probemodell.json');
  writeFileSync(pfad, JSON.stringify(MODELL));
  m = await openMeasured({ graph: pfad, systemId: 'x' });
  const ruf = (name: string, input: unknown) =>
    (m.tools[name].handler as (i: unknown) => Promise<Antwort>)(input);
  davor = await ruf('graph_metrics', { scope: SEED });
  probe = await ruf('graph_mutate', { formatE: ZUG, dryRun: true, violations: 'full' });
  danach = await ruf('graph_metrics', { scope: SEED });
  probeMitBau = await ruf('graph_mutate', { formatE: ZUG_MIT_BAU, dryRun: true, violations: 'full' });
  vorschlaege = ((await ruf('graph_suggest', { k: 5, layer: 'arch' })).suggestions ?? []) as Antwort[];
}, 60_000);

afterAll(async () => {
  await m?.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('se:optimize Version 3: zwei Quellen, getrennt, ohne Rangfolge (CR-GC-785)', () => {
  it('der Kopf traegt Version 4 unter dem alten Namen', () => {
    expect(skill).toMatch(/^name: se:optimize$/m);
    expect(skill).toMatch(/^version: 4$/m);
  });

  it('Quelle (a) kommt in der festen Form, wortgleich mit dem, was se-fmea abgibt', () => {
    const form = '`Zweck | Kette | Ort | Handlungsklasse | Prognose | Preis`';
    expect(fmea, 'Praemisse: se-fmea gibt Vorschlaege in dieser Form ab').toContain(form);
    expect(skill).toContain(form);
    expect(skill).toMatch(/Prognose[^\n]*was besser wird[^\n]*was gleich bleibt/);
    // Ein unvollstaendiger Vorschlag geht zurueck; der Optimierer erfindet weder Zweck noch Prognose.
    expect(skill).toMatch(/Fehlt eine[^\n]*Angaben[^\n]*zurück/);
    expect(skill).toMatch(/ergänzt keinen Zweck/);
  });

  it('Quelle (b) ist graph_suggest, und die zwei Quellen stehen getrennt', () => {
    expect(skill).toMatch(/\*\*\(a\)[^\n]*Analyse/);
    expect(skill).toMatch(/\*\*\(b\)[^\n]*`graph_suggest`/);
    expect(skill).toMatch(/keine gemeinsame Rangfolge/);
    expect(skill).toMatch(/zwei(?:| getrennten) Abschnitten/);
  });

  it('der Skill bildet keine Rangfolge, nennt keinen Sieger und empfiehlt nicht', () => {
    for (const wort of [/Rangfolge/, /Sieger/, /empf(?:ehl|iehl)/i, /\bordne(?:st|t)?\b|\bordnet\b/]) {
      const zeilen = zeilenMit(wort);
      for (const zeile of zeilen) expect(zeile, `${wort}: nur verneint`).toMatch(/\bkein|\bnicht\b|\bnie\b|\bnichts\b/i);
    }
    expect(zeilenMit(/Rangfolge/).length, 'die Verneinung steht da').toBeGreaterThan(0);
    expect(zeilenMit(/Sieger/).length).toBeGreaterThan(0);
    // Keine Anweisung, die eine Ordnung herstellt (Version 2: „Top-Vorschlaege").
    expect(skill).not.toMatch(/Top-|absteigend|aufsteigend|sortier|Bestenliste|Platz \d|am besten|der beste|die beste/i);
  });

  it('keine Summe und keine Rechnung ueber Kennzahlen', () => {
    expect(skill).not.toMatch(/Summe|Durchschnitt|Mittelwert|Quotient|Prozent|%|÷|Gesamtwert|Gesamtnote|Punktzahl|Punktwert|aufaddier|zusammenzähl/i);
    expect(skill).toMatch(/rechnest keine Kennzahl/);
    // Die verworfenen Groessen der Spikes stehen nicht als Mass im Text.
    expect(skill).not.toMatch(/Gewicht der Träger|Flüsse an den Trägern/);
  });
});

describe('se:optimize Version 3: die Vorlage davor liest echte Felder (CR-GC-785)', () => {
  it('der Umfang kommt aus scope, mit der Kette und den beruehrten Funktionen als Eingabe', () => {
    expect(skill).toMatch(/graph_metrics\(\{ scope: \["<FCHAIN>", "<FUNC>"/);
    const umfang = davor.scope as Zeile;
    expect(skill).toContain('`scope`');
    for (const feld of ['modules', 'chains', 'requirements']) {
      expect(skill, feld).toContain(`\`${feld}\``);
      expect(umfang, feld).toHaveProperty(feld);
    }
    expect(umfang.chains, 'Praemisse: die geteilte Funktion zieht die zweite Kette in den Umfang').toEqual(['FCHAIN-x', 'FCHAIN-y']);
    expect(skill).toMatch(/Länge der Liste/);
  });

  it('jedes Feld der Kettenzeile, das der Skill nennt, traegt die Antwort von graph_metrics', () => {
    const zeile = (davor.chains as Zeile[]).find((c) => c.chainId === 'FCHAIN-x')!;
    expect(zeile.measurable, 'Praemisse: die Probekette ist bewertbar').toBe(true);
    for (const feld of ['length', 'memberCount', 'branching', 'fanIn', 'moduleBoundaries', 'loops', 'shared', 'boundaries', 'imports', 'handovers']) {
      expect(skill, feld).toContain(`\`${feld}\``);
      expect(zeile, feld).toHaveProperty(feld);
    }
  });

  it('Traeger je Risiko und die Reichweite je Funktion kommen aus riskCarriers und functions', () => {
    const traeger = davor.riskCarriers as { risks: Zeile[]; surface: Zeile[] };
    expect(skill).toContain('`riskCarriers`');
    for (const feld of ['riskId', 'carriers', 'satisfiers']) {
      expect(skill, feld).toContain(`\`${feld}\``);
      expect(traeger.risks[0], feld).toHaveProperty(feld);
    }
    expect(skill).toContain('`surface`');
    expect(traeger.surface[0]).toHaveProperty('funcId');
    const funktion = (davor.functions as Zeile[])[0];
    expect(skill).toContain('`functions`');
    for (const feld of ['chains', 'useCases']) {
      expect(skill, feld).toContain(`\`${feld}\``);
      expect(funktion, feld).toHaveProperty(feld);
    }
  });

  it('die Kennzahlen des Modulbaums stehen neben ihrer Schwelle aus policy', () => {
    const modul = (davor.modules as Zeile[])[0];
    for (const feld of ['fanIn', 'fanOut', 'instability', 'lcom4', 'cohesion', 'uphillDependencies']) {
      expect(skill, feld).toContain(`\`${feld}\``);
      expect(modul, feld).toHaveProperty(feld);
    }
    for (const feld of ['policy', 'policySource']) {
      expect(skill, feld).toContain(`\`${feld}\``);
      expect(davor, feld).toHaveProperty(feld);
    }
    expect(skill).toMatch(/`policy`[^\n]*Schwelle|Schwelle[^\n]*`policy`/);
  });

  it('eine nicht bewertbare Kette wird nicht geprobt, der Skill verweist auf se-vorbereitung', () => {
    expect(skill).toMatch(/measurable: false[^\n]*`se-vorbereitung`/);
    expect(skill).toContain('`reasons`');
  });

  it('ein Ausgang oder eine Aufgabe mehr an einer Funktion: der Umfang nennt ihre Anforderungen', () => {
    expect(skill).toMatch(/Ausgang oder eine Aufgabe[^\n]*jede Anforderung dieser Funktion/);
    expect(skill).toMatch(/graph_metrics\(\{ scope: \["<FUNC>"\] \}\)/);
    // Was der Text zusagt, rechnet der Vertrag so: die Anforderung an der Funktion steht in ihrem Umfang.
    const graph = { elements: MODELL.elements, traces: MODELL.traces } as unknown as Parameters<typeof requirementScope>[0];
    expect(requirementScope(graph, ['FUNC-a']).requirements).toContain('REQ-a');
  });

  it('der Antwortweg ist keine Kennzahl: der Skill nennt ihn nur als kuenftig', () => {
    expect(skill).toMatch(/Antwortweg[^\n]*CR-SM-408/);
    expect(skill).toMatch(/Antwortweg[^\n]*(noch keine Kennzahl|sobald)/);
    expect(skill).not.toContain('syncDepth');
    const zeile = (davor.chains as Zeile[]).find((c) => c.chainId === 'FCHAIN-x')!;
    expect(zeile.syncDepth, 'Praemisse: die Zeile misst dafuer nichts').toBeNull();
  });
});

describe('se:optimize Version 3: die Probe verspricht nur, was der Trockenlauf traegt (CR-GC-785)', () => {
  it('jeder Aufruf von graph_mutate im Skill ist ein Trockenlauf', () => {
    const aufrufe = skill.match(/graph_mutate\(\{[^\n]*/g) ?? [];
    expect(aufrufe.length, 'der Skill zeigt die Probe als Aufruf').toBeGreaterThan(0);
    for (const aufruf of aufrufe) expect(aufruf).toContain('dryRun: true');
  });

  it('jedes Feld des Urteils, das der Skill nennt, traegt die Antwort oder ihr Vertrag', () => {
    expect(probe.success, 'Praemisse: das Gate laesst den Zug der Probe durch').toBe(true);
    for (const feld of ['success', 'tier', 'violations', 'steeringDelta']) {
      expect(skill, feld).toContain(`\`${feld}\``);
      expect(probe, feld).toHaveProperty(feld);
    }
    expect(SteeringDelta.safeParse(probe.steeringDelta).success).toBe(true);
    for (const feld of ['blockingErrors', 'stages']) {
      expect(skill, feld).toContain(`\`${feld}\``);
      expect(SteeringDelta.shape, feld).toHaveProperty(feld);
    }
    for (const feld of ['before', 'after', 'delta']) {
      expect(skill, feld).toContain(`\`${feld}\``);
      expect(SteeringStageDelta.shape, feld).toHaveProperty(feld);
    }
    // Die drei Berichte fehlen in der Antwort, wenn sie nichts melden; gebunden wird an ihren Vertrag.
    expect(skill).toContain('`steerAdvisory`');
    for (const feld of ['improvement', 'worstAt', 'removesElements']) {
      expect(skill, feld).toContain(`\`${feld}\``);
      expect(SteerAdvisory.shape, feld).toHaveProperty(feld);
    }
    expect(skill).toContain('`fitAdvisory`');
    expect(skill).toContain('`regressions`');
    expect(FitAdvisory.shape).toHaveProperty('regressions');
    expect(skill).toContain('`workOrder`');
    for (const feld of ['moves', 'blind']) {
      expect(skill, feld).toContain(`\`${feld}\``);
      expect(WorkOrder.shape, feld).toHaveProperty(feld);
    }
  });

  it('der Trockenlauf schreibt nichts: graph_metrics misst danach denselben Stand', () => {
    expect(danach.graphVersion).toBe(davor.graphVersion);
    expect(danach.chains).toEqual(davor.chains);
    expect(danach.riskCarriers).toEqual(davor.riskCarriers);
    expect(danach.modules).toEqual(davor.modules);
    expect(skill).toMatch(/Trockenlauf schreibt nichts/);
  });

  it('die Spalte danach kommt aus metricsAfter: jede Liste, die der Skill nennt, traegt das Urteil (CR-GC-790)', () => {
    expect(skill).toContain('`metricsAfter`');
    const bericht = MetricsAfter.parse(probe.metricsAfter);
    for (const feld of ['chains', 'modules', 'functions', 'riskCarriers', 'removed']) {
      expect(skill, feld).toContain(`\`${feld}\``);
      expect(bericht, feld).toHaveProperty(feld);
    }
    for (const feld of ['risks', 'surface']) {
      expect(skill, feld).toContain(`\`${feld}\``);
      expect(bericht.riskCarriers, feld).toHaveProperty(feld);
    }
    // Jede Zeile der Vorlage mit einer Spalte danach nennt die Liste, aus der sie kommt.
    expect(skill).toMatch(/\| Ketten des Umfangs[^\n]*`metricsAfter\.chains`/);
    expect(skill).toMatch(/\| Träger je Risiko[^\n]*`metricsAfter\.riskCarriers`/);
    expect(skill).toMatch(/\| Modulbaum und Funktionsbaum[^\n]*`metricsAfter\.modules`[^\n]*`metricsAfter\.functions`/);
    // Der Zug der Probe schliesst einen Kreislauf in x: die Zeile danach steht im Urteil, und sie
    // ist eine andere als die, die graph_metrics davor und nach der Probe misst.
    const x = bericht.chains.find((c) => c.chainId === 'FCHAIN-x') as Zeile;
    const xDavor = (davor.chains as Zeile[]).find((c) => c.chainId === 'FCHAIN-x')!;
    expect(x, 'Praemisse: der Zug der Probe aendert die Zeile der Kette x').toBeDefined();
    expect((x.loops as unknown[]).length).toBe((xDavor.loops as unknown[]).length + 1);
    // Der Text sagt, wie eine nicht genannte Zeile zu lesen ist und dass der Bericht auch leer dasteht.
    expect(skill).toMatch(/nicht steht[^\n]*\n?[^\n]*unverändert/);
    expect(skill).toMatch(/`metricsAfter` steht bei jedem Trockenlauf da[^\n]*auch leer/);
    expect(skill).toMatch(/Leere Listen heißen/);
    expect(skill).toContain('`berichtFehlt`');
  });

  it('was offen bleibt, steht im Skill: das Urteil traegt keinen Betrachtungsumfang', () => {
    expect(probe).not.toHaveProperty('scope');
    expect(probe.metricsAfter).not.toHaveProperty('scope');
    expect(skill).toMatch(/Was das Urteil nicht trägt/);
    expect(skill).toMatch(/nicht trägt[^\n]*Betrachtungsumfang/);
    expect(skill).toMatch(/von Hand/);
    // Betrachtungsumfang und Befunde ohne Bau fuellt erst das Nachmessen im CR.
    expect(skill).toMatch(/\| Betrachtungsumfang[^\n]*Nachmessen im CR/);
    expect(skill).toMatch(/\| Befunde ohne Bau[^\n]*Nachmessen im CR/);
    // Die Zeilen, die der Bericht traegt, verweist der Skill nicht mehr ans Nachmessen.
    expect(skill).not.toMatch(/\| (Ketten des Umfangs|Träger je Risiko|Modulbaum und Funktionsbaum)[^\n]*Nachmessen im CR/);
  });

  it('der Vergleich zaehlt keine Befunde aus dem Bau, und die vier Regeln gibt es', () => {
    for (const id of BAU) {
      expect(skill, id).toContain(`\`${id}\``);
      expect(regel(id), id).toBeDefined();
    }
    expect(skill).toMatch(/aus dem Bau[^\n]*`R-19`[^\n]*`R-20`[^\n]*`R-26`[^\n]*`R-32`/);
    // Warum der Skill sie ausnimmt: ein Zug mit einem neuen Element bringt sie mit.
    const neu = (probeMitBau.violations as Zeile[]).map((v) => v.ruleId);
    expect(neu, 'Praemisse: der neue Vertrag ohne Test meldet R-32').toContain('R-32');
    // Die Stufen im Urteil zaehlen sie mit; der Skill sagt das.
    expect(skill).toMatch(/`stages`[^\n]*zählen[^\n]*Bau[^\n]*mit/);
  });
});

describe('se:optimize Version 3: Quelle (b), Pruefung, Wahl (CR-GC-785)', () => {
  it('jedes Feld eines Vorschlags von graph_suggest, das der Skill nennt, traegt die Antwort', () => {
    const anwendbar = vorschlaege.find((s) => s.applicable === true && s.edit && s.verdict);
    expect(anwendbar, 'Praemisse: am Probemodell gibt es einen anwendbaren Vorschlag').toBeDefined();
    for (const feld of ['ruleId', 'elementId', 'score', 'delta', 'applicable', 'edit', 'verdict']) {
      expect(skill, feld).toContain(`\`${feld}\``);
      expect(anwendbar, feld).toHaveProperty(feld);
    }
    // Die Lesart von `score`: die Verbesserung des Steuerwerts aus dem Trockenlauf genau dieses Zugs.
    expect(skill).toMatch(/`score`[^\n]*Steuerwert/);
    const urteil = anwendbar!.verdict as { steer: { improvement: number } };
    expect(anwendbar!.score).toBe(urteil.steer.improvement);
    expect(skill).toMatch(/applicable: false[^\n]*nichts anzuwenden/);
  });

  it('die Pruefung gegen die Prognose steht in der Vorlage oben', () => {
    const kopf = skill.indexOf('Prüfung gegen die Prognose');
    const tabelle = skill.indexOf('| Teil | davor');
    expect(kopf, 'die Prüfung ist benannt').toBeGreaterThan(-1);
    expect(tabelle, 'die Vorlage hat ihre Tabelle').toBeGreaterThan(-1);
    expect(kopf).toBeLessThan(tabelle);
    expect(skill).toMatch(/was gleich bleiben muss und es nicht bleibt[^\n]*(oben|zuerst)/i);
    expect(skill).toMatch(/Verbesserung[^\n]*Gleichbleiben verletzt[^\n]*zählt nicht/);
  });

  it('der Skill wendet nicht an: die Wahl gehoert dem Autor, Anwenden und Nachmessen dem CR', () => {
    expect(skill).toMatch(/Kein Auto-Apply/);
    expect(skill).toMatch(/Du wendest nicht an/);
    expect(skill).toMatch(/Anwenden und Nachmessen gehören dem CR/);
    expect(skill).toMatch(/je Vorschlag[^\n]*einzeln|einzeln[^\n]*je Vorschlag/);
    expect(skill).toMatch(/ohne Wahl[^\n]*(kein CR|nichts)/i);
  });

  it('die Lage ist nach CDR und vor den Kettentests auf Stufe 9', () => {
    expect(skill).toMatch(/nach[^\n]*CDR[^\n]*vor den Kettentests[^\n]*Stufe 9/);
    expect(ALL_RULE_DEFS.some((r) => r.mark === 'CDR'), 'Praemisse: der Katalog kennt die Marke CDR').toBe(true);
    expect(skill).toMatch(/nach der Bindung[^\n]*Code/);
  });
});
