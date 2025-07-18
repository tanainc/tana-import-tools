export function hasField(node: string) {
  return node.includes('::');
}

export function hasImages(name: string) {
  return name.includes('![](https://');
}

/**
 * Convert a date to YYYY-MM-DD format, used for Tana date objects (links) and journal pages.
 * @param date
 */
export function convertDateToTanaDateStr(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear().toString();
  return `${year}-${month}-${day}`;
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
