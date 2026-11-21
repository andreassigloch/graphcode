// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-module-metrics → packages/contracts/src/se/metric-rules.ts#ModuleMetrics. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { ModuleMetrics as S } from '@sigloch/contracts/se';

describe('Vertrag SCHEMA-module-metrics', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"moduleId":"beispiel","moduleName":"beispiel","allocatedFuncs":1,"fanIn":1,"fanOut":1,"instability":1,"lcom4":1,"lcom4Boxes":1,"rollupContainer":true,"cohesion":{"internal":1,"external":1,"ratio":1},"uphillDependencies":1})).toEqual({"moduleId":"beispiel","moduleName":"beispiel","allocatedFuncs":1,"fanIn":1,"fanOut":1,"instability":1,"lcom4":1,"lcom4Boxes":1,"rollupContainer":true,"cohesion":{"internal":1,"external":1,"ratio":1},"uphillDependencies":1});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne moduleId", () => {
    expect(S.safeParse({"moduleName":"beispiel","allocatedFuncs":1,"fanIn":1,"fanOut":1,"instability":1,"lcom4":1,"lcom4Boxes":1,"rollupContainer":true,"cohesion":{"internal":1,"external":1,"ratio":1},"uphillDependencies":1}).success).toBe(false);
  });
  it("lehnt ab: moduleId mit falschem Typ", () => {
    expect(S.safeParse({"moduleId":12345,"moduleName":"beispiel","allocatedFuncs":1,"fanIn":1,"fanOut":1,"instability":1,"lcom4":1,"lcom4Boxes":1,"rollupContainer":true,"cohesion":{"internal":1,"external":1,"ratio":1},"uphillDependencies":1}).success).toBe(false);
  });
  it("lehnt ab ohne moduleName", () => {
    expect(S.safeParse({"moduleId":"beispiel","allocatedFuncs":1,"fanIn":1,"fanOut":1,"instability":1,"lcom4":1,"lcom4Boxes":1,"rollupContainer":true,"cohesion":{"internal":1,"external":1,"ratio":1},"uphillDependencies":1}).success).toBe(false);
  });
  it("lehnt ab: moduleName mit falschem Typ", () => {
    expect(S.safeParse({"moduleId":"beispiel","moduleName":12345,"allocatedFuncs":1,"fanIn":1,"fanOut":1,"instability":1,"lcom4":1,"lcom4Boxes":1,"rollupContainer":true,"cohesion":{"internal":1,"external":1,"ratio":1},"uphillDependencies":1}).success).toBe(false);
  });
  it("lehnt ab ohne allocatedFuncs", () => {
    expect(S.safeParse({"moduleId":"beispiel","moduleName":"beispiel","fanIn":1,"fanOut":1,"instability":1,"lcom4":1,"lcom4Boxes":1,"rollupContainer":true,"cohesion":{"internal":1,"external":1,"ratio":1},"uphillDependencies":1}).success).toBe(false);
  });
  it("lehnt ab: allocatedFuncs mit falschem Typ", () => {
    expect(S.safeParse({"moduleId":"beispiel","moduleName":"beispiel","allocatedFuncs":"__falsch__","fanIn":1,"fanOut":1,"instability":1,"lcom4":1,"lcom4Boxes":1,"rollupContainer":true,"cohesion":{"internal":1,"external":1,"ratio":1},"uphillDependencies":1}).success).toBe(false);
  });
  it("lehnt ab ohne fanIn", () => {
    expect(S.safeParse({"moduleId":"beispiel","moduleName":"beispiel","allocatedFuncs":1,"fanOut":1,"instability":1,"lcom4":1,"lcom4Boxes":1,"rollupContainer":true,"cohesion":{"internal":1,"external":1,"ratio":1},"uphillDependencies":1}).success).toBe(false);
  });
  it("lehnt ab: fanIn mit falschem Typ", () => {
    expect(S.safeParse({"moduleId":"beispiel","moduleName":"beispiel","allocatedFuncs":1,"fanIn":"__falsch__","fanOut":1,"instability":1,"lcom4":1,"lcom4Boxes":1,"rollupContainer":true,"cohesion":{"internal":1,"external":1,"ratio":1},"uphillDependencies":1}).success).toBe(false);
  });
  it("lehnt ab ohne fanOut", () => {
    expect(S.safeParse({"moduleId":"beispiel","moduleName":"beispiel","allocatedFuncs":1,"fanIn":1,"instability":1,"lcom4":1,"lcom4Boxes":1,"rollupContainer":true,"cohesion":{"internal":1,"external":1,"ratio":1},"uphillDependencies":1}).success).toBe(false);
  });
  it("lehnt ab: fanOut mit falschem Typ", () => {
    expect(S.safeParse({"moduleId":"beispiel","moduleName":"beispiel","allocatedFuncs":1,"fanIn":1,"fanOut":"__falsch__","instability":1,"lcom4":1,"lcom4Boxes":1,"rollupContainer":true,"cohesion":{"internal":1,"external":1,"ratio":1},"uphillDependencies":1}).success).toBe(false);
  });
  it("lehnt ab ohne instability", () => {
    expect(S.safeParse({"moduleId":"beispiel","moduleName":"beispiel","allocatedFuncs":1,"fanIn":1,"fanOut":1,"lcom4":1,"lcom4Boxes":1,"rollupContainer":true,"cohesion":{"internal":1,"external":1,"ratio":1},"uphillDependencies":1}).success).toBe(false);
  });
  it("lehnt ab: instability mit falschem Typ", () => {
    expect(S.safeParse({"moduleId":"beispiel","moduleName":"beispiel","allocatedFuncs":1,"fanIn":1,"fanOut":1,"instability":"__falsch__","lcom4":1,"lcom4Boxes":1,"rollupContainer":true,"cohesion":{"internal":1,"external":1,"ratio":1},"uphillDependencies":1}).success).toBe(false);
  });
  it("lehnt ab ohne lcom4", () => {
    expect(S.safeParse({"moduleId":"beispiel","moduleName":"beispiel","allocatedFuncs":1,"fanIn":1,"fanOut":1,"instability":1,"lcom4Boxes":1,"rollupContainer":true,"cohesion":{"internal":1,"external":1,"ratio":1},"uphillDependencies":1}).success).toBe(false);
  });
  it("lehnt ab: lcom4 mit falschem Typ", () => {
    expect(S.safeParse({"moduleId":"beispiel","moduleName":"beispiel","allocatedFuncs":1,"fanIn":1,"fanOut":1,"instability":1,"lcom4":"__falsch__","lcom4Boxes":1,"rollupContainer":true,"cohesion":{"internal":1,"external":1,"ratio":1},"uphillDependencies":1}).success).toBe(false);
  });
  it("lehnt ab ohne lcom4Boxes", () => {
    expect(S.safeParse({"moduleId":"beispiel","moduleName":"beispiel","allocatedFuncs":1,"fanIn":1,"fanOut":1,"instability":1,"lcom4":1,"rollupContainer":true,"cohesion":{"internal":1,"external":1,"ratio":1},"uphillDependencies":1}).success).toBe(false);
  });
  it("lehnt ab: lcom4Boxes mit falschem Typ", () => {
    expect(S.safeParse({"moduleId":"beispiel","moduleName":"beispiel","allocatedFuncs":1,"fanIn":1,"fanOut":1,"instability":1,"lcom4":1,"lcom4Boxes":"__falsch__","rollupContainer":true,"cohesion":{"internal":1,"external":1,"ratio":1},"uphillDependencies":1}).success).toBe(false);
  });
  it("lehnt ab ohne rollupContainer", () => {
    expect(S.safeParse({"moduleId":"beispiel","moduleName":"beispiel","allocatedFuncs":1,"fanIn":1,"fanOut":1,"instability":1,"lcom4":1,"lcom4Boxes":1,"cohesion":{"internal":1,"external":1,"ratio":1},"uphillDependencies":1}).success).toBe(false);
  });
  it("lehnt ab: rollupContainer mit falschem Typ", () => {
    expect(S.safeParse({"moduleId":"beispiel","moduleName":"beispiel","allocatedFuncs":1,"fanIn":1,"fanOut":1,"instability":1,"lcom4":1,"lcom4Boxes":1,"rollupContainer":"__falsch__","cohesion":{"internal":1,"external":1,"ratio":1},"uphillDependencies":1}).success).toBe(false);
  });
  it("lehnt ab ohne cohesion", () => {
    expect(S.safeParse({"moduleId":"beispiel","moduleName":"beispiel","allocatedFuncs":1,"fanIn":1,"fanOut":1,"instability":1,"lcom4":1,"lcom4Boxes":1,"rollupContainer":true,"uphillDependencies":1}).success).toBe(false);
  });
  it("lehnt ab: cohesion mit falschem Typ", () => {
    expect(S.safeParse({"moduleId":"beispiel","moduleName":"beispiel","allocatedFuncs":1,"fanIn":1,"fanOut":1,"instability":1,"lcom4":1,"lcom4Boxes":1,"rollupContainer":true,"cohesion":"__falsch__","uphillDependencies":1}).success).toBe(false);
  });
  it("cohesion: lehnt ab ohne internal", () => {
    expect(S.safeParse({"moduleId":"beispiel","moduleName":"beispiel","allocatedFuncs":1,"fanIn":1,"fanOut":1,"instability":1,"lcom4":1,"lcom4Boxes":1,"rollupContainer":true,"cohesion":{"external":1,"ratio":1},"uphillDependencies":1}).success).toBe(false);
  });
  it("cohesion: lehnt ab: internal mit falschem Typ", () => {
    expect(S.safeParse({"moduleId":"beispiel","moduleName":"beispiel","allocatedFuncs":1,"fanIn":1,"fanOut":1,"instability":1,"lcom4":1,"lcom4Boxes":1,"rollupContainer":true,"cohesion":{"internal":"__falsch__","external":1,"ratio":1},"uphillDependencies":1}).success).toBe(false);
  });
  it("cohesion: lehnt ab ohne external", () => {
    expect(S.safeParse({"moduleId":"beispiel","moduleName":"beispiel","allocatedFuncs":1,"fanIn":1,"fanOut":1,"instability":1,"lcom4":1,"lcom4Boxes":1,"rollupContainer":true,"cohesion":{"internal":1,"ratio":1},"uphillDependencies":1}).success).toBe(false);
  });
  it("cohesion: lehnt ab: external mit falschem Typ", () => {
    expect(S.safeParse({"moduleId":"beispiel","moduleName":"beispiel","allocatedFuncs":1,"fanIn":1,"fanOut":1,"instability":1,"lcom4":1,"lcom4Boxes":1,"rollupContainer":true,"cohesion":{"internal":1,"external":"__falsch__","ratio":1},"uphillDependencies":1}).success).toBe(false);
  });
  it("cohesion: lehnt ab ohne ratio", () => {
    expect(S.safeParse({"moduleId":"beispiel","moduleName":"beispiel","allocatedFuncs":1,"fanIn":1,"fanOut":1,"instability":1,"lcom4":1,"lcom4Boxes":1,"rollupContainer":true,"cohesion":{"internal":1,"external":1},"uphillDependencies":1}).success).toBe(false);
  });
  it("cohesion: lehnt ab: ratio mit falschem Typ", () => {
    expect(S.safeParse({"moduleId":"beispiel","moduleName":"beispiel","allocatedFuncs":1,"fanIn":1,"fanOut":1,"instability":1,"lcom4":1,"lcom4Boxes":1,"rollupContainer":true,"cohesion":{"internal":1,"external":1,"ratio":"__falsch__"},"uphillDependencies":1}).success).toBe(false);
  });
  it("lehnt ab ohne uphillDependencies", () => {
    expect(S.safeParse({"moduleId":"beispiel","moduleName":"beispiel","allocatedFuncs":1,"fanIn":1,"fanOut":1,"instability":1,"lcom4":1,"lcom4Boxes":1,"rollupContainer":true,"cohesion":{"internal":1,"external":1,"ratio":1}}).success).toBe(false);
  });
  it("lehnt ab: uphillDependencies mit falschem Typ", () => {
    expect(S.safeParse({"moduleId":"beispiel","moduleName":"beispiel","allocatedFuncs":1,"fanIn":1,"fanOut":1,"instability":1,"lcom4":1,"lcom4Boxes":1,"rollupContainer":true,"cohesion":{"internal":1,"external":1,"ratio":1},"uphillDependencies":"__falsch__"}).success).toBe(false);
  });
});
