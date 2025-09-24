import { TanaIntermediateNode, TanaIntermediateFile } from '../types/types.js';
import { IConverter } from '../converters/IConverter.js';
export type IdLookupHelper = (id: string | undefined) => TanaIntermediateNode | undefined;
export type NameLookupHelper = (name: string | undefined) => TanaIntermediateNode | undefined;
export declare function importFileAndGetHelpers(importer: IConverter, fileToLoad: string): [TanaIntermediateFile, IdLookupHelper, NameLookupHelper];
export declare function expectField(id: string | undefined, title: string, values: (string | TanaIntermediateNode)[], f: IdLookupHelper): void;
export declare function expectImage(id: string | undefined, url: string, f: IdLookupHelper): void;
