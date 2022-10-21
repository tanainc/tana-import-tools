import { TanaIntermediateFile, TanaIntermediateNode } from '../../types/types';
import { IConverter, IConverterOptions } from '../IConverter';
import { nodesToTanaFile } from './nodeUtils';
import { csvToTana } from './csv';
import { mdToTana } from './markdown';

export class NotionConverter implements IConverter {
  convert(fileContent: string, { fileExtension }: IConverterOptions): TanaIntermediateFile | undefined {
    let nodes: TanaIntermediateNode[];
    switch (fileExtension) {
      case '.csv': {
        nodes = csvToTana(fileContent);
        break;
      }
      case '.md': {
        nodes = mdToTana(fileContent);
        break;
      }
      default: {
        console.error(`File extention ${fileExtension} not supported :(`);
        return;
      }
    }

    const file = nodesToTanaFile(nodes);

    return file;
  }
}
