import { SourceNode } from '../sourceGraph.js';
import { LogseqBlock } from './types.js';
export declare function isTodo(name: string): boolean;
export declare function isDone(name: string): boolean;
export declare function setNodeAsTodo(node: SourceNode): void;
export declare function setNodeAsDone(node: SourceNode): void;
export declare function replaceLogseqSyntax(nameToUse: string): string;
export declare function hasDuplicateProperties(parent?: LogseqBlock, child?: LogseqBlock): boolean;
