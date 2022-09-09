import { NodeDescription, Hierarchy, HierarchyType } from './obsidianNodes.types';
import { countEmptySpace, nextNewLine } from './utils';

export function readNodes(content: string): NodeDescription[] {
  const nodeDescs: NodeDescription[] = [];

  for (let index = 0; index < content.length; index++) {
    const element = content[index];
    if (element == '\n') continue;
    const hierarchy = getHierarchy(element, content, index);
    const endPos = endPosition(content, index, hierarchy);
    nodeDescs.push({ ...hierarchy, endPos, startPos: index, content: content.slice(index, endPos + 1) });

    index = endPos;
  }

  return nodeDescs;
}

const HIERARCHY_INDICATORS = ['#', '*', '-'];

function isOutlinerNode(char: string) {
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
  if (isOutlinerNode(content[curPosition + emptySpaces]) && content[curPosition + emptySpaces + 1] === ' ') {
    return { type: HierarchyType.OUTLINE, level: Math.max(emptySpaces) };
  }

  return { type: HierarchyType.PARAGRAPH, level: 0 };
}

export function endPosition(content: string, curPosition: number, hierarchy: Hierarchy): number {
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
    endPosition++;
    char = content[endPosition];
    //paragraphs end with double newlines or a new hierarchy
    while (true) {
      if (char === '\n' || HIERARCHY_INDICATORS.includes(char) || char === undefined) {
        return endPosition - 2;
      }
      endPosition++;
      char = content[endPosition];
    }
  }

  throw 'Hierarchy type not detected.';
}
