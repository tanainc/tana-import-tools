import type { TanaIntermediateFile } from '../types/types.js';
import { SourceGraph } from '../converters/sourceGraph.js';

export interface IConverter {
  convert(fileContent: string): TanaIntermediateFile | undefined;
  parse(fileContent: string): SourceGraph | undefined;
}
