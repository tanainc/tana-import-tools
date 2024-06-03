import { TanaIntermediateNode } from '../../types/types.js';
import { LogseqBlock } from './types.js';

// TODO and DONE in roam
const TODO_FLAG = 'TODO';
const DONE_FLAG = 'DONE';

export function isTodo(name: string) {
  return name.substring(0, TODO_FLAG.length) === TODO_FLAG;
}

export function isDone(name: string) {
  return name.substring(0, DONE_FLAG.length) === DONE_FLAG;
}

export function setNodeAsTodo(node: TanaIntermediateNode) {
  node.name = node.name.substring(TODO_FLAG.length);
  node.todoState = 'todo';
}
export function setNodeAsDone(node: TanaIntermediateNode) {
  node.name = node.name.substring(DONE_FLAG.length);
  node.todoState = 'done';
}

export function replaceLogseqSyntax(nameToUse: string) {
  if (nameToUse.includes('{{embed')) {
    // Replace {embed:((id))} with ((id))
    nameToUse = nameToUse.replace(/\{\{embed\s?\(\((.+)\)\)\}\}/, function (match, contents) {
      return `((${contents}))`;
    });
    // Replace {embed:[[name]]} with [[name]]
    nameToUse = nameToUse.replace(/\{\{embed\s?\[\[(.+)\]\]\}\}/, function (match, contents) {
      return `[[${contents}]]`;
    });
  }
  return nameToUse;
}

export function hasDuplicateProperties(parent?: LogseqBlock, child?: LogseqBlock) {
  if (!parent || !child) {
    return false;
  }

  return JSON.stringify(parent.properties) === JSON.stringify(child.properties);
}
