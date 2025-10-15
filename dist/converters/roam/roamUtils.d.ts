import { TanaIntermediateNode } from '../../types/types.js';
export declare function isTodo(name: string): boolean;
export declare function isDone(name: string): boolean;
export declare function setNodeAsTodo(node: TanaIntermediateNode): void;
export declare function setNodeAsDone(node: TanaIntermediateNode): void;
export declare function replaceRoamSyntax(nameToUse: string): string;
