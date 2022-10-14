import { detectBulletHierarchy } from './bullets';
import { HierarchyType } from './markdownNodes';
import { detectHeadingHierarchy } from './headings';
import { Hierarchy } from './markdownNodes';
import { lastPositionIsNewline, nextNewLine } from '../markdown/newline';
import { detectCodeBlockHierarchy } from './codeblocks';

export function findParagraphSliceStartPosition(curPosition: number) {
  //we don't trim the start
  return curPosition;
}

export function findParagraphSliceEndPosition(content: string, curPosition: number): [number] | [number, Hierarchy] {
  let endPosition = nextNewLine(content, curPosition);
  let char = content[endPosition];
  let lastChar = char;
  endPosition++;
  char = content[endPosition];
  //paragraphs end with double newlines or a new hierarchy
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (char === undefined) {
      return [endPosition];
    } else if (char === '\n' && lastChar === '\n') {
      return [endPosition - 1];
    } else {
      const hierarchy = newTypeOfHierarchyStarts(content, endPosition);
      if (hierarchy) {
        return [endPosition - 1, hierarchy];
      }
    }
    //TODO: jump to newline?
    lastChar = char;
    endPosition++;
    char = content[endPosition];
  }
}

//special case, where we want an extra bullet for block quotes
//TODO: same for code blocks + code block endings
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function detectBlockQuoteHierarchy(content: string, pos: number): Hierarchy | null {
  if (lastPositionIsNewline(content, pos) && content[pos] === '>' && content[pos + 1] === ' ') {
    return { type: HierarchyType.PARAGRAPH, level: 0 };
  }
  return null;
}

function newTypeOfHierarchyStarts(content: string, pos: number): Hierarchy | null {
  let hierarchy: Hierarchy | null = detectHeadingHierarchy(content, pos);
  if (hierarchy) {
    return hierarchy;
  }
  hierarchy = detectBulletHierarchy(content, pos);
  if (hierarchy) {
    return hierarchy;
  }
  //TODO: its not enough to just cut here, we actually need to cut the whole block quote just like the code block
  // hierarchy = detectBlockQuoteHierarchy(content, pos);
  // if (hierarchy) {
  //   return hierarchy;
  // }
  hierarchy = detectCodeBlockHierarchy(content, pos);
  if (hierarchy) {
    return hierarchy;
  }

  return null;
}
