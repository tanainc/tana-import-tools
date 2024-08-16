import { TanaIntermediateFile } from '../../types/types.js';
export declare class WorkflowyConverter {
    private nodesForImport;
    private summary;
    convert(fileContent: string): TanaIntermediateFile | undefined;
    private createTanaNode;
}
