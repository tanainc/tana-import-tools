import { TanaIntermediateNode } from '../../types/types';

// TODO and DONE in roam
const TODO_FLAG = '{{[[TODO]]}} ';
const DONE_FLAG = '{{[[DONE]]}} ';

// some custom variations of TODO and DONE
const TODO_FLAG_ALT = '{{{[[TODO]]}}}} ';
const DONE_FLAG_ALT = '{{{[[DONE]]}}}} ';

export function hasField(node: string) {
  return node.includes('::') || node.includes(':*');
}

export function hasImages(name: string) {
  return name.includes('![](https://');
}
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
const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// Convert 'June 1st, 2021' to '06-01-2021' without dealing with timezones etc
export function dateStringToRoamDateUID(str: string) {
  str = str.replace(/(^\w+\s\d{1,2})(\w{2}),(\s\d+)/, '$1$3');
  const pieces = str.split(' ');
  const month = months.indexOf(pieces[0]) + 1;
  return `${month.toString().padStart(2, '0')}-${pieces[1].toString().padStart(2, '0')}-${pieces[2]
    .toString()
    .padStart(4, '0')}`;
}

// Convert 'June 1st, 2021' to 'YYYY-MM-DD' without dealing with timezones etc
export function dateStringToYMD(str: string) {
  str = str.replace(/(^\w+\s\d{1,2})(\w{2}),(\s\d+)/, '$1$3');
  const pieces = str.split(' ');
  const month = months.indexOf(pieces[0]) + 1;
  return `${pieces[2].toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${pieces[1]
    .toString()
    .padStart(2, '0')}`;
}

export function getValueForAttribute(fieldName: string, node: string): string | undefined {
  if (!node.includes('::') && !node.includes(':*')) {
    return undefined;
  }
  for (const line of node.split('\n')) {
    // foo::bar
    if (line.startsWith(`${fieldName}::`)) {
      return line.split(`${fieldName}::`)[1].trim();
    } else if (line.startsWith(`**${fieldName}:**`)) {
      return line.split(`**${fieldName}:**`)[1].trim();
    } else if (line.startsWith(`[[${fieldName}]]:`)) {
      return line.split(`[[${fieldName}]]::`)[1].trim();
    }
  }
}

// Finds attribute defintions like Foo:: and **foo:**
export function getAttributeDefintionsFromName(node: string): string[] {
  // quicker than regex
  if (!node.includes('::') && !node.includes(':*')) {
    return [];
  }

  const attrDefs: string[] = [];
  for (const line of node.split('\n')) {
    if (line.startsWith('`')) {
      continue;
    }
    const attrMatch = line.match(/^(.+)::/i);
    if (attrMatch && attrMatch[1]) {
      attrDefs.push(attrMatch[1].replace('[[', '').replace(']]', ''));
      continue;
    }

    const attrMatchAlt = line.match(/^\*\*(.+):\*\*/i);
    if (attrMatchAlt && attrMatchAlt[1]) {
      attrDefs.push(attrMatchAlt[1].replace('[[', '').replace(']]', ''));
      continue;
    }
  }

  return attrDefs;
}

export function findPreceedingAlias(nodeName: string, aliasEndIndex: number): string | undefined {
  let alias = undefined;
  let aliasStartIndex = undefined;
  if (nodeName[aliasEndIndex] === ']') {
    for (let i = aliasEndIndex; i >= 0; i--) {
      if (nodeName[i] === '[') {
        aliasStartIndex = i + 1; // skip the '['
        break;
      }
    }

    if (aliasStartIndex) {
      alias = nodeName.substring(aliasStartIndex, aliasEndIndex);
    }
  }
  return alias;
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
