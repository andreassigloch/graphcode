// erzeugt aus dem Modell (graphanalyze/werkzeuge/vertragstest) — SCHEMA-init-report → src/surface/init-verb.ts#InitReportSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { InitReportSchema as S } from '../../src/surface/init-verb.js';

describe('Vertrag SCHEMA-init-report', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]})).toEqual({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]});
  });
  it("lehnt ab ohne result", () => {
    expect(S.safeParse({"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: result mit falschem Typ", () => {
    expect(S.safeParse({"result":"__falsch__","installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab ohne installCommand", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installOk":true,"installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: installCommand mit falschem Typ", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":12345,"installOk":true,"installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab ohne installOk", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: installOk mit falschem Typ", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":"__falsch__","installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab ohne installError", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: installError mit falschem Typ", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":12345,"agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab ohne agentHosts", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: agentHosts mit falschem Typ", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":"__falsch__"}).success).toBe(false);
  });
});
