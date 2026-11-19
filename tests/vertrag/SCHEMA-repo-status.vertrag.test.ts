// erzeugt aus dem Modell (graphanalyze/werkzeuge/vertragstest) — SCHEMA-repo-status → src/surface/status.ts#RepoStatusSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { RepoStatusSchema as S } from '../../src/surface/status.js';

describe('Vertrag SCHEMA-repo-status', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}})).toEqual({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}});
  });
  it("lehnt ab ohne repoRoot", () => {
    expect(S.safeParse({"member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("lehnt ab: repoRoot mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":12345,"member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("lehnt ab ohne member", () => {
    expect(S.safeParse({"repoRoot":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("lehnt ab: member mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":12345,"host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("lehnt ab ohne host", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("lehnt ab: host mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":"__falsch__","dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("lehnt ab ohne dashboard", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("lehnt ab: dashboard mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":"__falsch__","version":{"cli":"beispiel","host":"beispiel","repo":"beispiel","start":"repo","state":"ok","action":"beispiel"}}).success).toBe(false);
  });
  it("lehnt ab ohne version", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"}}).success).toBe(false);
  });
  it("lehnt ab: version mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","member":"beispiel","host":{"state":"running","pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}},"dashboard":{"state":"running","url":"beispiel","pid":1,"servedRepo":"beispiel"},"version":"__falsch__"}).success).toBe(false);
  });
});
