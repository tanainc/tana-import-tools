import { countEmptySpace, findFirstEmptySpacePosBackwards } from '../markdown/emptySpace';
import { HierarchyType } from './markdownNodes';
import { Hierarchy } from './markdownNodes';
import { isNewLine, nextNewLine } from '../markdown/newline';

function isNumberedBullet(content: string, pos: number) {
  const char = content[pos];
  const secondChar = content[pos + 1];
  return !isNaN(parseInt(char)) && (secondChar === '.' || secondChar === ')') && content[pos + 2] === ' ';
}

export function detectBulletHierarchy(content: string, currentPos: number): null | Hierarchy {
  let isBulletStart = true;
  //skip possible empty space at the start of nodes
  const pos = currentPos + countEmptySpace(content, currentPos);

  const char = content[pos];
  const secondChar = content[pos + 1];
  //only real empty string is valid for bullet
  if (!((char === '*' || char === '-') && secondChar === ' ')) {
    isBulletStart = isNumberedBullet(content, pos);
  }

  //bullet nodes always have \n( *) in front of them or are at the start of the file
  //so need to backtrack empty space to verify
  const nonEmptyPos = findFirstEmptySpacePosBackwards(content, pos - 1) - 1;
  const nonEmptyChar = content[nonEmptyPos];
  if (!isNewLine(nonEmptyChar)) {
    return null;
  }
  //for nodes we need a precise level === empty space, so we can detect multi line node content
  return isBulletStart ? { type: HierarchyType.BULLET, level: pos - nonEmptyPos - 1 } : null;
}

export function findBulletSliceStartPosition(content: string, curPosition: number, hierarchy: Hierarchy) {
  let posOfBulletText = curPosition + hierarchy.level;
  if (isNumberedBullet(content, posOfBulletText)) {
    //in case of numbered bullet, we keep the symbol
    return posOfBulletText;
  }
  posOfBulletText += 1 + 1; //bullet symbol and empty space after that

  const emptySpaceInBulletText = countEmptySpace(content, posOfBulletText);

  return posOfBulletText + emptySpaceInBulletText;
}

export function findBulletSliceEndPosition(content: string, curPosition: number, hierarchy: Hierarchy) {
  //we can skip the empty space before the bullet, the bullet symbol and the empty space after the bullet symbol
  let endPosition = nextNewLine(content, curPosition + hierarchy.level + 1 + 1);
  let char = content[endPosition];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    //new lines that start with the number of empty spaces of the level+1 are considered part of the node

    //but also if they are just equal to the hierachy-level:
    //e.g.
    //- Text1
    // - Text2
    // Text3
    //Text4
    //"Text3" is still part of Text2 because Obsidian allows that!
    //but not "Text4" because its on the zero level
    const emptySpaces = countEmptySpace(content, endPosition + 1);
    if (
      emptySpaces > 0 &&
      (emptySpaces == hierarchy.level + 2 || emptySpaces == hierarchy.level) &&
      !detectBulletHierarchy(content, endPosition + 1 + emptySpaces)
    ) {
      endPosition = nextNewLine(content, endPosition + 1);
      char = content[endPosition];
    } else {
      return endPosition;
    }
    if (char === undefined) {
      return endPosition;
    }
  }
}
