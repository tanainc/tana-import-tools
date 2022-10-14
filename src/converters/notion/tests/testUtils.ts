import { NotionConverter } from '..';
import { importFileAndGetHelpers } from '../../../testUtils/testUtils';

export function importNotionFile(fileToLoad: string) {
  return importFileAndGetHelpers(new NotionConverter(), `./src/converters/notion/tests/fixtures/${fileToLoad}`);
}
