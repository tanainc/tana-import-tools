import { countEmptySpace, nextNewLine } from './utils';

export enum HierarchyType {
  ROOT = 'Root',
  HEADING = 'Heading',
  OUTLINE = 'Outliner Node',
  PARAGRAPH = 'Paragraph',
}

export interface Hierarchy {
  type: HierarchyType;
  //lower = higher in the hierarchy
  //for outliner nodes also used as a measure of empty space
  level: number;
}

export interface ObsidianNode extends Hierarchy {
  content: string;
}

export function readNodes(content: string): ObsidianNode[] {
  const nodeDescs: ObsidianNode[] = [];

  for (let index = 0; index < content.length; index++) {
    const element = content[index];
    if (element == '\n') continue;
    const hierarchy = getHierarchy(element, content, index);
    const endPos = findEndPosition(content, index, hierarchy);
    nodeDescs.push({
      ...hierarchy,
      content: cutNodeContent(content, index, endPos, hierarchy),
    });

    //we increment immediately afterwards due to the loop
    index = endPos;
  }

  return nodeDescs;
}

function cutNodeContent(content: string, startPos: number, endPos: number, hierarchy: Hierarchy) {
  let sliceStart = startPos;
  let sliceEnd = endPos + 1;

  //removing prefixing empty space
  let startChar = content[sliceStart];
  while (startChar === ' ' || startChar === '\t') {
    sliceStart++;
    startChar = content[sliceStart];
  }

  if (hierarchy.type === HierarchyType.OUTLINE) {
    sliceStart += 2; //2 = *-char and empty space after that
  }

  //TODO: might need to convert it
  if (hierarchy.type === HierarchyType.HEADING) {
    sliceStart += hierarchy.level + 1; //heading symbols and empty space after that
  }

  //removing trailing empty space, newlines are already excluded
  let endChar = content[sliceEnd - 1];
  while (endChar === ' ' || endChar === '\t') {
    sliceEnd--;
    endChar = content[sliceEnd - 1];
  }

  return content.slice(sliceStart, sliceEnd);
}

function isOutlinerNodeStart(char: string) {
  return char === '*' || char === '-';
}

export function getHierarchy(curChar: string, content: string, curPosition: number): Hierarchy {
  if (curChar === '#') {
    let pos = curPosition + 1;
    let char = content[pos];
    while (char === '#') {
      pos++;
      char = content[pos];
    }
    if (char === ' ') {
      return { type: HierarchyType.HEADING, level: pos - curPosition };
    } else {
      //is a paragraph that starts with #'s
      return { type: HierarchyType.PARAGRAPH, level: 0 };
    }
  }

  //for nodes we need a precise level === empty space, so we can detect multi line node content
  const emptySpaces = countEmptySpace(content, curPosition);
  if (isOutlinerNodeStart(content[curPosition + emptySpaces]) && content[curPosition + emptySpaces + 1] === ' ') {
    return { type: HierarchyType.OUTLINE, level: Math.max(emptySpaces) };
  }

  return { type: HierarchyType.PARAGRAPH, level: 0 };
}

const HIERARCHY_INDICATORS = ['#', '*', '-'];

//TODO: change to return str instead of just searching endpos for even less O(n)
/**
 * Returns the index in the content-string of the endposition of the current obsidian node.
 */
export function findEndPosition(content: string, curPosition: number, hierarchy: Hierarchy): number {
  let endPosition = nextNewLine(content, curPosition);
  let char = content[endPosition];

  if (char === undefined || hierarchy.type === HierarchyType.HEADING) {
    return endPosition - 1;
  }

  if (hierarchy.type === HierarchyType.OUTLINE) {
    while (true) {
      //new lines that start with the number of empty spaces of the level+1 are considered part of the node
      const emptySpaces = countEmptySpace(content, endPosition + 1);
      if (emptySpaces == hierarchy.level + 2) {
        endPosition = nextNewLine(content, endPosition + 1);
        char = content[endPosition];
      } else {
        return endPosition - 1;
      }
      if (char === undefined) return endPosition - 1;
    }
  }

  if (hierarchy.type === HierarchyType.PARAGRAPH) {
    let lastChar = char;
    endPosition++;
    char = content[endPosition];
    //paragraphs end with double newlines or a new hierarchy
    while (true) {
      if ((char === '\n' && lastChar === '\n') || HIERARCHY_INDICATORS.includes(char) || char === undefined) {
        return endPosition - 2;
      }
      lastChar = char;
      endPosition++;
      char = content[endPosition];
    }
  }

  throw 'Hierarchy type not detected.';
}
