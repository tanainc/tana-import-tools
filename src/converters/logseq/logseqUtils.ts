import { TanaIntermediateNode } from '../../types/types.js';
import { LogseqBlock } from './types.js';

// NOW/LATER is the default in logseq
const TODO_PREFIXES = ['TODO', 'LATER'];
const DONE_FLAG = 'DONE';
const TODO_REGEX = new RegExp(`^(${TODO_PREFIXES.join('|')})\\s*`);

export function isTodo(name: string) {
  for (const prefix of TODO_PREFIXES) {
    if (name.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

export function isDone(name: string) {
  return name.substring(0, DONE_FLAG.length) === DONE_FLAG;
}

export function setNodeAsTodo(node: TanaIntermediateNode) {
  node.name = node.name.replace(TODO_REGEX, '');
  node.todoState = 'todo';
}
export function setNodeAsDone(node: TanaIntermediateNode) {
  node.name = node.name.substring(DONE_FLAG.length + 1);
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
