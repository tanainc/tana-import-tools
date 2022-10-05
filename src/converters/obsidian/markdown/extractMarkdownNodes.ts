import { countEmptySpace, nextNewLine } from '../utils';
import { postProcessMarkdownNodes } from './postProcessMarkdownNodes';

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
  //for heading nodes this is the number of #'s
  level: number;
}

export interface MarkdownNode extends Hierarchy {
  content: string;
}

export function extractMarkdownNodes(content: string): MarkdownNode[] {
  const nodeDescs: MarkdownNode[] = [];

  for (let index = 0; index < content.length; index++) {
    const element = content[index];
    if (element == '\n') continue;
    const hierarchy = getHierarchy(element, content, index);
    const endPos = findEndPosition(content, index, hierarchy);
    nodeDescs.push({
      ...hierarchy,
      content: postProcessMarkdownNodes(content.slice(index, endPos), hierarchy),
    });

    //we increment immediately afterwards due to the loop
    index = endPos;
  }

  return nodeDescs;
}

function isOutlinerNodeStart(content: string, pos: number) {
  const char = content[pos];
  const secondChar = content[pos + 1];
  if ((char === '*' || char === '-') && secondChar === ' ') {
    return true;
  }
  return !isNaN(parseInt(char)) && secondChar === '.' && content[pos + 2] === ' ';
}

function getHierarchy(curChar: string, content: string, curPosition: number): Hierarchy {
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
  if (isOutlinerNodeStart(content, curPosition + emptySpaces)) {
    return { type: HierarchyType.OUTLINE, level: Math.max(emptySpaces) };
  }

  return { type: HierarchyType.PARAGRAPH, level: 0 };
}

function isHeadingStart(content: string, pos: number) {
  //yeah yeah RegEx and all, but I really want this to be fast
  if (content[pos] !== '#') return false;
  let curPos = pos + 1;
  while (content[curPos] === '#') {
    curPos++;
  }
  return content[curPos] == ' ';
}

function isBlockQuoteStart(content: string, pos: number) {
  return content[pos] === '>' && content[pos + 1] === ' ';
}

function isHierarchyStart(content: string, pos: number) {
  return isHeadingStart(content, pos) || isOutlinerNodeStart(content, pos) || isBlockQuoteStart(content, pos);
}

/**
 * Returns the index in the content-string of the endposition of the current obsidian node.
 */
function findEndPosition(content: string, curPosition: number, hierarchy: Hierarchy): number {
  let endPosition = nextNewLine(content, curPosition);
  let char = content[endPosition];

  if (char === undefined || hierarchy.type === HierarchyType.HEADING) {
    endPosition = endPosition - 1;
  } else if (hierarchy.type === HierarchyType.OUTLINE) {
    while (true) {
      //new lines that start with the number of empty spaces of the level+1 are considered part of the node
      const emptySpaces = countEmptySpace(content, endPosition + 1);
      if (emptySpaces == hierarchy.level + 2 && !isOutlinerNodeStart(content, endPosition + 1 + emptySpaces)) {
        endPosition = nextNewLine(content, endPosition + 1);
        char = content[endPosition];
      } else {
        endPosition = endPosition - 1;
        break;
      }
      if (char === undefined) {
        endPosition = endPosition - 1;
        break;
      }
    }
  } else if (hierarchy.type === HierarchyType.PARAGRAPH) {
    let lastChar = char;
    endPosition++;
    char = content[endPosition];
    //paragraphs end with double newlines or a new hierarchy
    while (true) {
      if (char === undefined) {
        endPosition = endPosition - 1;
        break;
      } else if ((char === '\n' && lastChar === '\n') || isHierarchyStart(content, endPosition)) {
        endPosition = endPosition - 2;
        break;
      }
      lastChar = char;
      endPosition++;
      char = content[endPosition];
    }
  }

  endPosition++;

  return endPosition;
}
