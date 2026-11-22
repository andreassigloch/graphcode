// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-health-report → src/surface/health.ts#HealthPayloadSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { HealthPayloadSchema as S } from '../../src/surface/health.js';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-health-report', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0})).toEqual({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne status", () => {
    expect(S.safeParse({"store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0}).success).toBe(false);
  });
  it("lehnt ab: status mit falschem Typ", () => {
    expect(S.safeParse({"status":12345,"store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0}).success).toBe(false);
  });
  it("lehnt ab: status außerhalb des Enums", () => {
    expect(S.safeParse({"status":"__ausserhalb__","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0}).success).toBe(false);
  });
  it("status: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","status"]])._zod.def.entries as Record<string, unknown>)).toEqual(["ok","degraded"]);
  });
  it("lehnt ab ohne store", () => {
    expect(S.safeParse({"status":"ok","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0}).success).toBe(false);
  });
  it("lehnt ab: store mit falschem Typ", () => {
    expect(S.safeParse({"status":"ok","store":12345,"gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0}).success).toBe(false);
  });
  it("lehnt ab: store außerhalb des Enums", () => {
    expect(S.safeParse({"status":"ok","store":"__ausserhalb__","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0}).success).toBe(false);
  });
  it("store: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","store"]])._zod.def.entries as Record<string, unknown>)).toEqual(["reachable","unreachable"]);
  });
  it("lehnt ab ohne gate", () => {
    expect(S.safeParse({"status":"ok","store":"reachable","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0}).success).toBe(false);
  });
  it("lehnt ab: gate mit falschem Typ", () => {
    expect(S.safeParse({"status":"ok","store":"reachable","gate":12345,"nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0}).success).toBe(false);
  });
  it("lehnt ab: gate außerhalb des Enums", () => {
    expect(S.safeParse({"status":"ok","store":"reachable","gate":"__ausserhalb__","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0}).success).toBe(false);
  });
  it("gate: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","gate"]])._zod.def.entries as Record<string, unknown>)).toEqual(["functional","broken"]);
  });
  it("lehnt ab ohne nodeCount", () => {
    expect(S.safeParse({"status":"ok","store":"reachable","gate":"functional","versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0}).success).toBe(false);
  });
  it("lehnt ab: nodeCount mit falschem Typ", () => {
    expect(S.safeParse({"status":"ok","store":"reachable","gate":"functional","nodeCount":"__falsch__","versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0}).success).toBe(false);
  });
  it("nodeCount: lehnt ab: -1 unter der Untergrenze 0", () => {
    expect(S.safeParse({"status":"ok","store":"reachable","gate":"functional","nodeCount":-1,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0}).success).toBe(false);
  });
  it("nodeCount: nimmt 0 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0})).toEqual({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0});
  });
  it("nodeCount: lehnt ab: 0.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"status":"ok","store":"reachable","gate":"functional","nodeCount":0.5,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0}).success).toBe(false);
  });
  it("lehnt ab ohne versions", () => {
    expect(S.safeParse({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"sseClients":0}).success).toBe(false);
  });
  it("lehnt ab: versions mit falschem Typ", () => {
    expect(S.safeParse({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":"__falsch__","sseClients":0}).success).toBe(false);
  });
  it("versions: lehnt ab ohne ontology", () => {
    expect(S.safeParse({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0}).success).toBe(false);
  });
  it("versions: lehnt ab: ontology mit falschem Typ", () => {
    expect(S.safeParse({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":12345,"rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0}).success).toBe(false);
  });
  it("versions.ontology: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"","rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0})).toEqual({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"","rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0});
  });
  it("versions: lehnt ab ohne rules", () => {
    expect(S.safeParse({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0}).success).toBe(false);
  });
  it("versions: lehnt ab: rules mit falschem Typ", () => {
    expect(S.safeParse({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":12345,"metaModel":"beispiel","ruleCount":0},"sseClients":0}).success).toBe(false);
  });
  it("versions.rules: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"","metaModel":"beispiel","ruleCount":0},"sseClients":0})).toEqual({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"","metaModel":"beispiel","ruleCount":0},"sseClients":0});
  });
  it("versions: lehnt ab ohne metaModel", () => {
    expect(S.safeParse({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","ruleCount":0},"sseClients":0}).success).toBe(false);
  });
  it("versions: lehnt ab: metaModel mit falschem Typ", () => {
    expect(S.safeParse({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":12345,"ruleCount":0},"sseClients":0}).success).toBe(false);
  });
  it("versions.metaModel: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"","ruleCount":0},"sseClients":0})).toEqual({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"","ruleCount":0},"sseClients":0});
  });
  it("versions: lehnt ab ohne ruleCount", () => {
    expect(S.safeParse({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel"},"sseClients":0}).success).toBe(false);
  });
  it("versions: lehnt ab: ruleCount mit falschem Typ", () => {
    expect(S.safeParse({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":"__falsch__"},"sseClients":0}).success).toBe(false);
  });
  it("versions.ruleCount: lehnt ab: -1 unter der Untergrenze 0", () => {
    expect(S.safeParse({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":-1},"sseClients":0}).success).toBe(false);
  });
  it("versions.ruleCount: nimmt 0 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0})).toEqual({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0});
  });
  it("versions.ruleCount: lehnt ab: 0.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":0.5},"sseClients":0}).success).toBe(false);
  });
  it("lehnt ab ohne sseClients", () => {
    expect(S.safeParse({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":0}}).success).toBe(false);
  });
  it("lehnt ab: sseClients mit falschem Typ", () => {
    expect(S.safeParse({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":"__falsch__"}).success).toBe(false);
  });
  it("sseClients: lehnt ab: -1 unter der Untergrenze 0", () => {
    expect(S.safeParse({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":-1}).success).toBe(false);
  });
  it("sseClients: nimmt 0 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0})).toEqual({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0});
  });
  it("sseClients: lehnt ab: 0.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"status":"ok","store":"reachable","gate":"functional","nodeCount":0,"versions":{"ontology":"beispiel","rules":"beispiel","metaModel":"beispiel","ruleCount":0},"sseClients":0.5}).success).toBe(false);
  });
});
