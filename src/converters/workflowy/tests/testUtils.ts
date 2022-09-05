import { WorkflowyConverter } from '..';
import { TanaIntermediateFile, TanaIntermediateNode } from '../../../types/types';
import { importFileAndGetHelpers } from '../../../testUtils/testUtils';

export type IdLookupHelper = (id: string | undefined) => TanaIntermediateNode | undefined;

export type NameLookupHelper = (name: string | undefined) => TanaIntermediateNode | undefined;

export function importWorkflowyFile(fileToLoad: string): [TanaIntermediateFile, IdLookupHelper, NameLookupHelper] {
  return importFileAndGetHelpers(new WorkflowyConverter(), `./src/converters/workflowy/tests/fixtures/${fileToLoad}`);
}
