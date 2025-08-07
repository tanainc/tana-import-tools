import { WorkflowyConverter } from '..';
import { TanaIntermediateFile, TanaIntermediateNode } from '../../../types/types.js';
import { importFileAndGetHelpers } from '../../../testUtils/testUtils.js';

export type IdLookupHelper = (_id: string | undefined) => TanaIntermediateNode | undefined;

export type NameLookupHelper = (_name: string | undefined) => TanaIntermediateNode | undefined;

export function importWorkflowyFile(fileToLoad: string): [TanaIntermediateFile, IdLookupHelper, NameLookupHelper] {
  return importFileAndGetHelpers(new WorkflowyConverter(), `./src/converters/workflowy/tests/fixtures/${fileToLoad}`);
}
