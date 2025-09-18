import { TanaIntermediateFile, TanaIntermediateNode } from '../../../types/types.js';
export type IdLookupHelper = (_id: string | undefined) => TanaIntermediateNode | undefined;
export type NameLookupHelper = (_name: string | undefined) => TanaIntermediateNode | undefined;
export declare function importWorkflowyFile(fileToLoad: string): [TanaIntermediateFile, IdLookupHelper, NameLookupHelper];
