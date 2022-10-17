export function isEmptySpace(char: string) {
  //we count tab as one empty space
  return char === ' ' || char === '\t';
}

export function countEmptySpace(content: string, curPosition: number): number {
  let count = 0;
  while (isEmptySpace(content[curPosition + count])) {
    count++;
  }
  return count;
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
