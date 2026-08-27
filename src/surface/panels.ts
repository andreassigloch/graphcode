/**
 * MOD-dashboard — re-export shim (CR-GC-265).
 *
 * The panel data-layer MOVED to `@sigloch/graphcode-client`. It is pure
 * projection — plain data in, view-models out — and a renderer needs it without
 * needing the substrate. Importing it from here used to drag kuzu-wasm, the MCP
 * SDK and the TypeScript compiler into a viewer that is structurally forbidden
 * from opening a store.
 *
 * This file keeps the internal import path (`./viewer/panels.js`) resolving so
 * src and tests stay untouched. There is ONE implementation — the client
 * package's — and no copy behind this door.
 *
 * @author andreas@siglochconsulting
 */
export {
  readinessPanel,
  recommendationsPanel,
  ARTIFACT_CATALOG,
  artifactFreshness,
  analysisFreshness,
  artifactsPanel,
  creationCurrencyProvider,
  impactPanel,
  healthPanel,
  panelsForEvent,
  type GatePanel,
  type ReadinessPanel,
  type RecommendationItem,
  type RecommendationsPanel,
  type Freshness,
  type ArtifactKind,
  type ArtifactGroup,
  type ArtifactCatalogEntry,
  type ArtifactStatus,
  type ArtifactSignal,
  type ArtifactsPanel,
  type ImpactPanel,
  type HealthPanel,
} from '@sigloch/graphcode-client';
