import { detectBulletHierarchy } from './bullets';
import { HierarchyType } from './markdownNodes';
import { detectHeadingHierarchy } from './headings';
import { Hierarchy } from './markdownNodes';
import { lastPositionIsNewline, nextNewLine } from './newline';

export function findParagraphSliceStartPosition(curPosition: number) {
  //we don't trim the start
  return curPosition;
}

export function findParagraphSliceEndPosition(content: string, curPosition: number): number {
  let endPosition = nextNewLine(content, curPosition);
  let char = content[endPosition];
  let lastChar = char;
  endPosition++;
  char = content[endPosition];
  //paragraphs end with double newlines or a new hierarchy
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (char === undefined) {
      return endPosition;
    } else if (char === '\n' && lastChar === '\n') {
      return endPosition - 1;
    } else {
      //we could use this hierarchy because we already detected it, however this would overcomplicate the whole process
      const hierachy = newTypeOfHierarchyStarts(content, endPosition);
      if (hierachy) {
        return endPosition - 1;
      }
    }
    lastChar = char;
    endPosition++;
    char = content[endPosition];
  }
}

//special case, where we want an extra bullet for block quotes
//TODO: same for code blocks + code block endings
function detectBlockQuoteHierarchy(content: string, pos: number): Hierarchy | null {
  if (lastPositionIsNewline(content, pos) && content[pos] === '>' && content[pos + 1] === ' ') {
    return { type: HierarchyType.PARAGRAPH, level: 0 };
  }
  return null;
}

function newTypeOfHierarchyStarts(content: string, pos: number): Hierarchy | null {
  let hierachy: Hierarchy | null = detectHeadingHierarchy(content, pos);
  if (hierachy) {
    return hierachy;
  }
  hierachy = detectBulletHierarchy(content, pos);
  if (hierachy) {
    return hierachy;
  }
  hierachy = detectBlockQuoteHierarchy(content, pos);
  if (hierachy) {
    return hierachy;
  }

  return null;
}
