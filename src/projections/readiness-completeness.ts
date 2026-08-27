/**
 * readiness-completeness.ts — re-export shim (CR-GC-265).
 *
 * The completeness dimension MOVED to `@sigloch/graphcode-client` together with
 * the readiness projection it belongs to (both are pure graph→score functions).
 *
 * This file keeps `./readiness-completeness.js` resolving so src and tests stay
 * untouched. ONE implementation — the client package's.
 *
 * @author andreas@siglochconsulting
 */
export {
  NEUTRAL_COMPLETENESS,
  COMPLETENESS_SLICES,
  scoreCompleteness,
  typeOf,
  type CGraph,
  type CNode,
  type GateCompleteness,
  type CompletenessLeg,
} from '@sigloch/graphcode-client';
