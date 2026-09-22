/**
 * CR-GC-551 — `kinds` als Zeichenkette ueber den commands-Pfad.
 *
 * Root Cause: `normalizeReqKinds` laeuft auf dem Schreibpfad nur in `GraphService`
 * (`graph-api-core`, CR-195d). graphcodes Apply-Pfad geht dort NICHT durch — `applyCommands`
 * mischt `attributes` roh zusammen und persistiert, was kam. Eine Zeichenkette bleibt eine
 * Zeichenkette.
 *
 * Warum es zweieinhalb Wochen unentdeckt blieb: die LESER normalisieren weiterhin, also urteilt
 * das Gate richtig. Es ist ein Persistenz-, kein Urteilsdefekt. Gemessen am Lauf vom 2026-09-19
 * (`rig/sigllm-spezifikation`): ein Opus-Arm autoriert 49 REQ ueber `graph_mutate`, **49 von 49**
 * tragen `kinds` als Zeichenkette, 0 Gate-Ablehnungen im ganzen Lauf.
 *
 * Was bricht: Sichten, die auf Listen-Mitgliedschaft filtern (NFR-Register, ConOps), verlieren
 * diese REQ still, und R-02 bietet Kandidaten nach `kinds` an — eine Zeichenkette matcht dort nichts.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { applyCommands } from '../src/kernel/apply-commands.js';
import type { Graph } from '@sigloch/graph-api-core';
import type { MutateCommand } from '@sigloch/contracts/harness';

const leer = (): Graph => ({ nodes: [], edges: [] });
const addReq = (uid: string, kinds: unknown): MutateCommand =>
  ({ op: 'add-node', node: { uid, type: 'REQ', name: uid, description: 'x', attributes: { kinds } } }) as MutateCommand;

const kindsOf = (g: Graph, uid: string) => g.nodes.find((n) => n.uid === uid)?.attributes?.kinds;

describe('CR-GC-551: applyCommands normalisiert `kinds`, nicht erst der Leser', () => {
  it('eine einzelne Zeichenkette wird zur einelementigen Liste', () => {
    const { graph } = applyCommands(leer(), [addReq('REQ-a', 'functional')]);
    expect(kindsOf(graph, 'REQ-a')).toEqual(['functional']);
  });

  it('eine kommagetrennte Zeichenkette wird zur Liste — der Fall aus dem Lauf', () => {
    const { graph } = applyCommands(leer(), [addReq('REQ-b', 'functional,precondition')]);
    expect(kindsOf(graph, 'REQ-b')).toEqual(['functional', 'precondition']);
  });

  it('eine Liste bleibt unveraendert — nicht doppelt normalisiert', () => {
    const { graph } = applyCommands(leer(), [addReq('REQ-c', ['functional'])]);
    expect(kindsOf(graph, 'REQ-c')).toEqual(['functional']);
  });

  it('nicht gesetzt bleibt nicht gesetzt — eine leere Liste waere eine andere Aussage', () => {
    const { graph } = applyCommands(leer(), [
      { op: 'add-node', node: { uid: 'REQ-d', type: 'REQ', name: 'REQ-d', description: 'x', attributes: {} } } as MutateCommand,
    ]);
    expect(kindsOf(graph, 'REQ-d')).toBeUndefined();
  });

  it('update-node laeuft durch denselben Merge — und wird ebenso normalisiert', () => {
    const { graph: g1 } = applyCommands(leer(), [addReq('REQ-e', ['functional'])]);
    const { graph: g2 } = applyCommands(g1, [
      { op: 'update-node', node: { uid: 'REQ-e', attributes: { kinds: 'non-functional' } } } as MutateCommand,
    ]);
    expect(kindsOf(g2, 'REQ-e')).toEqual(['non-functional']);
  });
});
