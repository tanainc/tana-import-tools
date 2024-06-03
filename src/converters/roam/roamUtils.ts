import { TanaIntermediateNode } from '../../types/types.js';

// TODO and DONE in roam
const TODO_FLAG = '{{[[TODO]]}} ';
const DONE_FLAG = '{{[[DONE]]}} ';

// some custom variations of TODO and DONE
const TODO_FLAG_ALT = '{{{[[TODO]]}}}} ';
const DONE_FLAG_ALT = '{{{[[DONE]]}}}} ';

export function isTodo(name: string) {
  return name.substring(0, TODO_FLAG.length) === TODO_FLAG || name.substring(0, TODO_FLAG_ALT.length) === TODO_FLAG_ALT;
}

export function isDone(name: string) {
  return name.substring(0, DONE_FLAG.length) === DONE_FLAG || name.substring(0, DONE_FLAG_ALT.length) === DONE_FLAG_ALT;
}

export function setNodeAsTodo(node: TanaIntermediateNode) {
  node.name = node.name.substring(
    node.name.substring(0, TODO_FLAG.length) === TODO_FLAG ? TODO_FLAG.length : TODO_FLAG_ALT.length,
  );
  node.todoState = 'todo';
}
export function setNodeAsDone(node: TanaIntermediateNode) {
  node.name = node.name.substring(
    node.name.substring(0, TODO_FLAG.length) === DONE_FLAG ? DONE_FLAG.length : DONE_FLAG_ALT.length,
  );

  node.todoState = 'done';
}

export function replaceRoamSyntax(nameToUse: string) {
  if (nameToUse.includes('{{embed')) {
    // Replace {embed:((id))} with ((id))
    nameToUse = nameToUse.replace(/\{\{embed:\s?\(\((.+)\)\)\}\}/, function (match, contents) {
      return `((${contents}))`;
    });
    // Replace {embed:[[name]]} with [[name]]
    nameToUse = nameToUse.replace(/\{\{embed:\s?\[\[(.+)\]\]\}\}/, function (match, contents) {
      return `[[${contents}]]`;
    });
  }
  if (nameToUse.includes('{{[[embed')) {
    // Replace {[[embed]]:((id))} with ((id))
    nameToUse = nameToUse.replace(/\{\{\[\[embed\]\]:\s?\(\((.+)\)\)\}\}/, function (match, contents) {
      return `((${contents}))`;
    });
    // Replace {[[embed]]:[[name]]} with [[name]]
    nameToUse = nameToUse.replace(/\{\{\[\[embed\]\]:\s?\[\[(.+)\]\]\}\}/, function (match, contents) {
      return `[[${contents}]]`;
    });
  }
  return nameToUse;
}
