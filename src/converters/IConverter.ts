import { TanaIntermediateFile } from '../types/types';

export interface IConverter {
  convert(fileContent: string): TanaIntermediateFile | undefined;
}
