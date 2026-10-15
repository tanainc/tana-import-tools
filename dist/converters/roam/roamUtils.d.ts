import { SourceNode } from '../sourceGraph.js';
export declare function isTodo(name: string): boolean;
export declare function isDone(name: string): boolean;
export declare function setNodeAsTodo(node: SourceNode): void;
export declare function setNodeAsDone(node: SourceNode): void;
export declare function replaceRoamSyntax(nameToUse: string): string;
