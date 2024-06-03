import { TanaIntermediateFile } from '../types/types.js';

export interface IConverter {
  convert(fileContent: string): TanaIntermediateFile | undefined;
}
