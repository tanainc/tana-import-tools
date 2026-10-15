import { WorkflowyConverter } from '..';
import { SourceGraph, SourceNode } from '../../sourceGraph.js';
import { importFileAndGetHelpers } from '../../../testUtils/testUtils.js';

export type IdLookupHelper = (_id: string | undefined) => SourceNode | undefined;

export type NameLookupHelper = (_name: string | undefined) => SourceNode | undefined;

export function importWorkflowyFile(fileToLoad: string): [SourceGraph, IdLookupHelper, NameLookupHelper] {
  return importFileAndGetHelpers(new WorkflowyConverter(), `./src/converters/workflowy/tests/fixtures/${fileToLoad}`);
}
