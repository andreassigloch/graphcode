// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-steering-delta → src/kernel/measure/steering-snapshot.ts#SteeringDelta. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { SteeringDelta as S } from '../../src/kernel/measure/steering-snapshot.js';

describe('Vertrag SCHEMA-steering-delta', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"blockingErrors":{"before":1,"after":1},"stages":{"beispiel":{"before":1,"after":1,"delta":1}}})).toEqual({"blockingErrors":{"before":1,"after":1},"stages":{"beispiel":{"before":1,"after":1,"delta":1}}});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne blockingErrors", () => {
    expect(S.safeParse({"stages":{"beispiel":{"before":1,"after":1,"delta":1}}}).success).toBe(false);
  });
  it("lehnt ab: blockingErrors mit falschem Typ", () => {
    expect(S.safeParse({"blockingErrors":"__falsch__","stages":{"beispiel":{"before":1,"after":1,"delta":1}}}).success).toBe(false);
  });
  it("blockingErrors: lehnt ab ohne before", () => {
    expect(S.safeParse({"blockingErrors":{"after":1},"stages":{"beispiel":{"before":1,"after":1,"delta":1}}}).success).toBe(false);
  });
  it("blockingErrors: lehnt ab: before mit falschem Typ", () => {
    expect(S.safeParse({"blockingErrors":{"before":"__falsch__","after":1},"stages":{"beispiel":{"before":1,"after":1,"delta":1}}}).success).toBe(false);
  });
  it("blockingErrors: lehnt ab ohne after", () => {
    expect(S.safeParse({"blockingErrors":{"before":1},"stages":{"beispiel":{"before":1,"after":1,"delta":1}}}).success).toBe(false);
  });
  it("blockingErrors: lehnt ab: after mit falschem Typ", () => {
    expect(S.safeParse({"blockingErrors":{"before":1,"after":"__falsch__"},"stages":{"beispiel":{"before":1,"after":1,"delta":1}}}).success).toBe(false);
  });
  it("lehnt ab ohne stages", () => {
    expect(S.safeParse({"blockingErrors":{"before":1,"after":1}}).success).toBe(false);
  });
  it("lehnt ab: stages mit falschem Typ", () => {
    expect(S.safeParse({"blockingErrors":{"before":1,"after":1},"stages":"__falsch__"}).success).toBe(false);
  });
  it("stages: nimmt einen leeren Record an", () => {
    expect(S.parse({"blockingErrors":{"before":1,"after":1},"stages":{}})).toEqual({"blockingErrors":{"before":1,"after":1},"stages":{}});
  });
  it("stages{}: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"blockingErrors":{"before":1,"after":1},"stages":{"beispiel":"__falsch__"}}).success).toBe(false);
  });
  it("stages{}: lehnt ab ohne before", () => {
    expect(S.safeParse({"blockingErrors":{"before":1,"after":1},"stages":{"beispiel":{"after":1,"delta":1}}}).success).toBe(false);
  });
  it("stages{}: lehnt ab: before mit falschem Typ", () => {
    expect(S.safeParse({"blockingErrors":{"before":1,"after":1},"stages":{"beispiel":{"before":"__falsch__","after":1,"delta":1}}}).success).toBe(false);
  });
  it("stages{}: lehnt ab ohne after", () => {
    expect(S.safeParse({"blockingErrors":{"before":1,"after":1},"stages":{"beispiel":{"before":1,"delta":1}}}).success).toBe(false);
  });
  it("stages{}: lehnt ab: after mit falschem Typ", () => {
    expect(S.safeParse({"blockingErrors":{"before":1,"after":1},"stages":{"beispiel":{"before":1,"after":"__falsch__","delta":1}}}).success).toBe(false);
  });
  it("stages{}: lehnt ab ohne delta", () => {
    expect(S.safeParse({"blockingErrors":{"before":1,"after":1},"stages":{"beispiel":{"before":1,"after":1}}}).success).toBe(false);
  });
  it("stages{}: lehnt ab: delta mit falschem Typ", () => {
    expect(S.safeParse({"blockingErrors":{"before":1,"after":1},"stages":{"beispiel":{"before":1,"after":1,"delta":"__falsch__"}}}).success).toBe(false);
  });
});
