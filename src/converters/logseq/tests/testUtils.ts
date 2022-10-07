import { LogseqConverter } from '..';
import { importFileAndGetHelpers } from '../../../testUtils/testUtils';

export function importLogseqFile(fileToLoad: string) {
  return importFileAndGetHelpers(new LogseqConverter(), `./src/converters/logseq/tests/fixtures/${fileToLoad}`);
}
