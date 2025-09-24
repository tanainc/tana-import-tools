import { WorkflowyConverter } from '..';
import { importFileAndGetHelpers } from '../../../testUtils/testUtils.js';
export function importWorkflowyFile(fileToLoad) {
    return importFileAndGetHelpers(new WorkflowyConverter(), `./src/converters/workflowy/tests/fixtures/${fileToLoad}`);
}
