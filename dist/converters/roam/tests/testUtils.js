import { RoamConverter } from '../index.js';
import { importFileAndGetHelpers } from '../../../testUtils/testUtils.js';
export function importRoamFile(fileToLoad) {
    return importFileAndGetHelpers(new RoamConverter(), `./src/converters/roam/tests/fixtures/${fileToLoad}`);
}
