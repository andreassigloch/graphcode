// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-repo-status → src/surface/status.ts#RepoStatusSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { RepoStatusSchema as S } from '../../src/surface/status.js';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-repo-status', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}})).toEqual({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne repoRoot", () => {
    expect(S.safeParse({"member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("lehnt ab: repoRoot mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":12345,"member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("repoRoot: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}})).toEqual({"repoRoot":"","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}});
  });
  it("lehnt ab ohne member", () => {
    expect(S.safeParse({"repoRoot":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("lehnt ab: member mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":12345,"host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("member: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}})).toEqual({"repoRoot":"beispiel","member":"","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}});
  });
  it("lehnt ab ohne host", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("lehnt ab: host mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":"__falsch__","dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("host: lehnt ab ohne state", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("host: lehnt ab: state mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":12345,"pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("host: lehnt ab: state außerhalb des Enums", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"__ausserhalb__","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("host.state: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","host"],["shape","state"]])._zod.def.entries as Record<string, unknown>)).toEqual(["running","stale","none"]);
  });
  it("host: nimmt an ohne pid (optional)", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}})).toEqual({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}});
  });
  it("host: lehnt ab: pid mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":"__falsch__","hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("host: nimmt an ohne hostname (optional)", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}})).toEqual({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}});
  });
  it("host: lehnt ab: hostname mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":12345,"startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("host.hostname: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}})).toEqual({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}});
  });
  it("host: nimmt an ohne startedAt (optional)", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}})).toEqual({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}});
  });
  it("host: lehnt ab: startedAt mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":12345,"version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("host.startedAt: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}})).toEqual({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}});
  });
  it("host: nimmt an ohne version (optional)", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}})).toEqual({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}});
  });
  it("host: lehnt ab: version mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":12345,"boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("host.version: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}})).toEqual({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}});
  });
  it("host: nimmt an ohne boot (optional)", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel"},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}})).toEqual({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel"},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}});
  });
  it("host: lehnt ab: boot mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":"__falsch__"},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("host.boot: lehnt ab ohne codeRoot", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("host.boot: lehnt ab: codeRoot mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":12345,"codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("host.boot.codeRoot: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("host.boot.codeRoot: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"x","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}})).toEqual({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"x","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}});
  });
  it("host.boot: lehnt ab ohne codeMtimeMs", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("host.boot: lehnt ab: codeMtimeMs mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":"__falsch__","contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("host.boot: nimmt an ohne contracts (optional)", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}})).toEqual({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}});
  });
  it("host.boot: lehnt ab: contracts mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":12345}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("host.boot.contracts: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":""}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}})).toEqual({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":""}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}});
  });
  it("lehnt ab ohne dashboard", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("lehnt ab: dashboard mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":"__falsch__","version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("dashboard: lehnt ab ohne state", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("dashboard: lehnt ab: state mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":12345,"url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("dashboard: lehnt ab: state außerhalb des Enums", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"__ausserhalb__","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("dashboard.state: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","dashboard"],["shape","state"]])._zod.def.entries as Record<string, unknown>)).toEqual(["running","foreign","unidentified","unresponsive","not-running"]);
  });
  it("dashboard: nimmt an ohne url (optional)", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}})).toEqual({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}});
  });
  it("dashboard: lehnt ab: url mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":12345,"pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("dashboard.url: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}})).toEqual({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}});
  });
  it("dashboard: nimmt an ohne pid (optional)", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}})).toEqual({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}});
  });
  it("dashboard: lehnt ab: pid mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":"__falsch__","servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("dashboard: nimmt an ohne servedRepo (optional)", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}})).toEqual({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}});
  });
  it("dashboard: lehnt ab: servedRepo mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":12345},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("dashboard.servedRepo: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":""},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}})).toEqual({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":""},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}});
  });
  it("lehnt ab ohne version", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"}}).success).toBe(false);
  });
  it("lehnt ab: version mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":"__falsch__"}).success).toBe(false);
  });
  it("version: lehnt ab ohne cli", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("version: lehnt ab: cli mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":12345,"host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("version.cli: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}})).toEqual({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}});
  });
  it("version: nimmt an ohne host (optional)", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}})).toEqual({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}});
  });
  it("version: lehnt ab: host mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":12345,"repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("version.host: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}})).toEqual({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}});
  });
  it("version: nimmt an ohne repo (optional)", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","start":"repo","state":"ok","action":"beispiel"}})).toEqual({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","start":"repo","state":"ok","action":"beispiel"}});
  });
  it("version: lehnt ab: repo mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":12345,"start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("version.repo: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"","start":"repo","state":"ok","action":"beispiel"}})).toEqual({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"","start":"repo","state":"ok","action":"beispiel"}});
  });
  it("version: nimmt an ohne start (optional)", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","state":"ok","action":"beispiel"}})).toEqual({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","state":"ok","action":"beispiel"}});
  });
  it("version: lehnt ab: start mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":12345,"state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("version: lehnt ab: start außerhalb des Enums", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"__ausserhalb__","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("version.start: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","version"],["shape","start"],["innerType"]])._zod.def.entries as Record<string, unknown>)).toEqual(["repo","npx"]);
  });
  it("version: lehnt ab ohne state", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","action":"beispiel"}}).success).toBe(false);
  });
  it("version: lehnt ab: state mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":12345,"action":"beispiel"}}).success).toBe(false);
  });
  it("version: lehnt ab: state außerhalb des Enums", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"__ausserhalb__","action":"beispiel"}}).success).toBe(false);
  });
  it("version.state: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","version"],["shape","state"]])._zod.def.entries as Record<string, unknown>)).toEqual(["ok","drift","host-unknown"]);
  });
  it("version: nimmt an ohne action (optional)", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok"}})).toEqual({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok"}});
  });
  it("version: lehnt ab: action mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":12345}}).success).toBe(false);
  });
  it("version.action: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":""}})).toEqual({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":""}});
  });
});
