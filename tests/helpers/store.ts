/**
 * The one place in tests/ that names the store package.
 *
 * Before this file existed, `KuzuAdapter` was imported straight from its package in 66 test
 * files. That made every package-level move — merge, rename, adapter swap — a 66-file change
 * rather than a one-line change, which is why the substrate restructure (CR-SM-248) looked
 * more expensive than it is. Tests import the store from here; the package name lives here.
 */
export { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
