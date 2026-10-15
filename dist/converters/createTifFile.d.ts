import type { TanaIntermediateFile } from '../types/types.js';
import type { SourceGraph } from './sourceGraph.js';
/** Writes resolved source content as declarations and explicit references. */
export declare function createTifFile(graph: SourceGraph): TanaIntermediateFile;
