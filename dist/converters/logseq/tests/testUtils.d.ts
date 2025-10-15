import type { TanaIntermediateNode } from '../../../types/types.ts';
import { IdLookupHelper } from '../../../testUtils/testUtils.js';
export declare function importLogseqFile(fileToLoad: string): [import("../../../types/types.ts").TanaIntermediateFile, IdLookupHelper, import("../../../testUtils/testUtils.js").NameLookupHelper];
export declare function getField(parentId: string | undefined, title: string, f: IdLookupHelper): TanaIntermediateNode;
export declare function hasHeadingField(node: TanaIntermediateNode): boolean;
