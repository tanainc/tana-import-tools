export function isEmptySpace(char: string) {
  return char === ' ' || char === '\t';
}

export function countEmptySpace(content: string, curPosition: number, count = 0): number {
  //we count tab as one empty space
  if (!isEmptySpace(content[curPosition])) {
    return count;
  }
  return countEmptySpace(content, curPosition + 1, count + 1);
}

/**
 * Backtracks starting from the current position and finds the first position that is not empty space.
 * Returns the position of the last empty space.
 */
export function findFirstEmptySpacePosBackwards(content: string, curPosition: number) {
  let res = curPosition;
  let curChar = content[curPosition];
  while (isEmptySpace(curChar)) {
    res--;
    curChar = content[res];
  }

  return res + 1;
}
