import { RoamConverter } from '..';
import { importFileAndGetHelpers } from '../../../testUtils/testUtils';

export function importRoamFile(fileToLoad: string) {
  return importFileAndGetHelpers(new RoamConverter(), `./src/converters/roam/tests/fixtures/${fileToLoad}`);
}
