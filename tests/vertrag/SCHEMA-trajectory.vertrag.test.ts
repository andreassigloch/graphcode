// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-trajectory → packages/learning-core/src/interfaces/trajectory.ts#TrajectorySchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { TrajectorySchema as S } from '@sigloch/learning-core/interfaces';

describe('Vertrag SCHEMA-trajectory', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"ts":"beispiel","consumerId":"beispiel","consumerType":"frontend","operation":"mutate","opCounts":0,"applied":true,"outcome":"applied","violations":{"error":0,"warning":0,"info":0},"graphVersion":0})).toEqual({"ts":"beispiel","consumerId":"beispiel","consumerType":"frontend","operation":"mutate","opCounts":0,"applied":true,"outcome":"applied","violations":{"error":0,"warning":0,"info":0},"graphVersion":0});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne ts", () => {
    expect(S.safeParse({"consumerId":"beispiel","consumerType":"frontend","operation":"mutate","opCounts":0,"applied":true,"outcome":"applied","violations":{"error":0,"warning":0,"info":0},"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab: ts mit falschem Typ", () => {
    expect(S.safeParse({"ts":12345,"consumerId":"beispiel","consumerType":"frontend","operation":"mutate","opCounts":0,"applied":true,"outcome":"applied","violations":{"error":0,"warning":0,"info":0},"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab ohne consumerId", () => {
    expect(S.safeParse({"ts":"beispiel","consumerType":"frontend","operation":"mutate","opCounts":0,"applied":true,"outcome":"applied","violations":{"error":0,"warning":0,"info":0},"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab: consumerId mit falschem Typ", () => {
    expect(S.safeParse({"ts":"beispiel","consumerId":12345,"consumerType":"frontend","operation":"mutate","opCounts":0,"applied":true,"outcome":"applied","violations":{"error":0,"warning":0,"info":0},"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab ohne consumerType", () => {
    expect(S.safeParse({"ts":"beispiel","consumerId":"beispiel","operation":"mutate","opCounts":0,"applied":true,"outcome":"applied","violations":{"error":0,"warning":0,"info":0},"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab: consumerType mit falschem Typ", () => {
    expect(S.safeParse({"ts":"beispiel","consumerId":"beispiel","consumerType":12345,"operation":"mutate","opCounts":0,"applied":true,"outcome":"applied","violations":{"error":0,"warning":0,"info":0},"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab: consumerType außerhalb des Enums", () => {
    expect(S.safeParse({"ts":"beispiel","consumerId":"beispiel","consumerType":"__ausserhalb__","operation":"mutate","opCounts":0,"applied":true,"outcome":"applied","violations":{"error":0,"warning":0,"info":0},"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab ohne operation", () => {
    expect(S.safeParse({"ts":"beispiel","consumerId":"beispiel","consumerType":"frontend","opCounts":0,"applied":true,"outcome":"applied","violations":{"error":0,"warning":0,"info":0},"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab: operation mit falschem Typ", () => {
    expect(S.safeParse({"ts":"beispiel","consumerId":"beispiel","consumerType":"frontend","operation":12345,"opCounts":0,"applied":true,"outcome":"applied","violations":{"error":0,"warning":0,"info":0},"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab: operation außerhalb des Enums", () => {
    expect(S.safeParse({"ts":"beispiel","consumerId":"beispiel","consumerType":"frontend","operation":"__ausserhalb__","opCounts":0,"applied":true,"outcome":"applied","violations":{"error":0,"warning":0,"info":0},"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab ohne opCounts", () => {
    expect(S.safeParse({"ts":"beispiel","consumerId":"beispiel","consumerType":"frontend","operation":"mutate","applied":true,"outcome":"applied","violations":{"error":0,"warning":0,"info":0},"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab: opCounts mit falschem Typ", () => {
    expect(S.safeParse({"ts":"beispiel","consumerId":"beispiel","consumerType":"frontend","operation":"mutate","opCounts":"__falsch__","applied":true,"outcome":"applied","violations":{"error":0,"warning":0,"info":0},"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab ohne applied", () => {
    expect(S.safeParse({"ts":"beispiel","consumerId":"beispiel","consumerType":"frontend","operation":"mutate","opCounts":0,"outcome":"applied","violations":{"error":0,"warning":0,"info":0},"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab: applied mit falschem Typ", () => {
    expect(S.safeParse({"ts":"beispiel","consumerId":"beispiel","consumerType":"frontend","operation":"mutate","opCounts":0,"applied":"__falsch__","outcome":"applied","violations":{"error":0,"warning":0,"info":0},"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab ohne outcome", () => {
    expect(S.safeParse({"ts":"beispiel","consumerId":"beispiel","consumerType":"frontend","operation":"mutate","opCounts":0,"applied":true,"violations":{"error":0,"warning":0,"info":0},"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab: outcome mit falschem Typ", () => {
    expect(S.safeParse({"ts":"beispiel","consumerId":"beispiel","consumerType":"frontend","operation":"mutate","opCounts":0,"applied":true,"outcome":12345,"violations":{"error":0,"warning":0,"info":0},"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab: outcome außerhalb des Enums", () => {
    expect(S.safeParse({"ts":"beispiel","consumerId":"beispiel","consumerType":"frontend","operation":"mutate","opCounts":0,"applied":true,"outcome":"__ausserhalb__","violations":{"error":0,"warning":0,"info":0},"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab ohne violations", () => {
    expect(S.safeParse({"ts":"beispiel","consumerId":"beispiel","consumerType":"frontend","operation":"mutate","opCounts":0,"applied":true,"outcome":"applied","graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab: violations mit falschem Typ", () => {
    expect(S.safeParse({"ts":"beispiel","consumerId":"beispiel","consumerType":"frontend","operation":"mutate","opCounts":0,"applied":true,"outcome":"applied","violations":"__falsch__","graphVersion":0}).success).toBe(false);
  });
  it("violations: lehnt ab ohne error", () => {
    expect(S.safeParse({"ts":"beispiel","consumerId":"beispiel","consumerType":"frontend","operation":"mutate","opCounts":0,"applied":true,"outcome":"applied","violations":{"warning":0,"info":0},"graphVersion":0}).success).toBe(false);
  });
  it("violations: lehnt ab: error mit falschem Typ", () => {
    expect(S.safeParse({"ts":"beispiel","consumerId":"beispiel","consumerType":"frontend","operation":"mutate","opCounts":0,"applied":true,"outcome":"applied","violations":{"error":"__falsch__","warning":0,"info":0},"graphVersion":0}).success).toBe(false);
  });
  it("violations: lehnt ab ohne warning", () => {
    expect(S.safeParse({"ts":"beispiel","consumerId":"beispiel","consumerType":"frontend","operation":"mutate","opCounts":0,"applied":true,"outcome":"applied","violations":{"error":0,"info":0},"graphVersion":0}).success).toBe(false);
  });
  it("violations: lehnt ab: warning mit falschem Typ", () => {
    expect(S.safeParse({"ts":"beispiel","consumerId":"beispiel","consumerType":"frontend","operation":"mutate","opCounts":0,"applied":true,"outcome":"applied","violations":{"error":0,"warning":"__falsch__","info":0},"graphVersion":0}).success).toBe(false);
  });
  it("violations: lehnt ab ohne info", () => {
    expect(S.safeParse({"ts":"beispiel","consumerId":"beispiel","consumerType":"frontend","operation":"mutate","opCounts":0,"applied":true,"outcome":"applied","violations":{"error":0,"warning":0},"graphVersion":0}).success).toBe(false);
  });
  it("violations: lehnt ab: info mit falschem Typ", () => {
    expect(S.safeParse({"ts":"beispiel","consumerId":"beispiel","consumerType":"frontend","operation":"mutate","opCounts":0,"applied":true,"outcome":"applied","violations":{"error":0,"warning":0,"info":"__falsch__"},"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab ohne graphVersion", () => {
    expect(S.safeParse({"ts":"beispiel","consumerId":"beispiel","consumerType":"frontend","operation":"mutate","opCounts":0,"applied":true,"outcome":"applied","violations":{"error":0,"warning":0,"info":0}}).success).toBe(false);
  });
  it("lehnt ab: graphVersion mit falschem Typ", () => {
    expect(S.safeParse({"ts":"beispiel","consumerId":"beispiel","consumerType":"frontend","operation":"mutate","opCounts":0,"applied":true,"outcome":"applied","violations":{"error":0,"warning":0,"info":0},"graphVersion":"__falsch__"}).success).toBe(false);
  });
});
