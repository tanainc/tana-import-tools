import { countEmptySpace, findFirstEmptySpacePosBackwards } from './emptySpace';
import { Hierarchy } from './hierarchy';
import { nextNewLine } from './newline';

export function isBulletNodeStart(content: string, pos: number) {
  let isBulletStart = true;

  const char = content[pos];
  const secondChar = content[pos + 1];
  //only real empty string is valid for bullet
  if (!((char === '*' || char === '-') && secondChar === ' ')) {
    //check for numbered bullets
    isBulletStart = !isNaN(parseInt(char)) && secondChar === '.' && content[pos + 2] === ' ';
  }

  //bullet nodes always have \n( *) in front of them or are at the start of the file
  //so need to backtrack empty space to verify
  const nonEmptyPos = findFirstEmptySpacePosBackwards(content, pos - 1) - 1;
  const nonEmptyChar = content[nonEmptyPos];
  if (!(nonEmptyChar === '\n' || nonEmptyChar === undefined)) {
    return false;
  }

  return isBulletStart;
}

export function findBulletSlicePosition(content: string, curPosition: number, hierarchy: Hierarchy) {
  //we can skip the empty space before the bullet, the bullet symbol and the empty space after the bullet symbol
  let endPosition = nextNewLine(content, curPosition + hierarchy.level + 1 + 1);
  let char = content[endPosition];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    //new lines that start with the number of empty spaces of the level+1 are considered part of the node
    const emptySpaces = countEmptySpace(content, endPosition + 1);
    if (emptySpaces == hierarchy.level + 2 && !isBulletNodeStart(content, endPosition + 1 + emptySpaces)) {
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

export function postProcessBullet(content: string) {
  //remove empty prefix
  const processed = content.trimStart();
  if (!isNaN(parseInt(processed[0]))) {
    //if it starts with e.g. "1." we keep the numbering because Tana does not support numbered lists right now
    return processed;
  }
  //remove "* "
  return processed.slice(2);
}
