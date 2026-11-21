// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-export-answer → src/projections/export.ts#GraphExportAnswerSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { GraphExportAnswerSchema as S } from '../../src/projections/export.js';

describe('Vertrag SCHEMA-export-answer', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1})).toEqual({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1});
  });
  it("lehnt ab ohne graphJson", () => {
    expect(S.safeParse({"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("lehnt ab: graphJson mit falschem Typ", () => {
    expect(S.safeParse({"graphJson":"__falsch__","views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("lehnt ab ohne views", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("lehnt ab: views mit falschem Typ", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":"__falsch__","stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("lehnt ab ohne stubs", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"unfedMutations":1}).success).toBe(false);
  });
  it("lehnt ab: stubs mit falschem Typ", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":"__falsch__","unfedMutations":1}).success).toBe(false);
  });
  it("lehnt ab: unfedMutations mit falschem Typ", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":"__falsch__"}).success).toBe(false);
  });
});
