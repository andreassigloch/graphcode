// Job-Set des Spikes (§6) — reale, abgeschlossene Jobs.
// Ground Truth = die Knoten, die der Schluss-Commit tatsächlich verändert hat
// (git-Diff der beiden docs/graph/graphcode.graph.json-Staende), nicht eine Schaetzung.
//
// Gemessen wird auf dem HEUTIGEN Selbstmodell (G=555), nicht auf dem Juni-Snapshot:
// die Snapshots von damals laden unter der aktuellen SE-Ontologie nicht mehr
// (8x `REQ -allocate-> MOD`, heute kein legales TRACE_PATTERN mehr -> Kuzu-Binder-Fehler).
// Seeds und Ground Truth sind uid-stabil und existieren unveraendert im heutigen Graphen.
export const JOBS = [
  {
    name: 'J1 — 1 Knoten, Implementieren (FN-slice, Kalibrierung)',
    fixture: { graph: 'rig/dummy-slicer/model/dummy-slicer.graph.json', systemId: 'dummy-slicer' },
    seeds: ['FN-slice'],
    focusTypes: ['FUNC'],
    groundTruth: ['FN-slice'],
  },
  {
    name: 'J2a — CR-großer Job, Implementieren (CR-GC-114 host-bridge, 4 FUNC)',
    fixture: { graph: 'docs/graph/graphcode.graph.json', systemId: 'graphcode' },
    // Seeds = die relation-Ziele des OFFENEN CR (im Graph vor dem Commit vorhanden).
    seeds: [
      'FUNC-broadcast-diff', 'FUNC-health-endpoint', 'FUNC-own-kuzu-host', 'FUNC-serve-sse',
      'MOD-host-bridge', 'MS-4-mvp2',
      'REQ-mutation-emits-event', 'REQ-readonly-bridge', 'REQ-versioned-broadcast',
    ],
    focusTypes: ['FUNC', 'MOD', 'REQ'],
    groundTruth: [
      'FUNC-broadcast-diff', 'FUNC-health-endpoint', 'FUNC-own-kuzu-host', 'FUNC-serve-sse',
      'MOD-host-bridge',
      'REQ-mutation-emits-event', 'REQ-readonly-bridge', 'REQ-real-health-check',
      'REQ-single-kuzu-owner', 'REQ-versioned-broadcast',
      // CR-GC-383: TEST-real-health-check ist in TEST-readonly-bridge aufgegangen.
      'TEST-readonly-bridge',
    ],
  },
  {
    name: 'J2b — CR-großer Job, Implementieren (CR-GC-115 dashboard, 8 FUNC)',
    fixture: { graph: 'docs/graph/graphcode.graph.json', systemId: 'graphcode' },
    seeds: [
      'FUNC-render-artifacts', 'FUNC-render-graph', 'FUNC-render-health', 'FUNC-render-impact',
      'FUNC-render-impl-gates', 'FUNC-render-readiness', 'FUNC-render-recommendations',
      'FUNC-subscribe-updates', 'MOD-dashboard', 'MS-4-mvp2',
      'REQ-artifact-freshness', 'REQ-dashboard-ontology-sync', 'REQ-dashboard-readonly',
      'REQ-readiness-transparent', 'REQ-real-health-check', 'UC-live-graph-view',
    ],
    focusTypes: ['FUNC', 'MOD', 'REQ'],
    groundTruth: [
      'FUNC-render-artifacts', 'FUNC-render-graph', 'FUNC-render-health', 'FUNC-render-impact',
      'FUNC-render-impl-gates', 'FUNC-render-readiness', 'FUNC-render-recommendations',
      'FUNC-subscribe-updates', 'MOD-dashboard',
      'REQ-artifact-freshness', 'REQ-dashboard-readonly', 'REQ-readiness-transparent',
      // CR-GC-383: die drei Panel-Abnahmen sind zu TEST-dashboard-readonly verschmolzen.
      'TEST-dashboard-readonly',
      'UC-live-graph-view',
    ],
  },
];
