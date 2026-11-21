// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-function-criticality → packages/contracts/src/se/function-criticality.ts#FunctionCriticality. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { FunctionCriticality as S } from '@sigloch/contracts/se';

describe('Vertrag SCHEMA-function-criticality', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"funcId":"beispiel","funcName":"beispiel","chains":0,"useCases":0})).toEqual({"funcId":"beispiel","funcName":"beispiel","chains":0,"useCases":0});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne funcId", () => {
    expect(S.safeParse({"funcName":"beispiel","chains":0,"useCases":0}).success).toBe(false);
  });
  it("lehnt ab: funcId mit falschem Typ", () => {
    expect(S.safeParse({"funcId":12345,"funcName":"beispiel","chains":0,"useCases":0}).success).toBe(false);
  });
  it("lehnt ab ohne funcName", () => {
    expect(S.safeParse({"funcId":"beispiel","chains":0,"useCases":0}).success).toBe(false);
  });
  it("lehnt ab: funcName mit falschem Typ", () => {
    expect(S.safeParse({"funcId":"beispiel","funcName":12345,"chains":0,"useCases":0}).success).toBe(false);
  });
  it("lehnt ab ohne chains", () => {
    expect(S.safeParse({"funcId":"beispiel","funcName":"beispiel","useCases":0}).success).toBe(false);
  });
  it("lehnt ab: chains mit falschem Typ", () => {
    expect(S.safeParse({"funcId":"beispiel","funcName":"beispiel","chains":"__falsch__","useCases":0}).success).toBe(false);
  });
  it("lehnt ab ohne useCases", () => {
    expect(S.safeParse({"funcId":"beispiel","funcName":"beispiel","chains":0}).success).toBe(false);
  });
  it("lehnt ab: useCases mit falschem Typ", () => {
    expect(S.safeParse({"funcId":"beispiel","funcName":"beispiel","chains":0,"useCases":"__falsch__"}).success).toBe(false);
  });
});
