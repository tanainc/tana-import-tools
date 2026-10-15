import type { TanaIntermediateFile } from '../../types/types.js';
import { SourceGraph } from '../sourceGraph.js';
export declare class WorkflowyConverter {
    private nodesForImport;
    private summary;
    convert(fileContent: string): TanaIntermediateFile | undefined;
    parse(fileContent: string): SourceGraph | undefined;
    private createTanaNode;
}
