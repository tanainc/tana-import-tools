import { TanaIntermediateFile } from '../types/types';

export interface IConverterOptions {
  fileExtension: string;
}

export interface IConverter {
  convert(fileContent: string, options?: IConverterOptions): TanaIntermediateFile | undefined;
}
