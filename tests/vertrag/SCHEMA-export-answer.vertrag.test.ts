// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-export-answer → src/projections/export.ts#GraphExportAnswerSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { GraphExportAnswerSchema as S } from '../../src/projections/export.js';

describe('Vertrag SCHEMA-export-answer', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1})).toEqual({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne graphJson", () => {
    expect(S.safeParse({"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("lehnt ab: graphJson mit falschem Typ", () => {
    expect(S.safeParse({"graphJson":"__falsch__","views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("graphJson: lehnt ab ohne path", () => {
    expect(S.safeParse({"graphJson":{"bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("graphJson: lehnt ab: path mit falschem Typ", () => {
    expect(S.safeParse({"graphJson":{"path":12345,"bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("graphJson: lehnt ab ohne bytes", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("graphJson: lehnt ab: bytes mit falschem Typ", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":"__falsch__","nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("graphJson: lehnt ab ohne nodes", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("graphJson: lehnt ab: nodes mit falschem Typ", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":"__falsch__","edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("graphJson: lehnt ab ohne edges", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("graphJson: lehnt ab: edges mit falschem Typ", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":"__falsch__"},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("lehnt ab ohne views", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("lehnt ab: views mit falschem Typ", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":"__falsch__","stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("views[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":["__falsch__"],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("views[]: lehnt ab ohne view", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("views[]: lehnt ab: view mit falschem Typ", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":12345,"path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("views[]: lehnt ab: view außerhalb des Enums", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"__ausserhalb__","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("views[]: lehnt ab ohne path", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("views[]: lehnt ab: path mit falschem Typ", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":12345,"bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("views[]: lehnt ab ohne bytes", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel"}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("views[]: lehnt ab: bytes mit falschem Typ", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":"__falsch__"}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("lehnt ab ohne stubs", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"unfedMutations":1}).success).toBe(false);
  });
  it("lehnt ab: stubs mit falschem Typ", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":"__falsch__","unfedMutations":1}).success).toBe(false);
  });
  it("stubs[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":[12345],"unfedMutations":1}).success).toBe(false);
  });
  it("lehnt ab: unfedMutations mit falschem Typ", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":"__falsch__"}).success).toBe(false);
  });
});
