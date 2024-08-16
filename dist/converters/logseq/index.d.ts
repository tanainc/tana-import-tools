import { TanaIntermediateFile } from '../../types/types.js';
import { IConverter } from '../IConverter.js';
export declare class LogseqConverter implements IConverter {
    private nodesForImport;
    private originalNodeNames;
    private attrMap;
    private topLevelMap;
    private summary;
    convert(fileContent: string): TanaIntermediateFile | undefined;
    private extractMetaNodeContentAndGetNumRemaningChildren;
    private convertToField;
    private createNodeForImport;
    private logseqToIntermediate;
    private normalizeLinksAndSetAliases;
    private fixBrokenLinks;
    private ensureAttrMapIsUpdated;
    private findRefByName;
}
