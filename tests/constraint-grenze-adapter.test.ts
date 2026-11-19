/**
 * CR-GC-913 — Prüffunktionen `grenzeNurMitSchema` und `einAdapterJeAkteur`.
 *
 * Je Funktion ein guter Snapshot (kein Befund) und je Bruchart ein brechender (Befund nennt, was bricht).
 * Die Graphen sind echte Graph-Objekte im Format, das auch `eingaengeNurAus` bekommt.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import type { OntologyGraph } from '@sigloch/contracts/se';
import {
  AdapterBefund,
  GrenzBefund,
  einAdapterJeAkteur,
  grenzeNurMitSchema,
} from '../src/kernel/measure/constraints.js';

type El = OntologyGraph['elements'][number];
type Tr = OntologyGraph['traces'][number];
const el = (id: string, type: string): El => ({ id, type, name: id }) as unknown as El;
const tr = (source: string, target: string, type: string): Tr => ({ source, target, type }) as unknown as Tr;

const ELTERN = 'MOD-eltern';
const SCHEMAS = ['SCHEMA-vertrag'];
const AKTEURE = ['ACTOR-x', 'ACTOR-y'];

/** Eltern mit zwei Kind-Modulen; je ein Akteur, je ein Fluss mit Schema über die Grenze. */
function gut(): OntologyGraph {
  return {
    elements: [
      el(ELTERN, 'MOD'), el('MOD-a', 'MOD'), el('MOD-b', 'MOD'),
      el('FUNC-a1', 'FUNC'), el('FUNC-a2', 'FUNC'), el('FUNC-b1', 'FUNC'),
      el('ACTOR-x', 'ACTOR'), el('ACTOR-y', 'ACTOR'),
      el('FLOW-x-a', 'FLOW'), el('FLOW-b-y', 'FLOW'), el('FLOW-a-intern', 'FLOW'),
      el('SCHEMA-vertrag', 'SCHEMA'), el('SCHEMA-anderes', 'SCHEMA'),
    ],
    traces: [
      tr(ELTERN, 'MOD-a', 'compose'), tr(ELTERN, 'MOD-b', 'compose'),
      tr('FUNC-a1', 'MOD-a', 'allocate'), tr('FUNC-a2', 'MOD-a', 'allocate'), tr('FUNC-b1', 'MOD-b', 'allocate'),
      tr('ACTOR-x', 'FLOW-x-a', 'io'), tr('FLOW-x-a', 'FUNC-a1', 'io'), tr('FLOW-x-a', 'SCHEMA-vertrag', 'relation'),
      tr('FUNC-b1', 'FLOW-b-y', 'io'), tr('FLOW-b-y', 'ACTOR-y', 'io'), tr('FLOW-b-y', 'SCHEMA-vertrag', 'relation'),
      // Fluss innerhalb von MOD-a: keine Grenze, braucht kein Schema.
      tr('FUNC-a1', 'FLOW-a-intern', 'io'), tr('FLOW-a-intern', 'FUNC-a2', 'io'),
    ],
  } as unknown as OntologyGraph;
}

const LEER_GRENZE = { ohneSchema: [], zwischenKindern: [] };
const LEER_ADAPTER = { flussOhneEinModul: [], moduleOhneEinenAkteur: [], akteurOhneAdapter: [] };

describe('CR-GC-913: grenzeNurMitSchema', () => {
  it('guter Snapshot: jeder Grenzfluss trägt ein Schema der Liste, kein Fluss zwischen Kind-Modulen', () => {
    expect(grenzeNurMitSchema(gut(), ELTERN, SCHEMAS)).toEqual(LEER_GRENZE);
  });

  it('Bruch 1: ein Grenzfluss ohne Schema ist rot und nennt Fluss und Kind-Modul', () => {
    const g = gut();
    g.traces = g.traces.filter((t) => !(t.source === 'FLOW-x-a' && t.type === ('relation' as Tr['type'])));
    expect(grenzeNurMitSchema(g, ELTERN, SCHEMAS)).toEqual({
      ohneSchema: [{ fluss: 'FLOW-x-a', module: ['MOD-a'], schemas: [] }],
      zwischenKindern: [],
    });
  });

  it('Bruch 2: ein Grenzfluss mit einem Schema außerhalb der Liste ist rot und nennt das fremde Schema', () => {
    const g = gut();
    g.traces.push(tr('FLOW-b-y', 'SCHEMA-anderes', 'relation'));
    expect(grenzeNurMitSchema(g, ELTERN, SCHEMAS)).toEqual({
      ohneSchema: [{ fluss: 'FLOW-b-y', module: ['MOD-b'], schemas: ['SCHEMA-anderes', 'SCHEMA-vertrag'] }],
      zwischenKindern: [],
    });
  });

  it('Bruch 3: ein Fluss zwischen zwei Kind-Modulen ist rot, auch mit Schema aus der Liste', () => {
    const g = gut();
    g.elements.push(el('FLOW-a-b', 'FLOW'));
    g.traces.push(
      tr('FUNC-a1', 'FLOW-a-b', 'io'), tr('FLOW-a-b', 'FUNC-b1', 'io'), tr('FLOW-a-b', 'SCHEMA-vertrag', 'relation'),
    );
    expect(grenzeNurMitSchema(g, ELTERN, SCHEMAS)).toEqual({
      ohneSchema: [],
      zwischenKindern: [{ fluss: 'FLOW-a-b', von: ['MOD-a'], nach: ['MOD-b'] }],
    });
  });

  it('Bruch 3 ohne Schema: beide Listen nennen den Fluss', () => {
    const g = gut();
    g.elements.push(el('FLOW-a-b', 'FLOW'));
    g.traces.push(tr('FUNC-a1', 'FLOW-a-b', 'io'), tr('FLOW-a-b', 'FUNC-b1', 'io'));
    const b = grenzeNurMitSchema(g, ELTERN, SCHEMAS);
    expect(b.ohneSchema.map((x) => x.fluss)).toEqual(['FLOW-a-b']);
    expect(b.zwischenKindern.map((x) => x.fluss)).toEqual(['FLOW-a-b']);
  });

  it('ein Fluss von einer FUNC außerhalb der Kinder in ein Kind zählt als Grenzfluss', () => {
    const g = gut();
    g.elements.push(el('FUNC-draussen', 'FUNC'), el('FLOW-rein', 'FLOW'));
    g.traces.push(tr('FUNC-draussen', 'FLOW-rein', 'io'), tr('FLOW-rein', 'FUNC-b1', 'io'));
    expect(grenzeNurMitSchema(g, ELTERN, SCHEMAS).ohneSchema).toEqual([{ fluss: 'FLOW-rein', module: ['MOD-b'], schemas: [] }]);
  });

  it('FUNC an einem Enkel-Modul zählt zum Kind-Modul', () => {
    const g = gut();
    g.elements.push(el('MOD-a-tief', 'MOD'), el('FUNC-tief', 'FUNC'), el('FLOW-tief', 'FLOW'));
    g.traces.push(
      tr('MOD-a', 'MOD-a-tief', 'compose'), tr('FUNC-tief', 'MOD-a-tief', 'allocate'),
      tr('ACTOR-x', 'FLOW-tief', 'io'), tr('FLOW-tief', 'FUNC-tief', 'io'),
    );
    expect(grenzeNurMitSchema(g, ELTERN, SCHEMAS).ohneSchema).toEqual([{ fluss: 'FLOW-tief', module: ['MOD-a'], schemas: [] }]);
  });

  it('Vertrag GrenzBefund: nimmt jede Form an, lehnt fremde Felder ab', () => {
    const voll = {
      ohneSchema: [{ fluss: 'FLOW-a', module: ['MOD-a'], schemas: ['SCHEMA-s'] }],
      zwischenKindern: [{ fluss: 'FLOW-a', von: ['MOD-a'], nach: ['MOD-b'] }],
    };
    expect(GrenzBefund.parse(voll)).toEqual(voll);
    expect(GrenzBefund.parse(LEER_GRENZE)).toEqual(LEER_GRENZE);
    expect(() => GrenzBefund.parse({ ...LEER_GRENZE, extra: 1 })).toThrow();
    expect(() => GrenzBefund.parse({ ohneSchema: [{ fluss: 'FLOW-a' }], zwischenKindern: [] })).toThrow();
  });
});

describe('CR-GC-913: einAdapterJeAkteur', () => {
  it('guter Snapshot: jeder Akteur-Fluss endet in einem Kind-Modul, jedes Kind-Modul bedient einen Akteur', () => {
    expect(einAdapterJeAkteur(gut(), ELTERN, AKTEURE)).toEqual(LEER_ADAPTER);
  });

  it('Bruch 1: ein Akteur-Fluss, der in zwei Kind-Modulen endet, ist rot', () => {
    const g = gut();
    g.traces.push(tr('FLOW-x-a', 'FUNC-b1', 'io'));
    const b = einAdapterJeAkteur(g, ELTERN, AKTEURE);
    expect(b.flussOhneEinModul).toEqual([{ akteur: 'ACTOR-x', fluss: 'FLOW-x-a', module: ['MOD-a', 'MOD-b'] }]);
    // Folge: MOD-b bedient jetzt ACTOR-x und ACTOR-y.
    expect(b.moduleOhneEinenAkteur).toEqual([{ modul: 'MOD-b', akteure: ['ACTOR-x', 'ACTOR-y'] }]);
  });

  it('Bruch 2: ein Akteur-Fluss, der in keinem Kind-Modul endet, ist rot', () => {
    const g = gut();
    g.elements.push(el('FUNC-draussen', 'FUNC'));
    g.traces = g.traces.filter((t) => !(t.source === 'FLOW-x-a' && t.target === 'FUNC-a1'));
    g.traces.push(tr('FLOW-x-a', 'FUNC-draussen', 'io'));
    const b = einAdapterJeAkteur(g, ELTERN, AKTEURE);
    expect(b.flussOhneEinModul).toEqual([{ akteur: 'ACTOR-x', fluss: 'FLOW-x-a', module: [] }]);
    expect(b.moduleOhneEinenAkteur).toEqual([{ modul: 'MOD-a', akteure: [] }]);
    expect(b.akteurOhneAdapter).toEqual(['ACTOR-x']);
  });

  it('Bruch 3: ein Kind-Modul, das zwei Akteure bedient, ist rot und nennt beide', () => {
    const g = gut();
    g.elements.push(el('FLOW-y-a', 'FLOW'));
    g.traces.push(tr('ACTOR-y', 'FLOW-y-a', 'io'), tr('FLOW-y-a', 'FUNC-a2', 'io'));
    expect(einAdapterJeAkteur(g, ELTERN, AKTEURE)).toEqual({
      flussOhneEinModul: [],
      moduleOhneEinenAkteur: [{ modul: 'MOD-a', akteure: ['ACTOR-x', 'ACTOR-y'] }],
      akteurOhneAdapter: [],
    });
  });

  it('Bruch 4: ein Kind-Modul ohne Akteur ist rot', () => {
    const g = gut();
    g.elements.push(el('MOD-c', 'MOD'));
    g.traces.push(tr(ELTERN, 'MOD-c', 'compose'));
    expect(einAdapterJeAkteur(g, ELTERN, AKTEURE).moduleOhneEinenAkteur).toEqual([{ modul: 'MOD-c', akteure: [] }]);
  });

  it('Bruch 5: ein Akteur der Liste ohne Fluss in ein Kind-Modul ist rot', () => {
    expect(einAdapterJeAkteur(gut(), ELTERN, [...AKTEURE, 'ACTOR-z']).akteurOhneAdapter).toEqual(['ACTOR-z']);
  });

  it('Vertrag AdapterBefund: nimmt jede Form an, lehnt fremde Felder ab', () => {
    const voll = {
      flussOhneEinModul: [{ akteur: 'ACTOR-x', fluss: 'FLOW-a', module: [] }],
      moduleOhneEinenAkteur: [{ modul: 'MOD-a', akteure: ['ACTOR-x', 'ACTOR-y'] }],
      akteurOhneAdapter: ['ACTOR-z'],
    };
    expect(AdapterBefund.parse(voll)).toEqual(voll);
    expect(AdapterBefund.parse(LEER_ADAPTER)).toEqual(LEER_ADAPTER);
    expect(() => AdapterBefund.parse({ ...LEER_ADAPTER, extra: 1 })).toThrow();
  });
});
