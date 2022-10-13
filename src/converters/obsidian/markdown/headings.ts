import { countEmptySpace } from './emptySpace';
import { HierarchyType } from './markdownNodes';
import { Hierarchy } from './markdownNodes';
import { lastPositionIsNewline, nextNewLine } from './newline';

export function detectHeadingHierarchy(content: string, pos: number): null | Hierarchy {
  if (!lastPositionIsNewline(content, pos)) {
    return null;
  }
  const count = countHeadingSymbols(content, pos);
  if (!(count > 0 && content[pos + count] === ' ')) {
    return null;
  }

  return { type: HierarchyType.HEADING, level: count };
}

function countHeadingSymbols(content: string, pos: number) {
  let curPos = pos;
  let count = 0;
  while (content[curPos] === '#') {
    curPos++;
    count++;
  }

  return count;
}

export function findHeadingSliceStartPosition(content: string, curPosition: number, hierarchy: Hierarchy) {
  const posOfHeadingText = curPosition + hierarchy.level + 1; //skip heading symbols and " " between heading symbols and text
  const emptySpaceInHeadingText = countEmptySpace(content, posOfHeadingText);

  return posOfHeadingText + emptySpaceInHeadingText;
}

export function findHeadingSliceEndPosition(content: string, headingTextPos: number, hierarchy: Hierarchy) {
  //for the search we can skip the heading symbols and the empty space between heading symbols and heading text
  return nextNewLine(content, headingTextPos + hierarchy.level + 1);
}
