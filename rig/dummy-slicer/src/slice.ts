// MOD-slicer / FN-slice — NOT YET REALIZED.
// The milestone is to implement slice() so the recall / determinism / provenance tests pass.
// Definition of done lives in the graph: `graph_context FN-slice`.

export interface DocRecord {
  id: string;
  text: string;
  page: number;
}

export interface Candidate {
  id: string;
  text: string;
  sourceRef: { doc: string; page: number; region: string };
}

export interface SlicerOutput {
  candidates: Candidate[];
}

export function slice(_docs: DocRecord[]): SlicerOutput {
  throw new Error('FN-slice not implemented — implement from graph_context FN-slice');
}
