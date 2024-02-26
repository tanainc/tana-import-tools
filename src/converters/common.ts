export function hasField(node: string) {
  return node.includes('::');
}

export function hasImages(name: string) {
  return name.includes('![](https://');
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

const monthPrefixes = months.map((m) => m.slice(0, 3));

// Convert 'June 1st, 2021' and 'Jun 1st, 2021' to 'MM-DD-YYYY' without dealing with timezones, etc.
export function dateStringToUSDateUID(str: string) {
  str = str.replace(/(^\w+\s\d{1,2})(\w{2}),(\s\d+)/, '$1$3');
  const pieces = str.split(/\s/);

  const monthMatch = months.indexOf(pieces[0]);
  const monthPrefixMatch = monthPrefixes.indexOf(pieces[0]);
  let month;
  if (monthMatch !== -1) {
    month = monthMatch + 1;
  } else if (monthPrefixMatch !== -1) {
    month = monthPrefixMatch + 1;
  } else {
    return str;
  }

  return `${month.toString().padStart(2, '0')}-${pieces[1].toString().padStart(2, '0')}-${pieces[2]
    .toString()
    .padStart(4, '0')}`;
}

// Convert 'June 1st, 2021' to 'YYYY-MM-DD' without dealing with timezones etc
export function dateStringToYMD(str: string) {
  str = str.replace(/(^\w+\s\d{1,2})(\w{2}),(\s\d+)/, '$1$3');
  const pieces = str.split(/\s/);
  const month = months.indexOf(pieces[0]) + 1;
  return `${pieces[2].toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${pieces[1]
    .toString()
    .padStart(2, '0')}`;
}

export function getValueForAttribute(fieldName: string, node: string): string | undefined {
  if (!node.includes('::')) {
    return undefined;
  }
  for (const line of node.split('\n')) {
    // foo::bar
    if (line.startsWith(`${fieldName}::`)) {
      return line.split(`${fieldName}::`)[1].trim();
    } else if (line.startsWith(`[[${fieldName}]]::`)) {
      return line.split(`[[${fieldName}]]::`)[1].trim();
    }
  }
}

// Finds attribute defintions like Foo::
export function getAttributeDefinitionsFromName(node: string): string[] {
  // quicker than regex
  if (!node.includes('::')) {
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
