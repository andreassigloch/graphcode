// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-sitzungsende → src/surface/session-end-contract.ts#SitzungsendeSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { SitzungsendeSchema as S } from '../../src/surface/session-end-contract.js';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-sitzungsende', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse("SIGINT")).toEqual("SIGINT");
  });
  it("Werteliste unverändert", () => {
    expect(Object.values(bei([])._zod.def.entries as Record<string, unknown>)).toEqual(["SIGINT","SIGTERM","SIGHUP","client disconnected","store lock lost"]);
  });
  it("nimmt SIGINT an", () => {
    expect(S.parse("SIGINT")).toEqual("SIGINT");
  });
  it("nimmt SIGTERM an", () => {
    expect(S.parse("SIGTERM")).toEqual("SIGTERM");
  });
  it("nimmt SIGHUP an", () => {
    expect(S.parse("SIGHUP")).toEqual("SIGHUP");
  });
  it("nimmt client disconnected an", () => {
    expect(S.parse("client disconnected")).toEqual("client disconnected");
  });
  it("nimmt store lock lost an", () => {
    expect(S.parse("store lock lost")).toEqual("store lock lost");
  });
  it("lehnt einen Wert außerhalb ab", () => {
    expect(S.safeParse("__ausserhalb__").success).toBe(false);
  });
});
