import { Hierarchy } from './hierarchy';
import { nextNewLine } from './newline';

export function countHeadingSymbols(content: string, pos: number) {
  let curPos = pos;
  let count = 0;
  while (content[curPos] === '#') {
    curPos++;
    count++;
  }

  return count;
}

export function isHeadingStart(content: string, pos: number) {
  const count = countHeadingSymbols(content, pos);
  return count > 0 && content[pos + count] === ' ';
}

export function findHeadingSlicePosition(content: string, curPosition: number, hierachy: Hierarchy) {
  //we can skip the heading symbols and the emtpy space between heading symbols and heading text
  return nextNewLine(content, curPosition + hierachy.level + 1);
}

/*
 * Removes heading symbols and empty space at the start of the heading.
 */
export function postProcessHeading(content: string, hierarchy: Hierarchy) {
  return content.slice(hierarchy.level).trim();
}
