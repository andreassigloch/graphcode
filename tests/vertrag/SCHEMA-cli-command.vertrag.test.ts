// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-cli-command → src/surface/cli-args.ts#CliVerbSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { CliVerbSchema as S } from '../../src/surface/cli-args.js';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-cli-command', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse("mcp")).toEqual("mcp");
  });
  it("Werteliste unverändert", () => {
    expect(Object.values(bei([])._zod.def.entries as Record<string, unknown>)).toEqual(["mcp","host","status","init","remove","import-code","render","rewind","upgrade","skills","vertragstest","typbindung"]);
  });
  it("nimmt mcp an", () => {
    expect(S.parse("mcp")).toEqual("mcp");
  });
  it("nimmt host an", () => {
    expect(S.parse("host")).toEqual("host");
  });
  it("nimmt status an", () => {
    expect(S.parse("status")).toEqual("status");
  });
  it("nimmt init an", () => {
    expect(S.parse("init")).toEqual("init");
  });
  it("nimmt remove an", () => {
    expect(S.parse("remove")).toEqual("remove");
  });
  it("nimmt import-code an", () => {
    expect(S.parse("import-code")).toEqual("import-code");
  });
  it("nimmt render an", () => {
    expect(S.parse("render")).toEqual("render");
  });
  it("nimmt rewind an", () => {
    expect(S.parse("rewind")).toEqual("rewind");
  });
  it("nimmt upgrade an", () => {
    expect(S.parse("upgrade")).toEqual("upgrade");
  });
  it("nimmt skills an", () => {
    expect(S.parse("skills")).toEqual("skills");
  });
  it("nimmt vertragstest an", () => {
    expect(S.parse("vertragstest")).toEqual("vertragstest");
  });
  it("nimmt typbindung an", () => {
    expect(S.parse("typbindung")).toEqual("typbindung");
  });
  it("lehnt einen Wert außerhalb ab", () => {
    expect(S.safeParse("__ausserhalb__").success).toBe(false);
  });
});
